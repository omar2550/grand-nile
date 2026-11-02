import ExcelJS from 'exceljs';
import * as R from './reports.js';
import * as S from './services.js';
import { Journal, Account } from './models.js';

const SOURCE = { folio: 'Guest bill', pos: 'Restaurant / Rooftop', purchasing: 'Purchase', expense: 'Expense', payment: 'Payment to supplier / company', trip: 'Trip', opening: 'Opening balance', manual: 'Manual entry', inventory: 'Stock issued', reversal: 'Reversal', void: 'Cancelled entry' };
const FMT = '#,##0.00';

function sheet(wb, name, title, cols, rows, totals) {
  const ws = wb.addWorksheet(name.slice(0, 31), { views: [{ state: 'frozen', ySplit: 3 }] });
  ws.columns = cols.map((c) => ({ key: c.key, width: c.width || 16 }));
  ws.getCell('A1').value = title; ws.getCell('A1').font = { bold: true, size: 14 };
  const hr = ws.getRow(3); hr.values = cols.map((c) => c.header);
  hr.eachCell((c) => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0C3B44' } }; c.alignment = { vertical: 'middle', wrapText: true }; });
  rows.forEach((r) => ws.addRow(r));
  if (totals) { const t = ws.addRow(totals); t.font = { bold: true }; t.eachCell((c) => { c.border = { top: { style: 'thin' } }; }); }
  ws.eachRow((row, n) => { if (n > 3) cols.forEach((c, i) => { if (c.type === 'money') row.getCell(i + 1).numFmt = FMT; }); });
  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: cols.length } };
  return ws;
}
const col = (header, key, type, width) => ({ header, key, type, width });

