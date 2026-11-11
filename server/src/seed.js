import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import * as M from './models.js';
import * as S from './services.js';
import { CHART } from './chart.js';

await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/grand_nile');
const dbName = mongoose.connection.name;
console.log(`This will ERASE the database "${dbName}" and fill it with demo data. Starting in 5 seconds… (Ctrl+C to stop)`);
await new Promise((r) => setTimeout(r, 5000));
await mongoose.connection.dropDatabase();
for (const m of Object.values(mongoose.models)) { await m.createCollection().catch(() => {}); await m.syncIndexes(); }
S.resetAccountCache();

let seed = 20261031; // fixed seed so the demo data looks the same every time
const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const between = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const T = S.today(), START = S.addDays(T, -40), END = S.addDays(T, 24);

/* ---------------- shared catalogues ---------------- */
const groups = [
  { nat: 'Egypt', f: ['Ahmed', 'Mohamed', 'Mahmoud', 'Karim', 'Hana', 'Salma', 'Nour', 'Mostafa', 'Laila', 'Amr', 'Dina', 'Khaled'], l: ['Hassan', 'El-Sayed', 'Abdelrahman', 'Fawzy', 'Nassar', 'Shokry', 'Badawi', 'Rashed'], p: '+2010' },
  { nat: 'Saudi Arabia', f: ['Faisal', 'Abdullah', 'Noura', 'Sultan', 'Reem'], l: ['Al-Otaibi', 'Al-Harbi', 'Al-Qahtani'], p: '+96650' },
  { nat: 'United Arab Emirates', f: ['Rashid', 'Mariam', 'Hamdan'], l: ['Al-Mansoori', 'Al-Suwaidi'], p: '+97150' },
  { nat: 'Germany', f: ['Lukas', 'Anna', 'Jonas', 'Katrin'], l: ['Weber', 'Schneider', 'Fischer'], p: '+49151' },
  { nat: 'United Kingdom', f: ['Oliver', 'Charlotte', 'James', 'Emily'], l: ['Hughes', 'Carter', 'Bennett'], p: '+44770' },
  { nat: 'Italy', f: ['Giulia', 'Marco', 'Chiara'], l: ['Rossi', 'Ferrari', 'Conti'], p: '+39333' },
  { nat: 'Russia', f: ['Irina', 'Dmitri', 'Elena'], l: ['Petrov', 'Smirnova', 'Volkov'], p: '+7912' },
  { nat: 'Poland', f: ['Piotr', 'Agnieszka'], l: ['Kowalski', 'Nowak'], p: '+48501' },
];
const STOCK = [
  ['Beef tenderloin', 'kitchen', 'kg', 60, 25, 520, 'Al-Ahram Meats'], ['Chicken breast', 'kitchen', 'kg', 120, 40, 135, 'Cairo Poultry'], ['Sea bass', 'kitchen', 'kg', 55, 20, 380, 'Red Sea Fisheries'],
  ['Jumbo shrimp', 'kitchen', 'kg', 35, 15, 560, 'Red Sea Fisheries'], ['Basmati rice', 'kitchen', 'kg', 180, 60, 48, 'Delta Grocers'], ['Pasta', 'kitchen', 'kg', 150, 50, 32, 'Delta Grocers'],
  ['Tomatoes', 'kitchen', 'kg', 90, 40, 18, 'Obour Market'], ['Onions', 'kitchen', 'kg', 100, 40, 14, 'Obour Market'], ['Potatoes', 'kitchen', 'kg', 120, 50, 16, 'Obour Market'],
  ['Olive oil', 'kitchen', 'L', 70, 25, 190, 'Delta Grocers'], ['Eggs', 'kitchen', 'pcs', 900, 300, 4.2, 'Cairo Poultry'], ['Fava beans (foul)', 'kitchen', 'kg', 60, 20, 38, 'Delta Grocers'],
  ['Molokhia leaves', 'kitchen', 'kg', 40, 15, 45, 'Obour Market'], ['Cheese (halloumi)', 'kitchen', 'kg', 40, 15, 210, 'Delta Grocers'], ['Mango pulp', 'beverage', 'L', 80, 30, 75, 'Nile Juices'], ['Coffee beans', 'beverage', 'kg', 45, 15, 420, 'El Fishawy Roasters'],
  ['Mineral water 0.5L', 'beverage', 'pcs', 1200, 400, 4, 'Nestlé Waters'], ['Soft drink can', 'beverage', 'pcs', 900, 300, 9, 'Coca-Cola Egypt'], ['Stella beer', 'beverage', 'pcs', 600, 200, 28, 'Al Ahram Beverages'],
  ['Red wine – Omar Khayyam', 'beverage', 'pcs', 120, 40, 310, 'Gianaclis'], ['Mint & lime mix', 'beverage', 'kg', 30, 10, 60, 'Obour Market'],
  ['Bath towels', 'housekeeping', 'pcs', 400, 150, 140, 'Mahalla Textiles'], ['Bed linen sets', 'housekeeping', 'pcs', 300, 120, 360, 'Mahalla Textiles'], ['Shampoo sachets', 'housekeeping', 'pcs', 3000, 1000, 2.5, 'Hygiene Plus'],
  ['Soap bars', 'housekeeping', 'pcs', 3200, 1000, 1.8, 'Hygiene Plus'], ['Toilet paper rolls', 'housekeeping', 'pcs', 2500, 900, 3.2, 'Hygiene Plus'], ['Floor cleaner', 'housekeeping', 'L', 220, 80, 38, 'Clean Pro Egypt'], ['Slippers (pairs)', 'housekeeping', 'pcs', 900, 300, 6, 'Hygiene Plus'],
];
// name, group, price, emoji, where it is sold (restaurant / rooftop / room = room service), recipe [[stock-name-prefix, qty]], description
const MENU = [
  ['Foul & Ta’meya Breakfast', 'Breakfast', 140, '🫘', ['restaurant', 'room'], [['Fava', 0.2], ['Eggs', 1], ['Olive', 0.02]], 'Fava beans, falafel, baladi bread'],
  ['Eggs Benedict', 'Breakfast', 195, '🍳', ['restaurant', 'room'], [['Eggs', 3], ['Olive', 0.02]], 'Poached eggs, toasted muffin'],
  ['Koshari Royale', 'Egyptian', 120, '🍛', ['restaurant', 'room'], [['Basmati', 0.15], ['Pasta', 0.1], ['Tomatoes', 0.15], ['Onions', 0.1]], 'Rice, lentils, pasta, crispy onions'],
  ['Molokhia with Chicken', 'Egyptian', 260, '🥘', ['restaurant', 'room'], [['Molokhia', 0.25], ['Chicken', 0.3], ['Basmati', 0.15]], 'Served with rice'],
  ['Shrimp Gambari Clay Pot', 'Egyptian', 540, '🦐', ['restaurant', 'rooftop', 'room'], [['Jumbo', 0.25], ['Tomatoes', 0.2], ['Olive', 0.03]], 'Baked in tomato sauce'],
  ['Grilled Sea Bass', 'Mains', 620, '🐟', ['restaurant', 'rooftop', 'room'], [['Sea bass', 0.4], ['Potatoes', 0.2], ['Olive', 0.03]], 'With lemon butter'],
  ['Beef Tenderloin 250g', 'Mains', 890, '🥩', ['restaurant', 'rooftop', 'room'], [['Beef', 0.25], ['Potatoes', 0.2]], 'Pepper sauce'],
  ['Mixed Grill for Two', 'Mains', 980, '🍖', ['restaurant', 'rooftop'], [['Beef', 0.3], ['Chicken', 0.4], ['Onions', 0.1]], 'Kofta, kebab, chicken'],
  ['Penne Arrabbiata', 'Mains', 240, '🍝', ['restaurant', 'room'], [['Pasta', 0.18], ['Tomatoes', 0.2], ['Olive', 0.02]], 'Spicy tomato sauce'],
  ['Club Sandwich', 'Mains', 230, '🥪', ['restaurant', 'rooftop', 'room'], [['Chicken', 0.15], ['Eggs', 1], ['Tomatoes', 0.08]], 'With fries'],
  ['Hummus & Baladi Bread', 'Starters', 95, '🫓', ['restaurant', 'rooftop', 'room'], [['Olive', 0.02]], ''],
  ['Sunset Mezze Platter', 'Starters', 320, '🧆', ['rooftop'], [['Olive', 0.04], ['Tomatoes', 0.1]], 'Hummus, baba ghanoush, falafel, tahini'],
  ['Grilled Halloumi', 'Starters', 210, '🧀', ['rooftop', 'room'], [['Cheese', 0.15], ['Olive', 0.01]], 'With honey and thyme'],
  ['Fattoush Salad', 'Starters', 110, '🥗', ['restaurant', 'rooftop', 'room'], [['Tomatoes', 0.15], ['Onions', 0.05], ['Olive', 0.02]], ''],
  ['Lentil Soup', 'Starters', 85, '🍲', ['restaurant', 'room'], [['Onions', 0.05]], ''],
  ['Om Ali', 'Desserts', 120, '🍮', ['restaurant', 'rooftop', 'room'], [], 'Warm milk pastry with nuts'],
  ['Baklava Plate', 'Desserts', 130, '🥮', ['restaurant', 'rooftop', 'room'], [['Olive', 0.01]], ''],
  ['Fresh Mango Juice', 'Drinks', 90, '🥭', ['restaurant', 'rooftop', 'room'], [['Mango', 0.3]], ''],
  ['Virgin Mojito', 'Drinks', 110, '🍹', ['rooftop'], [['Mint', 0.05], ['Soft', 1]], 'Mint, lime, soda'],
  ['Turkish Coffee', 'Drinks', 60, '☕', ['restaurant', 'rooftop', 'room'], [['Coffee', 0.012]], ''],
  ['Cappuccino', 'Drinks', 85, '☕', ['restaurant', 'rooftop', 'room'], [['Coffee', 0.018]], ''],
  ['Mineral Water', 'Drinks', 40, '💧', ['restaurant', 'rooftop', 'room'], [['Mineral', 1]], ''],
  ['Soft Drink', 'Drinks', 55, '🥤', ['restaurant', 'rooftop', 'room'], [['Soft', 1]], ''],
  ['Stella Beer', 'Bar', 140, '🍺', ['restaurant', 'rooftop', 'room'], [['Stella', 1]], ''],
  ['Red Wine – Glass', 'Bar', 210, '🍷', ['restaurant', 'rooftop'], [['Red wine', 0.2]], ''],
  ['Apple Shisha', 'Rooftop extras', 180, '💨', ['rooftop'], [], 'Served with fresh coal'],
];
const HOTELS = [
  { name: 'Henu Hotel', code: 'NIL', slug: 'henu', city: 'Cairo', view: 'Nile', rates: [2400, 2800, 4300, 6400, 14500], ooo: '105', airport: ['Hotel → Cairo Airport (CAI)', 650, 380], tours: [['Pyramids & Sphinx day trip', 'Giza', 950, 520], ['Egyptian Museum & Khan el-Khalili', 'Cairo', 700, 380], ['Alexandria day trip', 'Alexandria', 1200, 700], ['Nile felucca sunset', 'Cairo', 350, 180], ['Saqqara & Memphis half day', 'Saqqara', 650, 340]] },
  { name: 'Red Sea Pearl Resort', code: 'RSP', slug: 'red-sea-pearl', city: 'Hurghada', view: 'Sea', rates: [2600, 3200, 4800, 7000, 15500], ooo: '208', airport: ['Hotel → Hurghada Airport (HRG)', 350, 200], tours: [['Giftun Island boat trip', 'Giftun', 900, 520], ['Snorkeling at Orange Bay', 'Hurghada', 800, 450], ['Desert safari & Bedouin dinner', 'Hurghada desert', 650, 360], ['Luxor day trip', 'Luxor', 1800, 1100], ['Dolphin House cruise', 'Hurghada', 750, 430]] },
];
const COMPANIES = ['Pharaoh Tours', 'Nile Explorer Travel', 'Red Sea Adventures', 'Sphinx Transport'];
const sources = ['Direct', 'Booking.com', 'Expedia', 'Corporate', 'Walk-in', 'Travel Agent'];
const pw = (p) => bcrypt.hashSync(p, 8);

