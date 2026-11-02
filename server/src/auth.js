import jwt from "jsonwebtoken";
import { User, Hotel, Audit } from "./models.js";

const ALL = ["pms", "pos", "accounting", "inventory", "trips", "qr"];
export const MODULES = {
  owner: [...ALL, "admin", "group"],
  admin: [...ALL, "admin"],
  manager: ALL,
  front_desk: ["pms", "trips", "qr"],
  cashier: ["pos", "qr"],
  accountant: ["accounting", "inventory", "trips"],
  storekeeper: ["inventory"],
};

//
const secret = () => process.env.JWT_SECRET || "dev-secret";
export const sign = (u) =>
  jwt.sign({ id: u._id }, secret(), { expiresIn: "12h" });

//
export const wrap = (fn) => (req, res) =>
  fn(req, res).catch((e) => res.status(400).json({ error: e.message }));

export async function authenticate(req, res, next) {
  try {
    const { id } = jwt.verify(
      (req.headers.authorization || "").replace("Bearer ", ""),
      secret(),
    );
    const user = await User.findById(id);
    if (!user?.active) throw new Error("inactive");
    const hotels = await Hotel.find(
      user.role === "owner"
        ? { active: true }
        : { _id: { $in: user.hotels }, active: true },
    ).sort("name");
    if (!hotels.length) throw new Error("no hotel");
    req.user = user;
    req.hotels = hotels;
    req.hotel =
      hotels.find((h) => String(h._id) === req.headers["x-hotel"]) || hotels[0];
    next();
  } catch {
    res.status(401).json({ error: "Please sign in again" });
  }
}
export const audit = (req, action, detail = "", severity = "info") =>
  Audit.create({
    hotel: req.hotel?._id,
    user: req.user?.name || "anonymous",
    role: req.user?.role,
    action,
    detail,
    severity,
  }).catch(() => {});
export const allow =
  (...mods) =>
  (req, res, next) =>
    mods.some((m) => MODULES[req.user.role]?.includes(m))
      ? next()
      : (audit(
          req,
          "Blocked: tried to open a page without permission",
          `${req.method} ${req.originalUrl}`,
          "warn",
        ),
        res.status(403).json({ error: "Your job role cannot open this area" }));

export const roles =
  (...r) =>
  (req, res, next) =>
    r.includes(req.user.role)
      ? next()
      : res
          .status(403)
          .json({ error: "Only a manager or administrator can do this" });
          
/** Loads a record only if it belongs to the hotel the user is working in. */
export const own = async (Model, id, req) => {
  const d = await Model.findOne({ _id: id, hotel: req.hotel._id });
  if (!d) throw new Error("Record not found in this hotel");
  return d;
};
