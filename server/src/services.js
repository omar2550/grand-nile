import mongoose from 'mongoose';
import { Account, Journal, FolioEntry, Booking, Room, StockItem, MenuItem, PosOrder, Trip, Counter, nextNo } from './models.js';

export const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
export const today = () => new Date().toLocaleDateString('en-CA'); // local YYYY-MM-DD
export const addDays = (d, n) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
export const nightsBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);
export const oid = (x) => new mongoose.Types.ObjectId(String(x));

export const SERVICE_RATE = 0.12; // service charge
export const VAT_RATE = 0.14;     // VAT on (net + service)
export const taxOf = (net) => { const service = r2(net * SERVICE_RATE); const vat = r2((net + service) * VAT_RATE); return { net: r2(net), service, vat, total: r2(net + service + vat) }; };

const REVENUE = { room: '4100', restaurant: '4200', rooftop: '4210', laundry: '4300', minibar: '4300', spa: '4300', other: '4300', tours: '4400', airport: '4410' };
const CASH = { cash: '1110', card: '1120', transfer: '1120' };

/* ---------- Bulk mode: used only by the seed to write thousands of records quickly ---------- */
let bulk = null;
export async function startBulk(hotelIds) {
  bulk = { journals: [], folio: [], orders: [], no: {}, stock: new Map(), menu: new Map(), dirty: new Set(), nights: new Set() };
  for (const h of hotelIds) { const last = await Journal.findOne({ hotel: h }).sort('-no'); bulk.no[String(h)] = last?.no || 0; }
}
export async function bulkLoad(h) {
  (await StockItem.find({ hotel: h })).forEach((s) => bulk.stock.set(String(s._id), s));
  (await MenuItem.find({ hotel: h })).forEach((m) => bulk.menu.set(String(m._id), m));
}
export const stockNow = async (h) => (bulk ? [...bulk.stock.values()].filter((s) => String(s.hotel) === String(h)) : StockItem.find({ hotel: h }));
export async function flushBulk() {
  const b = bulk; bulk = null;
  const chunks = async (Model, docs) => { for (let i = 0; i < docs.length; i += 1000) await Model.insertMany(docs.slice(i, i + 1000), { ordered: false }); };
  await chunks(Journal, b.journals); await chunks(FolioEntry, b.folio); await chunks(PosOrder, b.orders);
  const ops = [...b.dirty].map((id) => { const s = b.stock.get(id); return { updateOne: { filter: { _id: s._id }, update: { qty: s.qty, cost: s.cost } } }; });
  if (ops.length) await StockItem.bulkWrite(ops);
  for (const [h, seq] of Object.entries(b.no)) await Counter.findByIdAndUpdate('journal:' + h, { seq }, { upsert: true });
}
const keep = async (doc, list) => { if (bulk) bulk[list].push(doc); else await doc.save(); return doc; };
const getStock = async (id) => (bulk ? bulk.stock.get(String(id)) : StockItem.findById(id));
const saveStock = async (s) => { if (bulk) bulk.dirty.add(String(s._id)); else await s.save(); };
const getMenu = async (id) => (bulk ? bulk.menu.get(String(id)) : MenuItem.findById(id));

/* ---------- The double-entry engine: every business event ends here ---------- */
const postable = new Map();
async function postableFor(h) {
  const k = String(h);
  if (!postable.has(k)) postable.set(k, new Set((await Account.find({ hotel: h, isGroup: false }).select('code')).map((a) => a.code)));
  return postable.get(k);
}
export const resetAccountCache = () => postable.clear();

export async function post({ hotel, date = today(), memo, source, ref, user = 'system', lines }) {
  const clean = lines.filter((l) => (l.debit || 0) + (l.credit || 0) > 0).map((l) => ({ code: l.code, debit: r2(l.debit || 0), credit: r2(l.credit || 0) }));
  const dr = r2(clean.reduce((s, l) => s + l.debit, 0)), cr = r2(clean.reduce((s, l) => s + l.credit, 0));
  if (!clean.length || Math.abs(dr - cr) > 0.005) throw new Error(`Entry is not balanced: debit ${dr} and credit ${cr} must be equal`);
  const ok = await postableFor(hotel);
  if (clean.some((l) => !ok.has(l.code))) throw new Error('Unknown account in this entry');
  const k = String(hotel);
  const no = bulk ? (bulk.no[k] = (bulk.no[k] || 0) + 1) : await nextNo('journal:' + k);
  return keep(new Journal({ hotel, no, date, memo, source, ref, user, lines: clean }), 'journals');
}
export const reverseJournal = (j, user) => post({ hotel: j.hotel, memo: `REVERSED: ${j.memo}`, source: 'reversal', ref: `rev:${j._id}`, user, lines: j.lines.map((l) => ({ code: l.code, debit: l.credit, credit: l.debit })) });