const hotels = [];
for (const cfg of HOTELS) {
  const h = await M.Hotel.create({ name: cfg.name, code: cfg.code, slug: cfg.slug, city: cfg.city, publicUrl: '' });
  hotels.push(h); await M.Account.insertMany(CHART.map((a) => ({ ...a, hotel: h._id })));
}
const [nile, pearl] = hotels;
await M.User.insertMany([
  { name: 'Hassan El-Masry', email: 'admin@grandnile.com', role: 'owner', passwordHash: pw('Admin@123') },
  { name: 'Nadia Farouk', email: 'manager@grandnile.com', role: 'manager', hotels: [nile._id, pearl._id], passwordHash: pw('Manager@123') },
  { name: 'Omar Zaki', email: 'frontdesk@grandnile.com', role: 'front_desk', hotels: [nile._id], passwordHash: pw('Front@123') },
  { name: 'Salma Reda', email: 'frontdesk.rsp@grandnile.com', role: 'front_desk', hotels: [pearl._id], passwordHash: pw('Front@123') },
  { name: 'Mariam Adel', email: 'cashier@grandnile.com', role: 'cashier', hotels: [nile._id], passwordHash: pw('Cashier@123') },
  { name: 'Tarek Salem', email: 'accountant@grandnile.com', role: 'accountant', hotels: [nile._id, pearl._id], passwordHash: pw('Account@123') },
  { name: 'Youssef Mahmoud', email: 'store@grandnile.com', role: 'storekeeper', hotels: [nile._id], passwordHash: pw('Store@123') },
  { name: 'Hotel Administrator', email: 'hoteladmin@grandnile.com', role: 'admin', hotels: [nile._id], passwordHash: pw('HotelAdmin@123') },
]);

