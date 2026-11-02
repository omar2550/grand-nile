import { Router } from "express";
import bcrypt from "bcryptjs";
import {
  User,
  Room,
  Guest,
  Booking,
  FolioEntry,
  Journal,
  StockItem,
  MenuItem,
  Table,
  PosOrder,
  Audit,
  nextNo,
} from "./models.js";
import * as S from "./services.js";
import {
  authenticate,
  allow,
  audit,
  sign,
  own,
  roles,
  wrap,
  MODULES,
} from "./auth.js";

const api = Router();

/* ---------- Sign in ---------- */
api.post(
  "/auth/login",
  wrap(async (req, res) => {
    const u = await User.findOne({
      email: String(req.body.email || "")
        .trim()
        .toLowerCase(),
    });
    if (
      !u ||
      !u.active ||
      !(await bcrypt.compare(req.body.password || "", u.passwordHash))
    ) {
      await Audit.create({
        user: req.body.email,
        action: "Failed sign-in",
        severity: "warn",
      });
      return res.status(401).json({ error: "Wrong email or password" });
    }
    await Audit.create({ user: u.name, role: u.role, action: "Signed in" });
    res.json({ token: sign(u) });
  }),
);
api.use(authenticate);
api.get("/auth/me", (req, res) =>
  res.json({
    name: req.user.name,
    role: req.user.role,
    modules: MODULES[req.user.role],
    hotelId: req.hotel._id,
    hotels: req.hotels.map((h) => ({
      _id: h._id,
      name: h.name,
      code: h.code,
      slug: h.slug,
      city: h.city,
      publicUrl: h.publicUrl,
    })),
  }),
);

/* ---------- All hotels at a glance (owner) ---------- */
api.get(
  "/group/overview",
  allow("group"),
  wrap(async (req, res) => {
    const t = S.today();
    const out = await Promise.all(
      req.hotels.map(async (h) => {
        const [rooms, inHouse, rev, owed, low] = await Promise.all([
          Room.countDocuments({
            hotel: h._id,
            status: { $ne: "out_of_order" },
          }),
          Booking.countDocuments({ hotel: h._id, status: "in_house" }),
          Journal.aggregate([
            { $match: { hotel: h._id, date: t } },
            { $unwind: "$lines" },
            { $match: { "lines.code": /^4/ } },
            {
              $group: {
                _id: null,
                net: { $sum: { $subtract: ["$lines.credit", "$lines.debit"] } },
              },
            },
          ]),
          Journal.aggregate([
            { $match: { hotel: h._id } },
            { $unwind: "$lines" },
            { $match: { "lines.code": "1130" } },
            {
              $group: {
                _id: null,
                net: { $sum: { $subtract: ["$lines.debit", "$lines.credit"] } },
              },
            },
          ]),
          StockItem.find({ hotel: h._id }).then(
            (s) => s.filter((x) => x.qty <= x.reorderLevel).length,
          ),
        ]);
        return {
          _id: h._id,
          name: h.name,
          city: h.city,
          code: h.code,
          rooms,
          inHouse,
          occupancyPct: Math.round((inHouse / (rooms || 1)) * 100),
          revenueToday: S.r2(rev[0]?.net || 0),
          guestsOwe: S.r2(owed[0]?.net || 0),
          lowStock: low,
        };
      }),
    );
    res.json(out);
  }),
);