export async function buildExport(kind, hotel, q) {
  const h = hotel._id, today = S.today();
  const from = q.from || S.addDays(today, -30), to = q.to || today;
  const period = `${from} to ${to}`; const head = (t) => `${hotel.name} – ${t}`;
  const wb = new ExcelJS.Workbook(); wb.creator = hotel.name; wb.created = new Date();
  let name = kind;
  if (kind === 'journal') {
    const nm = Object.fromEntries((await Account.find({ hotel: h }).lean()).map((a) => [a.code, a.name]));
    const js = await Journal.find({ hotel: h, date: { $gte: from, $lte: to } }).sort({ date: 1, no: 1 }).lean(); const rows = [];
    js.forEach((j) => j.lines.forEach((l) => rows.push({ no: j.no, date: j.date, memo: j.memo, source: SOURCE[j.source] || j.source, code: l.code, account: nm[l.code], debit: l.debit, credit: l.credit })));
    sheet(wb, 'Daily entries', head(`Daily entries (journal) ${period}`), [col('Entry no.', 'no', 'int', 10), col('Date', 'date', 'text', 12), col('What happened', 'memo', 'text', 46), col('From', 'source', 'text', 24), col('Account code', 'code', 'text', 12), col('Account', 'account', 'text', 40), col('Debit', 'debit', 'money'), col('Credit', 'credit', 'money')], rows,
      { memo: 'TOTAL', debit: rows.reduce((s, r) => s + r.debit, 0), credit: rows.reduce((s, r) => s + r.credit, 0) });
  } else if (kind === 'trial-balance') {
    const rows = (await S.balances(h, { from, to })).filter((r) => r.debit || r.credit);
    sheet(wb, 'Trial balance', head(`Trial balance ${period}`), [col('Code', 'code', 'text', 10), col('Account', 'name', 'text', 46), col('Debit', 'debit', 'money'), col('Credit', 'credit', 'money'), col('Balance', 'balance', 'money')], rows,
      { name: 'TOTAL', debit: rows.reduce((s, r) => s + r.debit, 0), credit: rows.reduce((s, r) => s + r.credit, 0) });
  } else if (kind === 'income') {
    const i = await S.incomeStatement(h, { from, to }); const rows = [];
    const sec = (t, list, total, sign = 1) => { rows.push({ item: t, amount: null }); list.forEach((a) => rows.push({ item: `   ${a.name}`, amount: a.balance * sign })); rows.push({ item: `Total ${t.toLowerCase()}`, amount: total * sign }); };
    sec('Income', i.revenue, i.totalRevenue); sec('Direct costs', i.costs, i.totalCosts, -1); rows.push({ item: 'GROSS PROFIT', amount: i.grossProfit });
    sec('Running expenses', i.opex, i.totalOpex, -1); rows.push({ item: 'NET PROFIT', amount: i.netIncome });
    sheet(wb, 'Profit & loss', head(`Profit & loss ${period}`), [col('Item', 'item', 'text', 54), col('Amount (EGP)', 'amount', 'money', 20)], rows);
  } else if (kind === 'balance-sheet') {
    const b = await S.balanceSheet(h, to); const rows = [{ item: 'WHAT THE HOTEL OWNS', amount: null }];
    b.assets.forEach((a) => rows.push({ item: `   ${a.name}`, amount: a.balance })); rows.push({ item: 'Total owned', amount: b.totalAssets }, { item: 'WHAT THE HOTEL OWES', amount: null });
    b.liabilities.forEach((a) => rows.push({ item: `   ${a.name}`, amount: a.balance })); rows.push({ item: 'OWNERS’ MONEY', amount: null });
    b.equity.forEach((a) => rows.push({ item: `   ${a.name}`, amount: a.balance })); rows.push({ item: '   Profit so far', amount: b.currentEarnings }, { item: 'Total owed + owners’ money', amount: b.totalLiabilities + b.totalEquity });
    sheet(wb, 'Balance sheet', head(`Balance sheet on ${to}`), [col('Item', 'item', 'text', 54), col('Amount (EGP)', 'amount', 'money', 20)], rows);
  } else if (kind === 'money') {
    name = 'cash-purchases-expenses'; const m = await R.money(h, from, to);
    sheet(wb, 'Daily cashbox', head(`Daily cashbox ${period}`), [col('Date', 'date', 'text', 12), col('Cash at start of day', 'opening', 'money', 22), col('Money in', 'cashIn', 'money'), col('Money out', 'cashOut', 'money'), col('Cash at end of day', 'closing', 'money', 22)], m.days, { date: 'TOTAL', cashIn: m.totals.cashIn, cashOut: m.totals.cashOut });
    sheet(wb, 'By cash drawer', head(`Cash drawers ${period}`), [col('Cash drawer', 'name', 'text', 30), col('At start', 'opening', 'money'), col('Money in', 'cashIn', 'money'), col('Money out', 'cashOut', 'money'), col('At end', 'closing', 'money')], m.drawers);
    sheet(wb, 'Cash movements', head(`Every cash movement ${period}`), [col('Date', 'date', 'text', 12), col('Entry no.', 'no', 'int', 10), col('What happened', 'memo', 'text', 50), col('From', 'source', 'text', 26), col('Cash drawer', 'drawer', 'text', 24), col('Money in', 'cashIn', 'money'), col('Money out', 'cashOut', 'money')], m.moves.map((x) => ({ ...x, source: SOURCE[x.source] || x.source })));
    sheet(wb, 'Purchases', head(`Purchases & supplier payments ${period}`), [col('Date', 'date', 'text', 12), col('Entry no.', 'no', 'int', 10), col('Type', 'type', 'text', 30), col('Details', 'memo', 'text', 50), col('Amount', 'amount', 'money'), col('How paid', 'paidBy', 'text', 30)], m.purchases, { memo: 'TOTAL', amount: m.totals.purchases });
    sheet(wb, 'Expenses', head(`Expenses ${period}`), [col('Date', 'date', 'text', 12), col('Entry no.', 'no', 'int', 10), col('What for', 'memo', 'text', 50), col('Expense type', 'account', 'text', 36), col('Amount', 'amount', 'money'), col('Paid from', 'paidFrom', 'text', 26)], m.expenses, { memo: 'TOTAL', amount: m.totals.expenses });
  } else if (kind === 'guests') {
    const g = await R.guestAccounts(h, { status: q.status || 'in_house', from, to });
    sheet(wb, 'Guest accounts', head(`Guest accounts (${q.status || 'in_house'}) ${period}`), [col('Booking', 'code', 'text', 12), col('Guest', 'guest', 'text', 26), col('Nationality', 'nationality', 'text', 18), col('Room', 'room', 'text', 8), col('Arrives', 'checkIn', 'text', 12), col('Leaves', 'checkOut', 'text', 12), col('Nights', 'nights', 'int', 8), col('People', 'people', 'int', 8), col('Status', 'status', 'text', 12), col('Total bill', 'charges', 'money'), col('Paid', 'paid', 'money'), col('Still owed', 'remaining', 'money')], g.rows,
      { guest: 'TOTAL', people: g.totals.people, charges: g.totals.charges, paid: g.totals.paid, remaining: g.totals.remaining });
  } else if (kind === 'rooms') {
    const r = await R.roomsReport(h, from, to);
    sheet(wb, 'Rooms', head(`Room accounts ${period}`), [col('Room', 'room', 'text', 8), col('Type', 'type', 'text', 16), col('Cleaning status', 'status', 'text', 16), col('Guest now', 'guest', 'text', 26), col('Arrived', 'arrives', 'text', 12), col('Leaves', 'leaves', 'text', 12), col('Next guest', 'nextGuest', 'text', 32), col('Nights sold', 'nights', 'int', 12), col('Room income', 'income', 'money'), col('Busy %', 'occupancyPct', 'int', 10)], r.rows, { room: 'TOTAL', nights: r.totals.nights, income: r.totals.income });
  } else if (kind === 'sales') {
    name = 'sales-and-stock'; const s = await R.sales(h, from, to);
    sheet(wb, 'Items sold', head(`Items sold ${period}`), [col('Item', 'name', 'text', 32), col('Group', 'category', 'text', 14), col('Sold in', 'outlets', 'text', 24), col('Price', 'price', 'money', 12), col('Quantity sold', 'qty', 'int', 14), col('Sales (before tax)', 'revenue', 'money', 18), col('Portions left in stock', 'portionsLeft', 'int', 22)], s.rows, { name: 'TOTAL', qty: s.totals.qty, revenue: s.totals.revenue });
    sheet(wb, 'Stock left', head(`Stock on hand on ${today}`), [col('Item', 'name', 'text', 32), col('Group', 'category', 'text', 14), col('Unit', 'unit', 'text', 8), col('In stock', 'qty', 'int', 12), col('Reorder at', 'reorderLevel', 'int', 12), col('Average cost', 'cost', 'money'), col('Value', 'value', 'money')], s.stock, { name: 'TOTAL', value: s.totals.stockValue });
  } else if (kind === 'trips') {
    const t = await R.tripsReport(h, from, to);
    sheet(wb, 'Trips', head(`Trips & airport rides ${period}`), [col('Date', 'date', 'text', 12), col('Time', 'time', 'text', 8), col('Type', 'kind', 'text', 10), col('Trip', 'title', 'text', 34), col('Company', 'company', 'text', 22), col('Driver', 'driver', 'text', 16), col('Guest', 'guest', 'text', 24), col('People', 'pax', 'int', 8), col('Charged to guest', 'price', 'money', 16), col('Tour company cost', 'companyCost', 'money', 18), col('Transport cost', 'transportCost', 'money', 16), col('Profit', 'profit', 'money'), col('Still owed to company', 'owed', 'money', 20), col('Status', 'status', 'text', 12)], t.rows.map((r) => ({ ...r, kind: r.kind === 'airport' ? 'Airport' : 'Tour' })),
      { title: 'TOTAL', pax: t.totals.pax, price: t.totals.income, profit: t.totals.profit, owed: t.totals.owed });
    sheet(wb, 'By company', head(`Companies ${period}`), [col('Company / driver', 'company', 'text', 34), col('Trips', 'trips', 'int', 10), col('Total cost', 'cost', 'money'), col('Still owed', 'owed', 'money')], t.companies);
  } else throw new Error('Unknown report');
  return { wb, filename: `${hotel.code}_${name}_${from}_to_${to}.xlsx` };
}
