import { Account, Journal, FolioEntry, Booking, Room, PosOrder, MenuItem, StockItem, Trip } from './models.js';
import { r2, addDays, today, nightsBetween, oid } from './services.js';
import { CASH_CODES } from './chart.js';

const names = async (h) => Object.fromEntries((await Account.find({ hotel: h }).lean()).map((a) => [a.code, a.name]));
const span = (from, to) => { if (!from || !to || to < from) throw new Error('Choose a valid date range'); if (nightsBetween(from, to) > 400) throw new Error('Please choose 400 days or fewer'); };

/** Daily cashbox: opening, money in, money out, closing for each day and each cash drawer. */
export async function money(h, from, to) {
  span(from, to);
  const nm = await names(h);
  const opening = await Journal.aggregate([{ $match: { hotel: oid(h), date: { $lt: from } } }, { $unwind: '$lines' }, { $match: { 'lines.code': { $in: CASH_CODES } } },
    { $group: { _id: '$lines.code', net: { $sum: { $subtract: ['$lines.debit', '$lines.credit'] } } } }]);
  const bal = Object.fromEntries(CASH_CODES.map((c) => [c, r2(opening.find((o) => o._id === c)?.net || 0)]));
  const open0 = { ...bal };
  const journals = await Journal.find({ hotel: h, date: { $gte: from, $lte: to } }).sort({ date: 1, no: 1 }).lean();
  const moves = [], byDate = new Map();
  for (const j of journals) for (const l of j.lines) if (CASH_CODES.includes(l.code)) {
    const m = { date: j.date, no: j.no, memo: j.memo, source: j.source, code: l.code, drawer: nm[l.code], cashIn: l.debit, cashOut: l.credit };
    moves.push(m); (byDate.get(j.date) || byDate.set(j.date, []).get(j.date)).push(m);
  }
  const days = []; const drawers = CASH_CODES.map((c) => ({ code: c, name: nm[c], opening: open0[c], cashIn: 0, cashOut: 0, closing: 0 }));
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const opn = r2(Object.values(bal).reduce((s, v) => s + v, 0)); let i = 0, o = 0;
    for (const m of byDate.get(d) || []) { i += m.cashIn; o += m.cashOut; bal[m.code] = r2(bal[m.code] + m.cashIn - m.cashOut); const dr = drawers.find((x) => x.code === m.code); dr.cashIn += m.cashIn; dr.cashOut += m.cashOut; }
    days.push({ date: d, opening: opn, cashIn: r2(i), cashOut: r2(o), closing: r2(opn + i - o) });
  }
  drawers.forEach((d) => { d.cashIn = r2(d.cashIn); d.cashOut = r2(d.cashOut); d.closing = r2(bal[d.code]); });
  const sumDebit = (j) => r2(j.lines.reduce((s, l) => s + l.debit, 0));
  const how = (j) => { const c = j.lines.find((l) => l.credit > 0 && !['1130'].includes(l.code))?.code; return c === '2100' ? 'On credit (we owe the supplier)' : c === '1120' ? 'Paid from bank' : 'Paid in cash'; };
  const purchases = journals.filter((j) => ['purchasing', 'payment'].includes(j.source)).map((j) => ({ date: j.date, no: j.no, type: j.source === 'purchasing' ? 'Purchase' : 'Payment to supplier / company', memo: j.memo, amount: sumDebit(j), paidBy: j.source === 'purchasing' ? how(j) : j.lines.find((l) => l.credit > 0)?.code === '1120' ? 'Paid from bank' : 'Paid in cash' }));
  const expenses = journals.filter((j) => j.source === 'expense').map((j) => ({ date: j.date, no: j.no, memo: j.memo, account: nm[j.lines.find((l) => l.debit > 0)?.code], amount: sumDebit(j), paidFrom: nm[j.lines.find((l) => l.credit > 0)?.code] }));
  return { days, drawers, moves, purchases, expenses,
    totals: { cashIn: r2(days.reduce((s, d) => s + d.cashIn, 0)), cashOut: r2(days.reduce((s, d) => s + d.cashOut, 0)), purchases: r2(purchases.reduce((s, p) => s + p.amount, 0)), expenses: r2(expenses.reduce((s, p) => s + p.amount, 0)) } };
}

/** Guest accounts: how many guests, what they paid, what is left. */
export async function guestAccounts(h, { status = 'in_house', from, to } = {}) {
  const f = { hotel: h, status: status === 'all' ? { $in: ['reserved', 'in_house', 'checked_out'] } : status };
  if (status !== 'in_house' && from && to) { f.checkIn = { $lte: to }; f.checkOut = { $gt: from }; }
  const bookings = await Booking.find(f).populate('guest room').lean();
  const sums = await FolioEntry.aggregate([{ $match: { hotel: oid(h), voided: false, booking: { $in: bookings.map((b) => b._id) } } }, { $group: { _id: { b: '$booking', k: '$kind' }, t: { $sum: '$total' } } }]);
  const get = (id, k) => sums.find((s) => String(s._id.b) === String(id) && s._id.k === k)?.t || 0;
  const rows = bookings.map((b) => { const charges = r2(get(b._id, 'charge')), paid = r2(get(b._id, 'payment'));
    return { code: b.code, guest: b.guest?.name, nationality: b.guest?.nationality, room: b.room?.number, roomType: b.room?.type, checkIn: b.checkIn, checkOut: b.checkOut, status: b.status,
      nights: nightsBetween(b.checkIn, b.checkOut), people: (b.adults || 0) + (b.children || 0), charges, paid, remaining: r2(charges - paid) }; })
    .sort((a, b) => String(a.room).localeCompare(String(b.room), undefined, { numeric: true }) || a.checkIn.localeCompare(b.checkIn));
  const sum = (k) => r2(rows.reduce((s, r) => s + r[k], 0));
  return { rows, totals: { bookings: rows.length, people: sum('people'), charges: sum('charges'), paid: sum('paid'), remaining: sum('remaining') } };
}