/* ---------- Today (dashboard) ---------- */
api.get(
  "/dashboard",
  wrap(async (req, res) => {
    const H = req.hotel._id,
      t = S.today(),
      start = S.addDays(t, -13);
    const rooms = await Room.find({ hotel: H });
    const active = await Booking.find({
      hotel: H,
      status: { $ne: "cancelled" },
      checkIn: { $lte: t },
      checkOut: { $gt: start },
    }).lean();
    const occupancy = Array.from({ length: 14 }, (_, i) => {
      const d = S.addDays(start, i);
      return {
        date: d,
        occupied: active.filter((b) => b.checkIn <= d && b.checkOut > d).length,
      };
    });
    const rev = await Journal.aggregate([
      { $match: { hotel: H, date: { $gte: start, $lte: t } } },
      { $unwind: "$lines" },
      { $match: { "lines.code": /^4/ } },
      {
        $group: {
          _id: { date: "$date", code: "$lines.code" },
          net: { $sum: { $subtract: ["$lines.credit", "$lines.debit"] } },
        },
      },
    ]);
    const daily = occupancy.map((o) => ({
      date: o.date,
      rooms: 0,
      fnb: 0,
      other: 0,
    }));
    rev.forEach((r) => {
      const d = daily.find((x) => x.date === r._id.date);
      if (d)
        d[
          r._id.code === "4100"
            ? "rooms"
            : ["4200", "4210"].includes(r._id.code)
              ? "fnb"
              : "other"
        ] += r.net;
    });
    const td = daily[13],
      sold = occupancy[13].occupied,
      sellable = rooms.filter((r) => r.status !== "out_of_order").length || 1;
    const stock = await StockItem.find({ hotel: H }).lean();
    const hk = rooms.reduce(
      (a, r) => ((a[r.status] = (a[r.status] || 0) + 1), a),
      {},
    );
    const [arrivals, departures, inHouseList, openOrders] = await Promise.all([
      Booking.find({
        hotel: H,
        status: "reserved",
        checkIn: { $lte: t },
      }).populate("guest room"),
      Booking.find({
        hotel: H,
        status: "in_house",
        checkOut: { $lte: t },
      }).populate("guest room"),
      Booking.find({ hotel: H, status: "in_house" }).select("adults children"),
      PosOrder.countDocuments({ hotel: H, status: "open" }),
    ]);
    res.json({
      kpi: {
        occupancyPct: Math.round((sold / sellable) * 100),
        adr: sold ? Math.round(td.rooms / sold) : 0,
        revpar: Math.round(td.rooms / sellable),
        revenueToday: S.r2(td.rooms + td.fnb + td.other),
        inHouse: inHouseList.length,
        people: inHouseList.reduce(
          (s, b) => s + (b.adults || 0) + (b.children || 0),
          0,
        ),
        totalRooms: rooms.length,
        openOrders,
      },
      occupancy,
      daily,
      housekeeping: hk,
      arrivals,
      departures,
      lowStock: stock
        .filter((s) => s.qty <= s.reorderLevel)
        .sort((a, b) => a.qty / a.reorderLevel - b.qty / b.reorderLevel),
    });
  }),
);

