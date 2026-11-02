import mongoose from "mongoose";
const { Schema, model } = mongoose;
const ref = (to) => ({ type: Schema.Types.ObjectId, ref: to });
const hotel = { hotel: { ...ref("Hotel"), index: true } };

export const Hotel = model(
  "Hotel",
  new Schema(
    {
      name: String,
      code: { type: String, unique: true },
      slug: { type: String, unique: true },
      city: String,
      phone: String,
      publicUrl: { type: String, default: "" },
      active: { type: Boolean, default: true },
    },
    { timestamps: true },
  ),
);

export const User = model(
  "User",
  new Schema(
    {
      name: String,
      email: { type: String, unique: true },
      passwordHash: String,
      role: {
        type: String,
        enum: [
          "owner",
          "admin",
          "manager",
          "front_desk",
          "cashier",
          "accountant",
          "storekeeper",
        ],
      },
      hotels: [ref("Hotel")],
      active: { type: Boolean, default: true },
    },
    { timestamps: true },
  ),
);

const roomSchema = new Schema({
  ...hotel,
  number: String,
  floor: Number,
  type: String,
  view: String,
  rate: Number,
  beds: String,
  status: {
    type: String,
    enum: ["clean", "dirty", "inspected", "out_of_order"],
    default: "clean",
  },
});
roomSchema.index({ hotel: 1, number: 1 }, { unique: true });
export const Room = model("Room", roomSchema);

export const Guest = model(
  "Guest",
  new Schema(
    {
      ...hotel,
      name: String,
      phone: String,
      email: String,
      nationality: String,
      idNumber: String,
      vip: { type: Boolean, default: false },
      notes: String,
    },
    { timestamps: true },
  ),
);

export const Booking = model(
  "Booking",
  new Schema(
    {
      ...hotel,
      code: { type: String, unique: true },
      guest: ref("Guest"),
      room: ref("Room"),
      checkIn: String,
      checkOut: String,
      adults: { type: Number, default: 2 },
      children: { type: Number, default: 0 },
      rate: Number,
      source: { type: String, default: "Direct" },
      board: { type: String, default: "BB" },
      status: {
        type: String,
        enum: ["reserved", "in_house", "checked_out", "cancelled"],
        default: "reserved",
      },
      notes: String,
    },
    { timestamps: true },
  ),
);

export const FolioEntry = model(
  "FolioEntry",
  new Schema(
    {
      ...hotel,
      booking: { ...ref("Booking"), index: true },
      kind: { type: String, enum: ["charge", "payment"] },
      dept: String,
      description: String,
      date: String,
      nightOf: String,
      net: Number,
      service: Number,
      vat: Number,
      total: Number,
      method: String,
      voided: { type: Boolean, default: false },
      user: String,
    },
    { timestamps: true },
  ),
);

const accountSchema = new Schema({
  ...hotel,
  code: String,
  name: String,
  type: {
    type: String,
    enum: ["asset", "liability", "equity", "revenue", "expense"],
  },
  parent: String,
  isGroup: { type: Boolean, default: false },
});
accountSchema.index({ hotel: 1, code: 1 }, { unique: true });
export const Account = model("Account", accountSchema);

const journalSchema = new Schema(
  {
    ...hotel,
    no: Number,
    date: String,
    memo: String,
    source: String,
    ref: String,
    user: String,
    lines: [
      {
        code: String,
        debit: { type: Number, default: 0 },
        credit: { type: Number, default: 0 },
        _id: false,
      },
    ],
  },
  { timestamps: true },
);
journalSchema.index({ hotel: 1, date: 1 });
journalSchema.index({ hotel: 1, ref: 1 });
export const Journal = model("Journal", journalSchema);

export const StockItem = model(
  "StockItem",
  new Schema({
    ...hotel,
    name: String,
    category: { type: String, enum: ["kitchen", "beverage", "housekeeping"] },
    unit: String,
    qty: Number,
    reorderLevel: Number,
    cost: Number,
    supplier: String,
  }),
);

export const MenuItem = model(
  "MenuItem",
  new Schema({
    ...hotel,
    name: String,
    category: String,
    price: Number,
    emoji: String,
    desc: { type: String, default: "" },
    outlets: [String],
    available: { type: Boolean, default: true },
    recipe: [{ stock: ref("StockItem"), qty: Number, _id: false }],
  }),
);

export const Table = model(
  "Table",
  new Schema({
    ...hotel,
    outlet: { type: String, default: "restaurant" },
    number: Number,
    seats: Number,
    zone: String,
    x: Number,
    y: Number,
  }),
);

export const PosOrder = model(
  "PosOrder",
  new Schema(
    {
      ...hotel,
      no: Number,
      outlet: { type: String, default: "restaurant" },
      table: ref("Table"),
      tableNo: Number,
      roomNo: String,
      waiter: String,
      items: [
        {
          menu: ref("MenuItem"),
          name: String,
          price: Number,
          qty: Number,
          voided: { type: Boolean, default: false },
          fromQr: { type: Boolean, default: false },
        },
      ],
      status: {
        type: String,
        enum: ["open", "paid", "room_charged", "rejected"],
        default: "open",
      },
      booking: ref("Booking"),
      method: String,
      net: Number,
      total: Number,
      date: String,
      qr: { type: Boolean, default: false },
      guestName: String,
      note: String,
    },
    { timestamps: true },
  ),
);

export const Trip = model(
  "Trip",
  new Schema(
    {
      ...hotel,
      kind: { type: String, enum: ["tour", "airport"] },
      title: String,
      destination: String,
      date: String,
      time: String,
      company: String,
      driver: String,
      booking: ref("Booking"),
      folioEntry: ref("FolioEntry"),
      guestName: String,
      pax: { type: Number, default: 1 },
      price: { type: Number, default: 0 },
      companyCost: { type: Number, default: 0 },
      transportCost: { type: Number, default: 0 },
      payment: { type: String, default: "room" },
      status: {
        type: String,
        enum: ["planned", "done", "cancelled"],
        default: "planned",
      },
      costPaid: { type: Boolean, default: false },
      notes: String,
      createdBy: String,
    },
    { timestamps: true },
  ),
);

export const Audit = model(
  "Audit",
  new Schema(
    {
      hotel: ref("Hotel"),
      user: String,
      role: String,
      action: String,
      detail: String,
      severity: { type: String, default: "info" },
    },
    { timestamps: true },
  ),
);

export const Counter = model(
  "Counter",
  new Schema({ _id: String, seq: { type: Number, default: 0 } }),
);
export const nextNo = async (key) =>
  (
    await Counter.findByIdAndUpdate(
      key,
      { $inc: { seq: 1 } },
      { new: true, upsert: true },
    )
  ).seq;