/* ---------- Guest bills ---------- */
export async function addCharge({ hotel, booking, dept, description, net, date = today(), nightOf, user, taxed = true }) {
  const t = taxed ? taxOf(net) : { net: r2(net), service: 0, vat: 0, total: r2(net) };
  const e = new FolioEntry({ hotel, booking, kind: 'charge', dept, description, date, nightOf, ...t, user });
  await keep(e, 'folio');
  if (bulk && nightOf) bulk.nights.add(`${booking}|${nightOf}`);
  await post({ hotel, date, memo: description, source: 'folio', ref: String(e._id), user, lines: [
    { code: '1130', debit: t.total }, { code: REVENUE[dept] || '4300', credit: t.net }, { code: '2120', credit: t.service }, { code: '2110', credit: t.vat }] });
  return e;
}
export async function addPayment({ hotel, booking, amount, method = 'cash', date = today(), user, description }) {
  const e = new FolioEntry({ hotel, booking, kind: 'payment', dept: 'payment', description: description || `Payment (${method})`, date, total: r2(amount), method, user });
  await keep(e, 'folio');
  await post({ hotel, date, memo: `Guest payment (${method})`, source: 'folio', ref: String(e._id), user, lines: [{ code: CASH[method] || '1110', debit: amount }, { code: '1130', credit: amount }] });
  return e;
}
export async function folioOf(bookingId) {
  const entries = bulk ? bulk.folio.filter((e) => String(e.booking) === String(bookingId) && !e.voided) : await FolioEntry.find({ booking: bookingId, voided: false }).sort({ date: 1, createdAt: 1 });
  const charges = r2(entries.filter((e) => e.kind === 'charge').reduce((s, e) => s + e.total, 0));
  const payments = r2(entries.filter((e) => e.kind === 'payment').reduce((s, e) => s + e.total, 0));
  return { entries, charges, payments, balance: r2(charges - payments) };
}
export async function voidFolioEntry(e, user) {
  e.voided = true; await e.save();
  for (const j of await Journal.find({ hotel: e.hotel, ref: String(e._id), source: 'folio' })) await reverseJournal(j, user);
}

export async function checkIn(id) {
  const b = await Booking.findById(id).populate('room');
  if (!b || b.status !== 'reserved') throw new Error('Only reserved bookings can be checked in');
  if (b.room.status === 'out_of_order') throw new Error('This room is out of order');
  b.status = 'in_house'; await b.save(); return b;
}
export async function checkOut(id) {
  const b = await Booking.findById(id);
  if (!b || b.status !== 'in_house') throw new Error('This guest is not in the hotel');
  const { balance } = await folioOf(id);
  if (balance > 0.01) throw new Error(`The guest still owes EGP ${balance.toFixed(2)}. Take the payment first.`);
  b.status = 'checked_out'; await b.save();
  await Room.findByIdAndUpdate(b.room, { status: 'dirty' });
  return b;
}
/** Posts one room charge per staying guest for the date. Safe to run twice. */
export async function nightAudit(hotel, date = today(), user = 'system') {
  const stays = await Booking.find({ hotel, status: { $in: ['in_house', 'checked_out'] }, checkIn: { $lte: date }, checkOut: { $gt: date } }).populate('room');
  let posted = 0, total = 0;
  for (const b of stays) {
    const done = bulk ? bulk.nights.has(`${b._id}|${date}`) : await FolioEntry.exists({ booking: b._id, nightOf: date, dept: 'room' });
    if (done) continue;
    await addCharge({ hotel, booking: b._id, dept: 'room', description: `Room ${b.room.number} · night of ${date}`, net: b.rate, date, nightOf: date, user });
    posted++; total += b.rate;
  }
  return { date, posted, netRevenue: r2(total) };
}