/* ---------- Reception ---------- */
api.get(
  "/rooms",
  allow("pms", "pos", "qr"),
  wrap(async (req, res) =>
    res.json(await Room.find({ hotel: req.hotel._id }).sort("number")),
  ),
);
api.post(
  "/rooms",
  roles("owner", "admin", "manager"),
  wrap(async (req, res) => {
    const { number, type, rate, floor, view, beds } = req.body;
    if (!number || !(rate > 0))
      throw new Error("Enter a room number and a price");
    const r = await Room.create({
      hotel: req.hotel._id,
      number: String(number),
      type: type || "Standard",
      rate: +rate,
      floor: floor || +String(number)[0] || 1,
      view,
      beds,
    });
    await audit(req, "Room added", `Room ${r.number}`);
    res.json(r);
  }),
);
api.patch(
  "/rooms/:id",
  roles("owner", "admin", "manager"),
  wrap(async (req, res) => {
    const r = await own(Room, req.params.id, req);
    ["type", "view", "beds"].forEach(
      (k) => req.body[k] !== undefined && (r[k] = req.body[k]),
    );
    if (req.body.rate > 0) r.rate = +req.body.rate;
    await r.save();
    await audit(
      req,
      "Room changed",
      `Room ${r.number}: ${JSON.stringify(req.body)}`,
    );
    res.json(r);
  }),
);
api.patch(
  "/rooms/:id/status",
  allow("pms"),
  wrap(async (req, res) => {
    const r = await own(Room, req.params.id, req);
    r.status = req.body.status;
    await r.save();
    await audit(
      req,
      "Room cleaning status changed",
      `Room ${r.number} → ${r.status}`,
    );
    res.json(r);
  }),
);
api.get(
  "/bookings",
  allow("pms"),
  wrap(async (req, res) => {
    const { from = S.addDays(S.today(), -3), to = S.addDays(S.today(), 28) } =
      req.query;
    res.json(
      await Booking.find({
        hotel: req.hotel._id,
        status: { $ne: "cancelled" },
        checkIn: { $lt: to },
        checkOut: { $gt: from },
      })
        .populate("guest", "name nationality vip phone")
        .lean(),
    );
  }),
);
api.get(
  "/bookings/search",
  allow("pms"),
  wrap(async (req, res) => {
    const rx = new RegExp(
      String(req.query.q || "").replace(/[^\w\s@.-]/g, ""),
      "i",
    );
    const guests = await Guest.find({
      hotel: req.hotel._id,
      $or: [{ name: rx }, { phone: rx }],
    })
      .limit(30)
      .select("_id");
    res.json(
      await Booking.find({
        hotel: req.hotel._id,
        $or: [{ code: rx }, { guest: { $in: guests } }],
      })
        .sort("-checkIn")
        .limit(30)
        .populate("guest room"),
    );
  }),
);
api.get(
  "/reception/today",
  allow("pms"),
  wrap(async (req, res) => {
    const H = req.hotel._id,
      t = S.today(),
      pop = (q) => q.populate("guest room");
    res.json({
      arrivals: await pop(
        Booking.find({
          hotel: H,
          status: "reserved",
          checkIn: { $lte: t },
        }).sort("checkIn"),
      ),
      departures: await pop(
        Booking.find({ hotel: H, status: "in_house", checkOut: { $lte: t } }),
      ),
      inHouse: await pop(
        Booking.find({
          hotel: H,
          status: "in_house",
          checkOut: { $gt: t },
        }).sort("checkOut"),
      ),
      tomorrow: await pop(
        Booking.find({
          hotel: H,
          status: "reserved",
          checkIn: S.addDays(t, 1),
        }),
      ),
    });
  }),
);
api.get(
  "/inhouse",
  allow("pms", "pos", "trips"),
  wrap(async (req, res) => {
    const f = {
      hotel: req.hotel._id,
      status: req.query.all ? { $in: ["in_house", "reserved"] } : "in_house",
    };
    if (req.query.all) f.checkIn = { $lte: S.addDays(S.today(), 30) };
    res.json(await Booking.find(f).sort("checkIn").populate("guest room"));
  }),
);
api.get(
  "/availability",
  allow("pms"),
  wrap(async (req, res) => {
    const { checkIn, checkOut } = req.query;
    const busy = await Booking.find({
      hotel: req.hotel._id,
      status: { $in: ["reserved", "in_house"] },
      checkIn: { $lt: checkOut },
      checkOut: { $gt: checkIn },
    }).distinct("room");
    res.json(
      await Room.find({
        hotel: req.hotel._id,
        _id: { $nin: busy },
        status: { $ne: "out_of_order" },
      }).sort("number"),
    );
  }),
);
api.post(
  "/bookings",
  allow("pms"),
  wrap(async (req, res) => {
    const H = req.hotel._id;
    const {
      guest,
      roomId,
      checkIn,
      checkOut,
      adults,
      children,
      rate,
      source,
      board,
      notes,
    } = req.body;
    if (!(checkOut > checkIn))
      throw new Error("The leaving date must be after the arrival date");
    const room = await own(Room, roomId, req);
    if (
      await Booking.exists({
        hotel: H,
        room: roomId,
        status: { $in: ["reserved", "in_house"] },
        checkIn: { $lt: checkOut },
        checkOut: { $gt: checkIn },
      })
    )
      throw new Error("This room is already booked on those dates");
    const g = await Guest.create({ ...guest, hotel: H });
    const b = await Booking.create({
      hotel: H,
      code: `${req.hotel.code}-${String(await nextNo("booking:" + H)).padStart(5, "0")}`,
      guest: g._id,
      room: roomId,
      checkIn,
      checkOut,
      adults,
      children,
      rate: rate || room.rate,
      source,
      board,
      notes,
    });
    await audit(
      req,
      "Booking created",
      `${b.code} · ${g.name} · Room ${room.number}`,
    );
    res.json(b);
  }),
);
api.post(
  "/bookings/:id/checkin",
  allow("pms"),
  wrap(async (req, res) => {
    await own(Booking, req.params.id, req);
    const b = await S.checkIn(req.params.id);
    await audit(req, "Guest arrived (check-in)", b.code);
    res.json(b);
  }),
);
api.post(
  "/bookings/:id/checkout",
  allow("pms"),
  wrap(async (req, res) => {
    await own(Booking, req.params.id, req);
    const b = await S.checkOut(req.params.id);
    await audit(req, "Guest left (check-out)", b.code);
    res.json(b);
  }),
);
api.post(
  "/bookings/:id/cancel",
  allow("pms"),
  wrap(async (req, res) => {
    const b = await own(Booking, req.params.id, req);
    if (b.status !== "reserved")
      throw new Error("Only a booking that has not arrived can be cancelled");
    b.status = "cancelled";
    await b.save();
    await audit(req, "Booking cancelled", b.code, "warn");
    res.json(b);
  }),
);
api.get(
  "/bookings/:id/folio",
  allow("pms"),
  wrap(async (req, res) => {
    await own(Booking, req.params.id, req);
    res.json({
      booking: await Booking.findById(req.params.id).populate("guest room"),
      ...(await S.folioOf(req.params.id)),
    });
  }),
);
api.post(
  "/bookings/:id/charge",
  allow("pms"),
  wrap(async (req, res) => {
    const b = await own(Booking, req.params.id, req);
    const { dept, description, net } = req.body;
    if (!(net > 0)) throw new Error("Enter an amount greater than zero");
    res.json(
      await S.addCharge({
        hotel: b.hotel,
        booking: b._id,
        dept,
        description: description || dept,
        net: Number(net),
        user: req.user.name,
      }),
    );
  }),
);
api.post(
  "/bookings/:id/payment",
  allow("pms"),
  wrap(async (req, res) => {
    const b = await own(Booking, req.params.id, req);
    const { amount, method } = req.body;
    if (!(amount > 0)) throw new Error("Enter an amount greater than zero");
    await audit(
      req,
      "Payment received",
      `EGP ${amount} (${method}) – ${b.code}`,
    );
    res.json(
      await S.addPayment({
        hotel: b.hotel,
        booking: b._id,
        amount: Number(amount),
        method,
        user: req.user.name,
      }),
    );
  }),
);
api.post(
  "/folio/:entryId/void",
  allow("pms"),
  roles("owner", "admin", "manager"),
  wrap(async (req, res) => {
    const e = await own(FolioEntry, req.params.entryId, req);
    if (e.voided) throw new Error("Already cancelled");
    await S.voidFolioEntry(e, req.user.name);
    await audit(
      req,
      "Bill line cancelled",
      `${e.description} · EGP ${e.total}`,
      "alert",
    );
    res.json(e);
  }),
);
api.post(
  "/night-audit",
  allow("pms", "accounting"),
  wrap(async (req, res) => {
    const out = await S.nightAudit(
      req.hotel._id,
      req.body.date || S.today(),
      req.user.name,
    );
    await audit(req, "Posted room charges for the day", JSON.stringify(out));
    res.json(out);
  }),
);