/* ---------------- one hotel at a time ---------------- */
async function seedHotel(h, cfg) {
  const H = h._id; const log = (m) => console.log(`  [${cfg.code}] ${m}`);
  // 27 rooms: 3 floors of 9
  const rooms = [];
  for (let f = 1; f <= 3; f++) for (let i = 1; i <= 9; i++) {
    let type = 'Standard', rate = cfg.rates[f === 1 ? 0 : 1], view = f === 1 ? 'Garden' : 'Pool', beds = i % 3 ? 'King' : 'Twin';
    if ((f === 2 && i > 6) || (f === 3 && i <= 5)) { type = 'Deluxe View'; rate = cfg.rates[2]; view = cfg.view; }
    if (f === 3 && i === 6 || f === 3 && i === 7) { type = 'Family Suite'; rate = cfg.rates[3]; view = cfg.view; beds = 'King + 2 Singles'; }
    if (f === 3 && i >= 8) { type = 'Royal Suite'; rate = cfg.rates[4]; view = cfg.view; beds = 'King + Lounge'; }
    rooms.push({ hotel: H, number: `${f}${String(i).padStart(2, '0')}`, floor: f, type, rate, view, beds, status: 'clean' });
  }
  const roomDocs = await M.Room.insertMany(rooms);
  await M.Room.updateOne({ hotel: H, number: cfg.ooo }, { status: 'out_of_order' });
  const guests = [];
  for (let i = 0; i < 80; i++) { const g = pick(groups); const name = `${pick(g.f)} ${pick(g.l)}`;
    guests.push({ hotel: H, name, nationality: g.nat, phone: g.p + between(1000000, 9999999), email: name.toLowerCase().replace(/[^a-z]+/g, '.') + '@mail.com', idNumber: String(between(10000000, 99999999)), vip: rnd() < 0.08, notes: rnd() < 0.1 ? pick(['Prefers high floor', 'Allergic to nuts', 'Late arrival expected', 'Celebrating anniversary']) : '' }); }
  const guestDocs = await M.Guest.insertMany(guests);
  const stockDocs = await M.StockItem.insertMany(STOCK.map(([name, category, unit, qty, reorderLevel, cost, supplier]) => ({ hotel: H, name, category, unit, qty, reorderLevel, cost, supplier })));
  const SK = (n) => stockDocs.find((s) => s.name.startsWith(n))._id;
  const menuDocs = await M.MenuItem.insertMany(MENU.map(([name, category, price, emoji, outlets, recipe, desc]) => ({ hotel: H, name, category, price, emoji, outlets, desc, recipe: recipe.map(([n, qty]) => ({ stock: SK(n), qty })) })));
  const tdocs = [];
  [[12, 26], [36, 26], [60, 26], [84, 26], [14, 60], [38, 60], [62, 60], [86, 60], [26, 88], [74, 88]].forEach(([x, y], i) => tdocs.push({ hotel: H, outlet: 'restaurant', number: i + 1, seats: pick([2, 4, 4, 6]), zone: y < 40 ? 'Main hall' : y < 75 ? 'Garden side' : 'Terrace', x, y }));
  [[16, 30], [40, 30], [64, 30], [88, 30], [16, 70], [40, 70], [64, 70], [88, 70]].forEach(([x, y], i) => tdocs.push({ hotel: H, outlet: 'rooftop', number: i + 1, seats: pick([2, 4, 4, 6]), zone: y < 50 ? 'Rooftop – front row' : 'Rooftop – lounge', x, y }));
  const tables = await M.Table.insertMany(tdocs);

  // bookings
  const bookings = []; let bno = 0;
  for (const room of roomDocs.filter((r) => r.number !== cfg.ooo)) {
    let c = S.addDays(START, -between(0, 4));
    while (c <= END) {
      const len = pick([1, 2, 2, 3, 3, 3, 4, 4, 5, 6, 7]); const out = S.addDays(c, len);
      if (rnd() < 0.82) {
        const status = out <= T ? 'checked_out' : c <= T ? 'in_house' : 'reserved';
        const fam = room.type === 'Family Suite';
        bookings.push({ hotel: H, code: `${cfg.code}-${String(++bno).padStart(5, '0')}`, guest: pick(guestDocs)._id, room: room._id, checkIn: c, checkOut: out,
          adults: fam ? between(2, 4) : between(1, 2), children: fam ? between(0, 2) : 0, rate: Math.round((room.rate * (0.88 + rnd() * 0.2)) / 50) * 50,
          source: pick(sources), board: pick(['BB', 'BB', 'HB', 'RO']), status: status === 'checked_out' ? 'in_house' : status, finalStatus: status });
      }
      c = S.addDays(out, rnd() < 0.35 ? between(1, 2) : 0);
    }
  }
  const bdocs = await M.Booking.insertMany(bookings);
  await M.Counter.findByIdAndUpdate('booking:' + H, { seq: bno }, { upsert: true });
  const final = Object.fromEntries(bdocs.map((b, i) => [String(b._id), bookings[i].finalStatus]));
  const cancelled = bdocs.filter((b) => final[b._id] === 'reserved' && rnd() < 0.05).map((b) => b._id);
  await M.Booking.updateMany({ _id: { $in: cancelled } }, { status: 'cancelled' });
  const alive = bdocs.filter((b) => !cancelled.some((c) => String(c) === String(b._id)));
  log(`27 rooms, ${guestDocs.length} guests, ${alive.length} bookings`);

  await S.startBulk([H]); await S.bulkLoad(H);
  const invFB = S.r2(stockDocs.filter((s) => s.category !== 'housekeeping').reduce((a, s) => a + s.qty * s.cost, 0));
  const invHK = S.r2(stockDocs.filter((s) => s.category === 'housekeeping').reduce((a, s) => a + s.qty * s.cost, 0));
  const open = [['1110', 180000], ['1115', 30000], ['1116', 25000], ['1120', 2600000], ['1140', invFB], ['1150', invHK], ['1210', 18000000]];
  await S.post({ hotel: H, date: S.addDays(START, -1), memo: 'Opening balances', source: 'opening', lines: [...open.map(([code, debit]) => ({ code, debit })), { code: '3100', credit: open.reduce((a, [, v]) => a + v, 0) }] });

  let orderNo = 0, owed = 0; // owed = what we still owe suppliers, so demo payments never go below zero
  const staysOn = (d) => alive.filter((b) => b.checkIn <= d && b.checkOut > d && final[b._id] !== 'reserved');
  const sell = async (date, n) => {
    const stays = staysOn(date);
    for (let i = 0; i < n; i++) {
      const outlet = rnd() < 0.62 ? 'restaurant' : 'rooftop'; const table = pick(tables.filter((t) => t.outlet === outlet));
      const menu = menuDocs.filter((m) => m.outlets.includes(outlet));
      const o = new M.PosOrder({ hotel: H, no: ++orderNo, outlet, table: table._id, tableNo: table.number, waiter: 'Mariam Adel', items: [], qr: outlet === 'rooftop' && rnd() < 0.3 });
      for (let k = 0; k < between(2, 5); k++) { const m = pick(menu); o.items.push({ menu: m._id, name: m.name, price: m.price, qty: between(1, 3) }); }
      const toRoom = stays.length && rnd() < 0.4;
      await S.settleOrder(o, { method: toRoom ? 'room' : pick(['cash', 'card', 'card']), bookingId: toRoom ? pick(stays)._id : undefined, date, user: 'Mariam Adel' });
    }
  };
  const stockUp = async (date) => {
    const fresh = (await S.stockNow(H)).filter((s) => s.category !== 'housekeeping' && s.qty < s.reorderLevel * 2.5);
    if (!fresh.length) return;
    const j = await S.receivePurchase({ hotel: H, supplier: 'Weekly supplier delivery', payment: pick(['credit', 'credit', 'bank', 'cash']), date, user: 'Youssef Mahmoud', lines: fresh.map((s) => ({ stock: s._id, qty: Math.round(s.reorderLevel * 2), cost: s.cost })) });
    owed += j.lines.find((l) => l.code === '2100')?.credit || 0;
  };
  const skId = (n) => String(SK(n));
  for (let d = START; d <= T; d = S.addDays(d, 1)) {
    await S.nightAudit(H, d, 'night.auditor');
    for (const b of staysOn(d).filter(() => rnd() < 0.18)) {
      const k = pick([['minibar', 'Minibar', 160], ['laundry', 'Laundry service', 220], ['spa', 'Spa – massage', 650], ['other', 'Extra bed', 300]]);
      await S.addCharge({ hotel: H, booking: b._id, dept: k[0], description: k[1], net: k[2], date: d, user: 'Omar Zaki' });
    }
    await sell(d, d === T ? 6 : between(8, 14));
    const day = Math.round((new Date(d) - new Date(START)) / 864e5);
    if (day % 7 === 0) await stockUp(d);
    if (day % 7 === 3) for (const [n, q] of [['Bath towels', 20], ['Shampoo', 200], ['Soap', 200], ['Toilet', 200], ['Floor', 12]]) await S.issueStock({ stock: skId(n), qty: q, date: d, user: 'Youssef Mahmoud' });
    if (day % 15 === 14) { await S.post({ hotel: H, date: d, memo: 'Salaries – all departments', source: 'expense', user: 'Tarek Salem', lines: [{ code: '6100', debit: 245000 }, { code: '1120', credit: 245000 }] });
      const el = 58000 + between(0, 9000); await S.post({ hotel: H, date: d, memo: 'Electricity, water & gas', source: 'expense', user: 'Tarek Salem', lines: [{ code: '6200', debit: el }, { code: '1120', credit: el }] }); }
    if (day % 9 === 5) { const v = between(4000, 18000); await S.post({ hotel: H, date: d, memo: pick(['AC servicing', 'Lift maintenance', 'Pool pump repair', 'Plumbing works']), source: 'expense', user: 'Tarek Salem', lines: [{ code: '6300', debit: v }, { code: '1110', credit: v }] }); }
    if (day % 10 === 8) { const v = between(8000, 26000); await S.post({ hotel: H, date: d, memo: 'Booking.com / Expedia commissions', source: 'expense', user: 'Tarek Salem', lines: [{ code: '6500', debit: v }, { code: '1120', credit: v }] }); }
    if (day % 10 === 9) { const v = Math.min(between(20000, 60000), Math.floor(owed)); if (v > 0) { await S.payCompany({ hotel: H, amount: v, method: 'bank', memo: 'Supplier settlement', date: d, user: 'Tarek Salem' }); owed -= v; } }
    if (day % 6 === 2) { const v = between(300, 1500); await S.post({ hotel: H, date: d, memo: pick(['Staff meals', 'Printing & stationery', 'Taxi & delivery', 'Bottled water for offices']), source: 'expense', user: 'Omar Zaki', lines: [{ code: '6600', debit: v }, { code: '1110', credit: v }] }); }
  }

  // trips & airport rides charged to guest rooms
  const trips = [];
  for (let i = 0; i < 16; i++) {
    const b = pick(alive); const airport = rnd() < 0.4; const [title, dest, price, cost] = airport ? [cfg.airport[0], 'Airport', cfg.airport[1], cfg.airport[2]] : pick(cfg.tours);
    const date = airport ? b.checkOut : (b.checkOut > S.addDays(b.checkIn, 1) ? S.addDays(b.checkIn, 1) : b.checkIn); const pax = airport ? 1 : between(1, 4);
    const t = await S.createTrip({ hotel: H, kind: airport ? 'airport' : 'tour', title, destination: dest, date, time: pick(['07:30', '09:00', '14:00', '18:30', '22:15']), company: airport ? 'Sphinx Transport' : pick(COMPANIES.slice(0, 3)), driver: airport ? pick(['Mahmoud', 'Sayed', 'Ibrahim']) : undefined,
      bookingId: b._id, pax, price: airport ? price : price * pax, companyCost: airport ? 0 : Math.round(cost * pax * 0.75), transportCost: airport ? cost : Math.round(cost * pax * 0.25), payment: 'room', user: 'Omar Zaki' });
    trips.push(t);
  }
  for (const t of trips) { if (t.date <= T) { t.status = 'done'; await t.save(); if (rnd() < 0.6) await S.payTripCosts(t, { method: pick(['cash', 'bank']), date: t.date, user: 'Tarek Salem' }); } }
  const walk = await S.createTrip({ hotel: H, kind: 'tour', title: cfg.tours[0][0], destination: cfg.tours[0][1], date: S.addDays(T, 2), time: '08:00', company: 'Pharaoh Tours', guestName: 'Walk-in visitors (paid at desk)', pax: 3, price: cfg.tours[0][2] * 3, companyCost: 1300, transportCost: 600, payment: 'cash', user: 'Omar Zaki' });
  void walk;

  // payments & final statuses
  let first = true; const coIds = [];
  for (const b of alive) {
    const f = final[b._id]; if (f === 'reserved') continue;
    const fol = await S.folioOf(b._id); const departingToday = b.checkOut === T && f === 'in_house';
    let amount = f === 'checked_out' ? fol.balance : departingToday && !first ? fol.balance : Math.round(fol.balance * 0.3);
    if (departingToday && first) { first = false; amount = Math.round(fol.balance * 0.5); }
    const when = f === 'checked_out' ? b.checkOut : b.checkIn;
    if (amount > 0) await S.addPayment({ hotel: H, booking: b._id, amount, method: pick(['cash', 'card', 'card', 'transfer']), date: when > T ? T : when, user: 'Omar Zaki' });
    if (f === 'checked_out') coIds.push(b._id);
  }
  await S.flushBulk();
  await M.Counter.findByIdAndUpdate('order:' + H, { seq: orderNo }, { upsert: true });
  await M.Booking.updateMany({ _id: { $in: coIds } }, { status: 'checked_out' });

  // room cleaning status + a few low-stock items for the demo
  const inRooms = (await M.Booking.find({ hotel: H, status: 'in_house' }).distinct('room')).map(String);
  const leftToday = await M.Booking.find({ hotel: H, status: 'checked_out', checkOut: T }).distinct('room');
  await M.Room.updateMany({ _id: { $in: leftToday } }, { status: 'dirty' });
  for (const r of roomDocs.filter((x) => !inRooms.includes(String(x._id)) && x.number !== cfg.ooo && rnd() < 0.25)) await M.Room.updateOne({ _id: r._id }, { status: pick(['dirty', 'inspected']) });
  for (const [n, q] of [['Sea bass', 14], ['Stella', 150], ['Bath towels', 110], ['Coffee', 11]]) await M.StockItem.updateOne({ hotel: H, name: new RegExp('^' + n) }, { qty: q });
  const tb = await S.balances(H); const dr = tb.reduce((a, x) => a + x.debit, 0), cr = tb.reduce((a, x) => a + x.credit, 0);
  log(`${await M.Journal.countDocuments({ hotel: H })} ledger entries · debit ${dr.toFixed(2)} = credit ${cr.toFixed(2)}${Math.abs(dr - cr) < 0.01 ? ' ✔' : ' ✘ MISMATCH'}`);
}
for (let i = 0; i < hotels.length; i++) { console.log(`Seeding ${hotels[i].name}…`); await seedHotel(hotels[i], HOTELS[i]); }

await M.Audit.insertMany([
  { hotel: nile._id, user: 'Hassan El-Masry', role: 'owner', action: 'User created', detail: 'store@grandnile.com as storekeeper', severity: 'warn' },
  { hotel: nile._id, user: 'Mariam Adel', role: 'cashier', action: 'Order item removed', detail: 'Order #212 · Red Wine – Glass ×2 · EGP 420', severity: 'warn' },
  { hotel: nile._id, user: 'Nadia Farouk', role: 'manager', action: 'Bill line cancelled', detail: 'Minibar · EGP 210.00', severity: 'alert' },
  { hotel: nile._id, user: 'Omar Zaki', role: 'front_desk', action: 'Blocked: tried to open a page without permission', detail: 'GET /api/journal', severity: 'warn' },
  { user: 'unknown@mail.com', action: 'Failed sign-in', detail: '', severity: 'warn' },
]);
console.log('\nDone! Sign in with  admin@grandnile.com  /  Admin@123  (owner of both hotels)');
await mongoose.disconnect();