/* ---------- Restaurant, rooftop & room service ---------- */
async function consume(hotel, items, date, user, ref) {
  let cost = 0;
  for (const it of items.filter((i) => !i.voided)) {
    const m = await getMenu(it.menu);
    for (const r of m?.recipe || []) {
      const s = await getStock(r.stock); if (!s) continue;
      s.qty = Math.max(0, r2(s.qty - r.qty * it.qty)); cost += s.cost * r.qty * it.qty; await saveStock(s);
    }
  }
  if (cost > 0) await post({ hotel, date, memo: 'Cost of food & drinks sold', source: 'pos', ref, user, lines: [{ code: '5100', debit: cost }, { code: '1140', credit: cost }] });
  return r2(cost);
}
export async function settleOrder(orderOrId, { method, bookingId, date = today(), user }) {
  const o = orderOrId?.items ? orderOrId : await PosOrder.findById(orderOrId);
  if (!o || o.status !== 'open') throw new Error('This order is already closed');
  const live = o.items.filter((i) => !i.voided);
  if (!live.length) throw new Error('The order has no items');
  const net = r2(live.reduce((s, i) => s + i.price * i.qty, 0)); const t = taxOf(net);
  const dept = o.outlet === 'rooftop' ? 'rooftop' : 'restaurant';
  const place = o.tableNo ? `table ${o.tableNo}` : `room ${o.roomNo} service`;
  const label = `${o.outlet === 'rooftop' ? 'Rooftop' : 'Restaurant'} · ${place} · order #${o.no}`;
  if (method === 'room') {
    const b = await Booking.findById(bookingId || o.booking);
    if (!b || b.status !== 'in_house') throw new Error('Choose a guest who is staying in the hotel now');
    await addCharge({ hotel: o.hotel, booking: b._id, dept, description: label, net, date, user });
    o.status = 'room_charged'; o.booking = b._id;
  } else {
    const cash = method === 'card' ? '1120' : dept === 'rooftop' ? '1116' : '1115';
    await post({ hotel: o.hotel, date, memo: `${label} (${method})`, source: 'pos', ref: String(o._id), user, lines: [
      { code: cash, debit: t.total }, { code: REVENUE[dept], credit: t.net }, { code: '2120', credit: t.service }, { code: '2110', credit: t.vat }] });
    o.status = 'paid';
  }
  o.method = method; o.net = net; o.total = t.total; o.date = date;
  await keep(o, 'orders');
  await consume(o.hotel, o.items, date, user, String(o._id));
  return o;
}

/* ---------- Stock & purchasing ---------- */
export async function receivePurchase({ hotel, supplier, lines, payment = 'credit', date = today(), user }) {
  const by = { kitchen: 0, beverage: 0, housekeeping: 0 };
  for (const l of lines) {
    const s = await getStock(l.stock); if (!s) throw new Error('Unknown stock item');
    const value = l.qty * l.cost; by[s.category] += value;
    s.cost = r2((s.cost * s.qty + value) / (s.qty + l.qty)); s.qty = r2(s.qty + l.qty); await saveStock(s);
  }
  const fb = r2(by.kitchen + by.beverage), hk = r2(by.housekeeping);
  const from = { credit: '2100', bank: '1120', cash: '1110' }[payment] || '2100';
  return post({ hotel, date, memo: `Purchase – ${supplier}`, source: 'purchasing', user, lines: [{ code: '1140', debit: fb }, { code: '1150', debit: hk }, { code: from, credit: fb + hk }] });
}
export async function issueStock({ stock, qty, date = today(), user }) {
  const s = await getStock(stock); if (!s || s.qty < qty) throw new Error('There is not enough in stock');
  s.qty = r2(s.qty - qty); await saveStock(s);
  const v = r2(qty * s.cost), hk = s.category === 'housekeeping';
  await post({ hotel: s.hotel, date, memo: `Issued ${qty} ${s.unit} of ${s.name}`, source: 'inventory', user, lines: [{ code: hk ? '6400' : '5100', debit: v }, { code: hk ? '1150' : '1140', credit: v }] });
  return s;
}
export const payCompany = ({ hotel, amount, method = 'cash', memo, date = today(), user, ref }) =>
  post({ hotel, date, memo, source: 'payment', ref, user, lines: [{ code: '2100', debit: amount }, { code: method === 'cash' ? '1110' : '1120', credit: amount }] });