/* ---------- Restaurant, rooftop & room-service ---------- */
api.get(
  "/tables",
  allow("pos", "qr"),
  wrap(async (req, res) =>
    res.json(
      await Table.find({ hotel: req.hotel._id }).sort({ outlet: 1, number: 1 }),
    ),
  ),
);
api.get(
  "/pos/floor",
  allow("pos"),
  wrap(async (req, res) => {
    const H = req.hotel._id,
      outlet = req.query.outlet === "rooftop" ? "rooftop" : "restaurant";
    res.json({
      tables: await Table.find({ hotel: H, outlet }).sort("number"),
      menu: await MenuItem.find({
        hotel: H,
        outlets: outlet,
        available: { $ne: false },
      }).sort("category name"),
      orders: await PosOrder.find({ hotel: H, outlet, status: "open" }),
      roomOrders: await PosOrder.find({
        hotel: H,
        outlet: "room",
        status: "open",
      })
        .sort("createdAt")
        .populate({
          path: "booking",
          populate: { path: "guest", select: "name" },
        }),
    });
  }),
);
api.post(
  "/pos/orders",
  allow("pos"),
  wrap(async (req, res) => {
    const H = req.hotel._id;
    const table = await own(Table, req.body.tableId, req);
    let o = await PosOrder.findOne({
      hotel: H,
      table: table._id,
      status: "open",
    });
    if (!o)
      o = new PosOrder({
        hotel: H,
        no: await nextNo("order:" + H),
        outlet: table.outlet,
        table: table._id,
        tableNo: table.number,
        waiter: req.user.name,
        items: [],
      });
    for (const it of req.body.items) {
      const m = await own(MenuItem, it.menuId, req);
      const ex = o.items.find(
        (x) => String(x.menu) === String(m._id) && !x.voided,
      );
      if (ex) ex.qty += it.qty;
      else
        o.items.push({
          menu: m._id,
          name: m.name,
          price: m.price,
          qty: it.qty,
        });
    }
    o.items = o.items.filter((i) => i.qty > 0);
    await o.save();
    res.json(o);
  }),
);
api.post(
  "/pos/orders/:id/void/:itemId",
  allow("pos"),
  wrap(async (req, res) => {
    const o = await own(PosOrder, req.params.id, req);
    const it = o.items.id(req.params.itemId);
    it.voided = true;
    await o.save();
    await audit(
      req,
      "Order item removed",
      `Order #${o.no} · ${it.name} ×${it.qty} · EGP ${it.price * it.qty}`,
      "warn",
    );
    res.json(o);
  }),
);
api.post(
  "/pos/orders/:id/reject",
  allow("pos"),
  wrap(async (req, res) => {
    const o = await own(PosOrder, req.params.id, req);
    if (o.status !== "open") throw new Error("Order is already closed");
    o.status = "rejected";
    await o.save();
    await audit(req, "Order rejected", `Order #${o.no}`, "warn");
    res.json(o);
  }),
);
api.post(
  "/pos/orders/:id/settle",
  allow("pos"),
  wrap(async (req, res) => {
    const o = await own(PosOrder, req.params.id, req);
    res.json(
      await S.settleOrder(o, {
        method: req.body.method,
        bookingId: req.body.bookingId,
        user: req.user.name,
      }),
    );
  }),
);

