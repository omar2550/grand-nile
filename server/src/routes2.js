import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { User, Hotel, Account, Journal, MenuItem, Table, Trip, Audit } from './models.js';
import * as S from './services.js';
import * as R from './reports.js';
import { CHART } from './chart.js';
import { buildExport } from './excel.js';
import { allow, audit, own, roles, wrap, MODULES } from './auth.js';
import { runBackup, listBackups, backupPath } from './backup.js';

const api = Router();
const rng = (q) => ({ from: q.from || S.addDays(S.today(), -30), to: q.to || S.today() });

/* ---------- Accounts & reports ---------- */
api.get('/accounts', allow('accounting'), wrap(async (req, res) => {
  const b = await S.balances(req.hotel._id); const groups = await Account.find({ hotel: req.hotel._id, isGroup: true }).lean();
  res.json([...groups.map((g) => ({ ...g, balance: null })), ...b].sort((x, y) => x.code.localeCompare(y.code)));
}));
api.get('/journal', allow('accounting'), wrap(async (req, res) => {
  const { from, to } = rng(req.query);
  res.json(await Journal.find({ hotel: req.hotel._id, date: { $gte: from, $lte: to } }).sort('-no').limit(Number(req.query.limit) || 300).lean());
}));
api.post('/journal', allow('accounting'), wrap(async (req, res) => {
  const j = await S.post({ hotel: req.hotel._id, date: req.body.date, memo: req.body.memo, source: 'manual', user: req.user.name, lines: req.body.lines.map((l) => ({ code: l.code, debit: +l.debit || 0, credit: +l.credit || 0 })) });
  await audit(req, 'Manual entry added', `#${j.no} ${req.body.memo}`, 'warn'); res.json(j);
}));
api.post('/expenses', allow('accounting'), wrap(async (req, res) => {
  const { code, amount, memo, paidFrom = '1110', date } = req.body; if (!(amount > 0)) throw new Error('Enter an amount greater than zero');
  const acc = await Account.findOne({ hotel: req.hotel._id, code }); if (!acc || acc.type !== 'expense') throw new Error('Choose an expense type');
  res.json(await S.post({ hotel: req.hotel._id, date, memo, source: 'expense', user: req.user.name, lines: [{ code, debit: +amount }, { code: paidFrom, credit: +amount }] }));
}));
api.post('/payments/company', allow('accounting'), wrap(async (req, res) => {
  const { amount, method, memo, date } = req.body; if (!(amount > 0)) throw new Error('Enter an amount greater than zero');
  await audit(req, 'Paid a supplier / company', `EGP ${amount} – ${memo}`);
  res.json(await S.payCompany({ hotel: req.hotel._id, amount: +amount, method, memo: memo || 'Payment to supplier', date, user: req.user.name }));
}));
api.get('/reports/trial-balance', allow('accounting'), wrap(async (req, res) => res.json(await S.balances(req.hotel._id, rng(req.query)))));
api.get('/reports/income', allow('accounting'), wrap(async (req, res) => res.json(await S.incomeStatement(req.hotel._id, rng(req.query)))));
api.get('/reports/balance-sheet', allow('accounting'), wrap(async (req, res) => res.json(await S.balanceSheet(req.hotel._id, req.query.to || S.today()))));
api.get('/reports/money', allow('accounting'), wrap(async (req, res) => { const { from, to } = rng(req.query); res.json(await R.money(req.hotel._id, from, to)); }));
api.get('/reports/guests', allow('pms'), wrap(async (req, res) => res.json(await R.guestAccounts(req.hotel._id, { status: req.query.status, ...rng(req.query) }))));
api.get('/reports/rooms', allow('pms'), wrap(async (req, res) => { const { from, to } = rng(req.query); res.json(await R.roomsReport(req.hotel._id, from, to)); }));
api.get('/reports/sales', allow('pos', 'inventory', 'accounting'), wrap(async (req, res) => { const { from, to } = rng(req.query); res.json(await R.sales(req.hotel._id, from, to)); }));

/* ---------- Excel downloads ---------- */
const NEED = { journal: ['accounting'], 'trial-balance': ['accounting'], income: ['accounting'], 'balance-sheet': ['accounting'], money: ['accounting'], guests: ['pms'], rooms: ['pms'], sales: ['pos', 'inventory', 'accounting'], trips: ['trips'] };
api.get('/export/:kind', wrap(async (req, res) => {
  const need = NEED[req.params.kind]; if (!need) throw new Error('Unknown report');
  if (!need.some((m) => MODULES[req.user.role]?.includes(m))) return res.status(403).json({ error: 'Your job role cannot download this report' });
  const { wb, filename } = await buildExport(req.params.kind, req.hotel, req.query);
  await audit(req, 'Excel report downloaded', filename);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await wb.xlsx.write(res); res.end();
}));

/* ---------- Trips & airport rides ---------- */
api.get('/trips', allow('trips'), wrap(async (req, res) => { const { from, to } = rng({ from: req.query.from || S.addDays(S.today(), -30), to: req.query.to || S.addDays(S.today(), 60) }); res.json(await R.tripsReport(req.hotel._id, from, to)); }));
api.post('/trips', allow('trips'), wrap(async (req, res) => {
  const b = req.body; if (!b.title || !b.date) throw new Error('Enter the trip name and date');
  const t = await S.createTrip({ ...b, hotel: req.hotel._id, price: +b.price || 0, companyCost: +b.companyCost || 0, transportCost: +b.transportCost || 0, pax: +b.pax || 1, user: req.user.name });
  await audit(req, 'Trip booked', `${t.title} · ${t.date}`); res.json(t);
}));
api.post('/trips/:id/pay', allow('trips', 'accounting'), wrap(async (req, res) => { const t = await own(Trip, req.params.id, req); await audit(req, 'Paid trip company', t.title); res.json(await S.payTripCosts(t, { method: req.body.method, user: req.user.name })); }));
api.post('/trips/:id/done', allow('trips'), wrap(async (req, res) => { const t = await own(Trip, req.params.id, req); t.status = 'done'; await t.save(); res.json(t); }));
api.post('/trips/:id/cancel', allow('trips'), wrap(async (req, res) => { const t = await own(Trip, req.params.id, req); await audit(req, 'Trip cancelled', t.title, 'warn'); res.json(await S.cancelTrip(t, req.user.name)); }));