/* ---------- Trips & airport rides ---------- */
export async function createTrip(d) {
  const { hotel, kind, title, date = today(), pax = 1, price = 0, payment = 'room', user } = d;
  const t = new Trip({ hotel, kind, title, destination: d.destination, date, time: d.time, company: d.company, driver: d.driver, guestName: d.guestName, pax,
    price: r2(price), companyCost: r2(d.companyCost || 0), transportCost: r2(d.transportCost || 0), payment, notes: d.notes, createdBy: user });
  const dept = kind === 'airport' ? 'airport' : 'tours';
  if (payment === 'room') {
    const b = await Booking.findById(d.bookingId).populate('guest');
    if (!b || !['in_house', 'reserved'].includes(b.status)) throw new Error('Choose a guest who is staying (or booked) to charge the room');
    const e = await addCharge({ hotel, booking: b._id, dept, description: `${title}${pax > 1 ? ` · ${pax} guests` : ''}`, net: price, date, user, taxed: false });
    t.booking = b._id; t.folioEntry = e._id; t.guestName = b.guest?.name;
  } else if (price > 0) {
    await post({ hotel, date, memo: `${kind === 'airport' ? 'Airport ride' : 'Tour'}: ${title}`, source: 'trip', ref: String(t._id), user,
      lines: [{ code: payment === 'card' ? '1120' : '1110', debit: price }, { code: REVENUE[dept], credit: price }] });
  }
  const cost = r2(t.companyCost + t.transportCost);
  if (cost > 0) await post({ hotel, date, memo: `Trip cost: ${title}`, source: 'trip', ref: String(t._id), user, lines: [{ code: '5200', debit: t.companyCost }, { code: '5210', debit: t.transportCost }, { code: '2100', credit: cost }] });
  await t.save(); return t;
}
export async function payTripCosts(t, { method = 'cash', date = today(), user }) {
  const cost = r2(t.companyCost + t.transportCost);
  if (t.status === 'cancelled') throw new Error('This trip is cancelled');
  if (t.costPaid || cost <= 0) throw new Error('Nothing left to pay for this trip');
  await payCompany({ hotel: t.hotel, amount: cost, method, memo: `Paid ${t.company || t.driver || 'trip company'} for: ${t.title}`, date, user, ref: `pay:${t._id}` });
  t.costPaid = true; await t.save(); return t;
}
export async function cancelTrip(t, user) {
  if (t.status === 'cancelled') throw new Error('Already cancelled');
  const refs = [String(t._id), `pay:${t._id}`]; if (t.folioEntry) refs.push(String(t.folioEntry));
  for (const j of await Journal.find({ hotel: t.hotel, ref: { $in: refs }, source: { $ne: 'reversal' } })) await reverseJournal(j, user);
  if (t.folioEntry) await FolioEntry.findByIdAndUpdate(t.folioEntry, { voided: true });
  t.status = 'cancelled'; await t.save(); return t;
}

/* ---------- Financial reports ---------- */
export async function balances(h, { from = '0000', to = '9999' } = {}) {
  const rows = await Journal.aggregate([{ $match: { hotel: oid(h), date: { $gte: from, $lte: to } } }, { $unwind: '$lines' },
    { $group: { _id: '$lines.code', debit: { $sum: '$lines.debit' }, credit: { $sum: '$lines.credit' } } }]);
  const map = Object.fromEntries(rows.map((r) => [r._id, r]));
  const accounts = await Account.find({ hotel: h, isGroup: false }).sort('code').lean();
  return accounts.map((a) => {
    const d = map[a.code]?.debit || 0, c = map[a.code]?.credit || 0;
    return { ...a, debit: r2(d), credit: r2(c), balance: r2(['asset', 'expense'].includes(a.type) ? d - c : c - d) };
  });
}
export async function incomeStatement(h, range) {
  const b = await balances(h, range); const tot = (a) => r2(a.reduce((s, x) => s + x.balance, 0));
  const revenue = b.filter((x) => x.type === 'revenue' && x.balance);
  const costs = b.filter((x) => x.type === 'expense' && x.code.startsWith('5') && x.balance);
  const opex = b.filter((x) => x.type === 'expense' && !x.code.startsWith('5') && x.balance);
  const totalRevenue = tot(revenue), totalCosts = tot(costs), totalOpex = tot(opex);
  return { revenue, costs, opex, totalRevenue, totalCosts, grossProfit: r2(totalRevenue - totalCosts), totalOpex, netIncome: r2(totalRevenue - totalCosts - totalOpex) };
}
export async function balanceSheet(h, to) {
  const b = await balances(h, { to }); const inc = await incomeStatement(h, { to });
  const pick = (t) => b.filter((x) => x.type === t && x.balance); const tot = (a) => r2(a.reduce((s, x) => s + x.balance, 0));
  const assets = pick('asset'), liabilities = pick('liability'), equity = pick('equity');
  return { assets, liabilities, equity, currentEarnings: inc.netIncome, totalAssets: tot(assets), totalLiabilities: tot(liabilities), totalEquity: r2(tot(equity) + inc.netIncome) };
}