/* ---------- Stock ---------- */
api.get(
  "/inventory",
  allow("inventory"),
  wrap(async (req, res) =>
    res.json(
      await StockItem.find({ hotel: req.hotel._id })
        .sort("category name")
        .lean(),
    ),
  ),
);
api.post(
  "/inventory/items",
  allow("inventory"),
  wrap(async (req, res) => {
    const {
      name,
      category,
      unit,
      qty = 0,
      reorderLevel = 0,
      cost = 0,
      supplier,
    } = req.body;
    if (!name || !unit) throw new Error("Enter a name and a unit");
    const s = await StockItem.create({
      hotel: req.hotel._id,
      name,
      category,
      unit,
      qty,
      reorderLevel,
      cost,
      supplier,
    });
    await audit(req, "Stock item added", name);
    res.json(s);
  }),
);
api.post(
  "/inventory/purchase",
  allow("inventory"),
  wrap(async (req, res) => {
    for (const l of req.body.lines) await own(StockItem, l.stock, req);
    const j = await S.receivePurchase({
      hotel: req.hotel._id,
      supplier: req.body.supplier,
      payment: req.body.payment,
      lines: req.body.lines,
      user: req.user.name,
    });
    await audit(req, "Purchase received", req.body.supplier);
    res.json(j);
  }),
);
api.post(
  "/inventory/issue",
  allow("inventory"),
  wrap(async (req, res) => {
    await own(StockItem, req.body.stock, req);
    res.json(
      await S.issueStock({
        stock: req.body.stock,
        qty: +req.body.qty,
        user: req.user.name,
      }),
    );
  }),
);

export default api;
