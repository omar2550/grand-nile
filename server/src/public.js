import { Router } from "express";
import {
  Hotel,
  Room,
  Table,
  Booking,
  MenuItem,
  PosOrder,
  nextNo,
} from "./models.js";
import { wrap } from "./auth.js";

// Public pages for guests who scan a QR code. No sign-in needed, so they only ever see the menu and can send an order request.
const api = Router();
const hits = new Map();
const limited = (ip) => {
  const now = Date.now();
  const a = (hits.get(ip) || []).filter((t) => now - t < 600000);
  a.push(now);
  hits.set(ip, a);
  return a.length > 8;
};
const hotelOf = async (slug) => {
  const h = await Hotel.findOne({ slug, active: true });
  if (!h) throw new Error("Hotel not found");
  return h;
};

api.get(
  "/:slug/menu",
  wrap(async (req, res) => {
    const h = await hotelOf(req.params.slug);
    const outlet = req.query.outlet === "rooftop" ? "rooftop" : "room";
    const items = await MenuItem.find({
      hotel: h._id,
      available: { $ne: false },
      outlets: outlet === "room" ? { $in: ["room", "restaurant"] } : "rooftop",
    })
      .sort("category name")
      .select("name category price emoji desc")
      .lean();
    res.json({ hotel: { name: h.name, city: h.city }, outlet, items });
  }),
);

api.post(
  "/:slug/order",
  wrap(async (req, res) => {
    if (limited(req.ip))
      throw new Error("Too many requests. Please call reception.");
    const h = await hotelOf(req.params.slug);
    const { room, table, items = [], guestName, note } = req.body;
    const picked = [];
    for (const it of items.slice(0, 30)) {
      const m = await MenuItem.findOne({
        _id: it.menuId,
        hotel: h._id,
        available: { $ne: false },
      });
      const qty = Math.min(20, Math.max(1, +it.qty || 1));
      if (m)
        picked.push({
          menu: m._id,
          name: m.name,
          price: m.price,
          qty,
          fromQr: true,
        });
    }
    if (!picked.length) throw new Error("Choose at least one item");
    if (table) {
      const t = await Table.findOne({
        hotel: h._id,
        outlet: "rooftop",
        number: +table,
      });
      if (!t) throw new Error("Table not found");
      let o = await PosOrder.findOne({
        hotel: h._id,
        table: t._id,
        status: "open",
      });
      if (!o)
        o = new PosOrder({
          hotel: h._id,
          no: await nextNo("order:" + h._id),
          outlet: "rooftop",
          table: t._id,
          tableNo: t.number,
          waiter: "QR",
          items: [],
        });
      picked.forEach((p) => o.items.push(p));
      o.qr = true;
      if (note) o.note = String(note).slice(0, 200);
      await o.save();
      return res.json({ ok: true, orderNo: o.no });
    }
    const r = await Room.findOne({ hotel: h._id, number: String(room) });
    const b =
      r &&
      (await Booking.findOne({
        hotel: h._id,
        room: r._id,
        status: "in_house",
      }));
    if (!b)
      throw new Error(
        "We could not find a guest in this room. Please call reception.",
      );
    const o = await PosOrder.create({
      hotel: h._id,
      no: await nextNo("order:" + h._id),
      outlet: "room",
      roomNo: r.number,
      booking: b._id,
      waiter: "QR",
      qr: true,
      items: picked,
      guestName: String(guestName || "").slice(0, 60),
      note: String(note || "").slice(0, 200),
    });
    res.json({ ok: true, orderNo: o.no });
  }),
);
export default api;