/** Room accounts: who is in each room, arrivals/departures, nights sold and income. */
export async function roomsReport(h, from, to) {
  span(from, to);
  const rooms = await Room.find({ hotel: h }).sort('number').lean();
  const charges = await FolioEntry.find({ hotel: h, dept: 'room', kind: 'charge', voided: false, date: { $gte: from, $lte: to } }).select('booking net').lean();
  const bks = await Booking.find({ _id: { $in: [...new Set(charges.map((c) => String(c.booking)))] } }).select('room').lean();
  const roomOf = Object.fromEntries(bks.map((b) => [String(b._id), String(b.room)]));
  const cur = await Booking.find({ hotel: h, status: 'in_house' }).populate('guest', 'name').lean();
  const next = await Booking.find({ hotel: h, status: 'reserved', checkIn: { $gte: today() } }).sort('checkIn').populate('guest', 'name').lean();
  const days = nightsBetween(from, to) + 1;
  const rows = rooms.map((r) => { const mine = charges.filter((c) => roomOf[String(c.booking)] === String(r._id)); const g = cur.find((b) => String(b.room) === String(r._id)); const n = next.find((b) => String(b.room) === String(r._id));
    return { room: r.number, type: r.type, status: r.status, guest: g?.guest?.name || '', arrives: g?.checkIn || '', leaves: g?.checkOut || '', nextGuest: n ? `${n.guest?.name} (${n.checkIn})` : '', nights: mine.length, income: r2(mine.reduce((s, c) => s + c.net, 0)), occupancyPct: Math.round((mine.length / days) * 100) }; });
  return { rows, totals: { rooms: rows.length, nights: rows.reduce((s, r) => s + r.nights, 0), income: r2(rows.reduce((s, r) => s + r.income, 0)), occupiedNow: cur.length } };
}

/** Items sold and what is left in stock. */
export async function sales(h, from, to) {
  span(from, to);
  const sold = await PosOrder.aggregate([{ $match: { hotel: oid(h), status: { $in: ['paid', 'room_charged'] }, date: { $gte: from, $lte: to } } }, { $unwind: '$items' }, { $match: { 'items.voided': { $ne: true } } },
    { $group: { _id: { menu: '$items.menu', outlet: '$outlet' }, qty: { $sum: '$items.qty' }, revenue: { $sum: { $multiply: ['$items.qty', '$items.price'] } } } }]);
  const menu = await MenuItem.find({ hotel: h }).lean(); const stock = await StockItem.find({ hotel: h }).lean(); const sm = Object.fromEntries(stock.map((s) => [String(s._id), s]));
  const rows = menu.map((m) => { const mine = sold.filter((s) => String(s._id.menu) === String(m._id));
    const left = (m.recipe || []).filter((r) => r.qty > 0).map((r) => Math.floor((sm[String(r.stock)]?.qty || 0) / r.qty));
    return { name: m.name, category: m.category, outlets: (m.outlets || []).join(', '), price: m.price, qty: mine.reduce((s, x) => s + x.qty, 0), revenue: r2(mine.reduce((s, x) => s + x.revenue, 0)), portionsLeft: left.length ? Math.min(...left) : null }; })
    .sort((a, b) => b.qty - a.qty);
  const byOutlet = { restaurant: 0, rooftop: 0, room: 0 }; sold.forEach((s) => { byOutlet[s._id.outlet] = r2((byOutlet[s._id.outlet] || 0) + s.revenue); });
  const stockRows = stock.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)).map((s) => ({ name: s.name, category: s.category, unit: s.unit, qty: s.qty, reorderLevel: s.reorderLevel, cost: s.cost, value: r2(s.qty * s.cost), low: s.qty <= s.reorderLevel }));
  return { rows, stock: stockRows, byOutlet, totals: { qty: rows.reduce((s, r) => s + r.qty, 0), revenue: r2(rows.reduce((s, r) => s + r.revenue, 0)), stockValue: r2(stockRows.reduce((s, r) => s + r.value, 0)) } };
}

export async function tripsReport(h, from, to) {
  span(from, to);
  const trips = await Trip.find({ hotel: h, date: { $gte: from, $lte: to } }).sort({ date: 1, time: 1 }).lean();
  const rows = trips.map((t) => { const cost = r2(t.companyCost + t.transportCost); const on = t.status !== 'cancelled';
    return { id: t._id, date: t.date, time: t.time, kind: t.kind, title: t.title, destination: t.destination, company: t.company, driver: t.driver, guest: t.guestName, pax: t.pax, payment: t.payment,
      price: t.price, companyCost: t.companyCost, transportCost: t.transportCost, cost, profit: on ? r2(t.price - cost) : 0, status: t.status, costPaid: t.costPaid, owed: on && !t.costPaid ? cost : 0 }; });
  const live = rows.filter((r) => r.status !== 'cancelled'); const sum = (k) => r2(live.reduce((s, r) => s + r[k], 0));
  const companies = {}; live.forEach((r) => { const k = r.company || r.driver || 'Hotel car / no company'; (companies[k] ||= { company: k, trips: 0, cost: 0, owed: 0 }); companies[k].trips++; companies[k].cost = r2(companies[k].cost + r.cost); companies[k].owed = r2(companies[k].owed + r.owed); });
  return { rows, companies: Object.values(companies), totals: { trips: live.length, pax: live.reduce((s, r) => s + r.pax, 0), income: sum('price'), cost: sum('cost'), profit: sum('profit'), owed: sum('owed') } };
}