/* ---------- Menu & prices ---------- */
api.get('/menu', allow('pos', 'qr', 'admin', 'inventory'), wrap(async (req, res) => res.json(await MenuItem.find({ hotel: req.hotel._id }).sort('category name'))));
api.post('/menu', roles('owner', 'admin', 'manager'), wrap(async (req, res) => {
  const { name, category, price, emoji, desc, outlets } = req.body; if (!name || !(price > 0)) throw new Error('Enter a name and a price');
  res.json(await MenuItem.create({ hotel: req.hotel._id, name, category: category || 'Other', price: +price, emoji: emoji || '🍽️', desc, outlets: outlets?.length ? outlets : ['restaurant'] }));
}));
api.patch('/menu/:id', roles('owner', 'admin', 'manager'), wrap(async (req, res) => {
  const m = await own(MenuItem, req.params.id, req); ['name', 'category', 'emoji', 'desc', 'outlets', 'available'].forEach((k) => req.body[k] !== undefined && (m[k] = req.body[k]));
  if (req.body.price > 0) m.price = +req.body.price; await m.save(); await audit(req, 'Menu changed', `${m.name}: ${JSON.stringify(req.body)}`); res.json(m);
}));
api.post('/tables', roles('owner', 'admin', 'manager'), wrap(async (req, res) => {
  const { outlet = 'restaurant', number, seats = 4, zone = 'Main' } = req.body; const n = await Table.countDocuments({ hotel: req.hotel._id, outlet });
  res.json(await Table.create({ hotel: req.hotel._id, outlet, number: +number, seats, zone, x: 12 + (n % 4) * 24, y: 20 + Math.floor(n / 4) * 24 }));
}));

/* ---------- Administration ---------- */
const adminOnly = allow('admin');
api.get('/admin/users', adminOnly, wrap(async (req, res) => {
  const f = req.user.role === 'owner' ? {} : { hotels: { $in: req.hotels.map((h) => h._id) }, role: { $ne: 'owner' } };
  res.json(await User.find(f).select('-passwordHash').populate('hotels', 'name code'));
}));
api.post('/admin/users', adminOnly, wrap(async (req, res) => {
  const { name, email, role, password } = req.body; let hotels = req.body.hotels?.length ? req.body.hotels : [req.hotel._id];
  if (role === 'owner' && req.user.role !== 'owner') throw new Error('Only an owner can create another owner');
  const allowed = req.hotels.map((h) => String(h._id)); hotels = hotels.filter((h) => allowed.includes(String(h)));
  if (!name || !email || !password || password.length < 6) throw new Error('Enter a name, email and a password of at least 6 characters');
  const u = await User.create({ name, email: email.trim().toLowerCase(), role, hotels, passwordHash: await bcrypt.hash(password, 10) });
  await audit(req, 'User created', `${email} as ${role}`, 'warn'); res.json({ _id: u._id });
}));
api.patch('/admin/users/:id', adminOnly, wrap(async (req, res) => {
  const u = await User.findById(req.params.id); if (!u) throw new Error('User not found');
  if (req.user.role !== 'owner' && (u.role === 'owner' || req.body.role === 'owner')) throw new Error('Only an owner can change an owner');
  if (req.body.role) u.role = req.body.role; if (typeof req.body.active === 'boolean') u.active = req.body.active; if (req.body.hotels) u.hotels = req.body.hotels;
  if (req.body.password?.length >= 6) u.passwordHash = await bcrypt.hash(req.body.password, 10);
  await u.save(); await audit(req, 'User changed', `${u.email}`, 'warn'); res.json({ ok: true });
}));
api.get('/admin/hotels', roles('owner'), wrap(async (req, res) => res.json(await Hotel.find().sort('name'))));
api.post('/admin/hotels', roles('owner'), wrap(async (req, res) => {
  const { name, code, city, publicUrl } = req.body; if (!name || !code) throw new Error('Enter the hotel name and a short code (3 letters)');
  const h = await Hotel.create({ name, code: code.toUpperCase().slice(0, 4), slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), city, publicUrl: publicUrl || '' });
  await Account.insertMany(CHART.map((a) => ({ ...a, hotel: h._id }))); await audit(req, 'Hotel added', name, 'warn'); res.json(h);
}));
api.patch('/admin/hotels/:id', roles('owner'), wrap(async (req, res) => {
  const h = await Hotel.findById(req.params.id); ['name', 'city', 'publicUrl', 'phone', 'active'].forEach((k) => req.body[k] !== undefined && (h[k] = req.body[k])); await h.save(); res.json(h);
}));
api.get('/admin/audit', adminOnly, wrap(async (req, res) => res.json(await Audit.find({ hotel: { $in: [req.hotel._id, null] } }).sort('-createdAt').limit(200))));
api.get('/admin/backups', adminOnly, wrap(async (req, res) => res.json(listBackups())));
api.post('/admin/backups', adminOnly, wrap(async (req, res) => { const n = await runBackup('manual'); await audit(req, 'Backup made', n); res.json({ name: n }); }));
api.get('/admin/backups/:name', adminOnly, (req, res) => res.download(backupPath(req.params.name)));

export default api;
