import React, { useCallback, useEffect, useState } from 'react';
import { api, egp, today, addDays, dayDiff } from '../api.js';
import { Modal, Pill, Err, Head } from '../ui.jsx';

const DAYS = 28, CW = 46;
const invoiceHtml = (f) => `<html><head><title>Invoice ${f.booking.code}</title><style>body{font:14px Arial;padding:30px}table{width:100%;border-collapse:collapse}td,th{padding:6px;border-bottom:1px solid #ccc;text-align:left}.r{text-align:right}</style></head><body>
<h2>${localStorage.getItem('gn_hotel_name')} – Guest Bill</h2><p>${f.booking.guest.name} · Room ${f.booking.room.number} · ${f.booking.checkIn} → ${f.booking.checkOut} · ${f.booking.code}</p>
<table><tr><th>Date</th><th>Description</th><th class="r">Net</th><th class="r">Service 12%</th><th class="r">VAT 14%</th><th class="r">Total</th></tr>
${f.entries.map((e) => `<tr><td>${e.date}</td><td>${e.description}</td><td class="r">${e.kind === 'charge' ? e.net.toFixed(2) : ''}</td><td class="r">${e.kind === 'charge' ? e.service.toFixed(2) : ''}</td><td class="r">${e.kind === 'charge' ? e.vat.toFixed(2) : ''}</td><td class="r">${e.kind === 'payment' ? '-' : ''}${e.total.toFixed(2)}</td></tr>`).join('')}
</table><h3 class="r">Balance due: EGP ${f.balance.toFixed(2)}</h3><script>window.print()</script></body></html>`;

function Folio({ id, onClose, onChange, user }) {
  const [f, setF] = useState(null); const [err, setErr] = useState('');
  const [chg, setChg] = useState({ dept: 'minibar', description: '', net: '' }); const [pay, setPay] = useState({ amount: '', method: 'cash' });
  const load = useCallback(() => api(`/bookings/${id}/folio`).then(setF), [id]); useEffect(() => { load(); }, [load]);
  const run = async (fn) => { setErr(''); try { await fn(); await load(); onChange(); } catch (e) { setErr(e.message); } };
  if (!f) return null; const b = f.booking, canVoid = ['admin', 'manager'].includes(user.role);
  return (
    <Modal wide title={`${b.guest.name}  ·  Room ${b.room.number}`} onClose={onClose}>
      <div className="row" style={{ marginBottom: 12 }}>
        <div><Pill s={b.status} /> <b className="mono">{b.code}</b><br /><small>{b.checkIn} → {b.checkOut} · {dayDiff(b.checkIn, b.checkOut)} nights · {b.board} · {b.source}</small></div>
        <div style={{ textAlign: 'right' }}><small>Amount still owed</small><h2 style={{ color: f.balance > 0 ? 'var(--hib)' : 'var(--ok)' }}>{egp(f.balance)}</h2></div>
      </div>
      <Err e={err} />
      <div className="scroll-x"><table><thead><tr><th>Date</th><th>Item</th><th className="n">Net</th><th className="n">Svc+VAT</th><th className="n">Total</th><th /></tr></thead><tbody>
        {f.entries.map((e) => <tr key={e._id}><td>{e.date}</td><td>{e.description} <small>({e.dept})</small></td><td className="n">{e.kind === 'charge' ? e.net.toFixed(2) : ''}</td><td className="n">{e.kind === 'charge' ? (e.service + e.vat).toFixed(2) : ''}</td>
          <td className="n" style={{ color: e.kind === 'payment' ? 'var(--ok)' : undefined }}>{e.kind === 'payment' ? '−' : ''}{e.total.toFixed(2)}</td>
          <td>{canVoid && <button className="btn ghost sm" onClick={() => confirm('Cancel this line? It will be taken off the bill and the accounts will be corrected.') && run(() => api(`/folio/${e._id}/void`, { method: 'POST' }))}>Cancel line</button>}</td></tr>)}
        <tr className="total"><td colSpan="4">Charges {egp(f.charges)} − payments {egp(f.payments)}</td><td className="n">{f.balance.toFixed(2)}</td><td /></tr></tbody></table></div>
      {b.status !== 'checked_out' && b.status !== 'cancelled' && <div className="grid g2" style={{ marginTop: 14 }}>
        <div className="row"><label>Post a charge<select value={chg.dept} onChange={(e) => setChg({ ...chg, dept: e.target.value })}><option value="minibar">Minibar</option><option value="laundry">Laundry</option><option value="spa">Spa</option><option value="restaurant">Restaurant</option><option value="other">Other</option></select></label>
          <label>Description<input value={chg.description} onChange={(e) => setChg({ ...chg, description: e.target.value })} /></label>
          <label>Net EGP<input type="number" value={chg.net} onChange={(e) => setChg({ ...chg, net: e.target.value })} /></label>
          <button className="btn" onClick={() => run(async () => { await api(`/bookings/${id}/charge`, { method: 'POST', body: chg }); setChg({ ...chg, description: '', net: '' }); })}>Post</button></div>
        <div className="row"><label>Take a payment<select value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}><option value="cash">Cash</option><option value="card">Card</option><option value="transfer">Bank transfer</option></select></label>
          <label>Amount EGP<input type="number" value={pay.amount} placeholder={f.balance > 0 ? f.balance : ''} onChange={(e) => setPay({ ...pay, amount: e.target.value })} /></label>
          <button className="btn gold" onClick={() => run(async () => { await api(`/bookings/${id}/payment`, { method: 'POST', body: pay }); setPay({ ...pay, amount: '' }); })}>Receive</button></div></div>}
      <div className="row" style={{ marginTop: 18, justifyContent: 'flex-end' }}>
        <button className="btn ghost" onClick={() => { const w = window.open('', '_blank'); w.document.write(invoiceHtml(f)); w.document.close(); }}>Print invoice</button>
        {b.status === 'reserved' && <><button className="btn ghost" onClick={() => run(() => api(`/bookings/${id}/cancel`, { method: 'POST' }))}>Cancel booking</button><button className="btn" onClick={() => run(() => api(`/bookings/${id}/checkin`, { method: 'POST' }))}>Check in</button></>}
        {b.status === 'in_house' && <button className="btn gold" onClick={() => run(() => api(`/bookings/${id}/checkout`, { method: 'POST' }))}>Check out</button>}
      </div>
    </Modal>
  );
}

function NewBooking({ preset, onClose, onDone }) {
  const [f, setF] = useState({ name: '', phone: '', nationality: 'Egypt', email: '', checkIn: preset.date, checkOut: addDays(preset.date, 2), roomId: preset.roomId || '', adults: 2, board: 'BB', source: 'Direct', rate: '' });
  const [free, setFree] = useState([]); const [err, setErr] = useState('');
  useEffect(() => { if (f.checkOut > f.checkIn) api(`/availability?checkIn=${f.checkIn}&checkOut=${f.checkOut}`).then(setFree); }, [f.checkIn, f.checkOut]);
  const room = free.find((r) => r._id === f.roomId);
  const submit = async () => { try { await api('/bookings', { method: 'POST', body: { guest: { name: f.name, phone: f.phone, nationality: f.nationality, email: f.email }, roomId: f.roomId, checkIn: f.checkIn, checkOut: f.checkOut, adults: +f.adults, board: f.board, source: f.source, rate: f.rate ? +f.rate : undefined } }); onDone(); } catch (e) { setErr(e.message); } };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal title="New reservation" onClose={onClose}>
      <div className="grid g2"><label>Guest name<input value={f.name} onChange={set('name')} autoFocus /></label><label>Phone<input value={f.phone} onChange={set('phone')} /></label>
        <label>Nationality<input value={f.nationality} onChange={set('nationality')} /></label><label>Email<input value={f.email} onChange={set('email')} /></label>
        <label>Check-in<input type="date" value={f.checkIn} onChange={set('checkIn')} /></label><label>Check-out<input type="date" value={f.checkOut} onChange={set('checkOut')} /></label>
        <label>Available room<select value={f.roomId} onChange={set('roomId')}><option value="">Choose a room…</option>{free.map((r) => <option key={r._id} value={r._id}>{r.number} · {r.type} · {r.view} view · {egp(r.rate)}</option>)}</select></label>
        <label>Nightly rate (EGP)<input type="number" value={f.rate} placeholder={room ? room.rate : ''} onChange={set('rate')} /></label>
        <label>Meal plan<select value={f.board} onChange={set('board')}><option value="RO">Room only</option><option value="BB">Bed & breakfast</option><option value="HB">Half board</option></select></label>
        <label>Source<select value={f.source} onChange={set('source')}>{['Direct', 'Booking.com', 'Expedia', 'Corporate', 'Travel Agent', 'Walk-in'].map((s) => <option key={s}>{s}</option>)}</select></label></div>
      <Err e={err} /><div className="row" style={{ justifyContent: 'flex-end', marginTop: 14 }}><button className="btn gold" disabled={!f.name || !f.roomId} onClick={submit}>Create reservation</button></div>
    </Modal>
  );
}

export default function FrontDesk({ user }) {
  const [tab, setTab] = useState('tape'); const [rooms, setRooms] = useState([]); const [bookings, setBookings] = useState([]);
  const [td, setTd] = useState(null); const [err, setErr] = useState(''); const [open, setOpen] = useState(null); const [nb, setNb] = useState(null); const [q, setQ] = useState(''); const [found, setFound] = useState([]); const [msg, setMsg] = useState('');
  const from = addDays(today(), -3), to = addDays(from, DAYS);
  const load = useCallback(async () => { const [r, b, t] = await Promise.all([api('/rooms'), api(`/bookings?from=${from}&to=${to}`), api('/reception/today')]); setRooms(r); setBookings(b); setTd(t); }, [from, to]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (q.length > 1) api('/bookings/search?q=' + encodeURIComponent(q)).then(setFound); else setFound([]); }, [q]);
  const days = Array.from({ length: DAYS }, (_, i) => addDays(from, i));
  const setStatus = async (id, status) => { await api(`/rooms/${id}/status`, { method: 'PATCH', body: { status } }); load(); };
  return (
    <>
      <Head title="Reception" sub="Room calendar, bookings and guest bills">
        <button className="btn ghost" onClick={async () => { const r = await api('/night-audit', { method: 'POST', body: {} }); setMsg(`Done: ${r.posted} room charges were added to guest bills for ${r.date}.`); load(); }}>Add today's room charges to bills</button>
        <button className="btn gold" onClick={() => setNb({ date: today() })}>New reservation</button>
      </Head>
      {msg && <div className="ok">{msg}</div>}<Err e={err} />
      <div className="tabs">{[['tape', 'Room calendar'], ['today', 'Arrivals & departures'], ['find', 'Find a booking'], ['hk', 'Room cleaning']].map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'tape' && <>
        <div className="legend"><span><i style={{ background: 'var(--lapis)' }} />Booked (not arrived)</span><span><i style={{ background: 'var(--teal)' }} />Staying now</span><span><i style={{ background: 'var(--stone)' }} />Already left</span><span>Click an empty night to book it. Click a stay to open the folio.</span></div>
        <div className="tape" style={{ '--days': DAYS, '--cw': CW + 'px' }}>
          <div className="hdr"><div className="key">Room</div>{days.map((d) => { const dt = new Date(d + 'T00:00:00Z'); return <div key={d} className={(d === today() ? 'today ' : '') + ([5, 6].includes(dt.getUTCDay()) ? 'we' : '')}>{dt.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })}<br /><b>{dt.getUTCDate()}</b></div>; })}</div>
          {rooms.map((r) => (
            <div className="rrow" key={r._id}>
              <div className="key"><b>{r.number}</b>{({ 'Deluxe View': 'Deluxe', 'Family Suite': 'Family', 'Royal Suite': 'Royal' })[r.type] || r.type}</div>
              {days.map((d) => <div key={d} className={'cell' + (d === today() ? ' today' : '') + (r.status === 'out_of_order' ? ' ooo' : '')} onClick={() => r.status !== 'out_of_order' && setNb({ date: d, roomId: r._id })} />)}
              {bookings.filter((b) => String(b.room) === r._id).map((b) => { const s = Math.max(0, dayDiff(from, b.checkIn)), e = Math.min(DAYS, dayDiff(from, b.checkOut)); if (e <= s) return null;
                return <button key={b._id} className={'bar ' + b.status} style={{ left: 130 + s * CW + 2, width: (e - s) * CW - 4 }} title={`${b.guest.name} · ${b.checkIn} → ${b.checkOut}`} onClick={() => setOpen(b._id)}>{b.guest.vip && '★ '}{b.guest.name}</button>; })}
            </div>))}
        </div></>}
      {tab === 'today' && td && <div className="grid g2">
        <div className="card"><h3>Guests arriving ({td.arrivals.length})</h3><table><tbody>{td.arrivals.map((b) => <tr key={b._id}><td><b>{b.guest.name}</b><br /><small>{b.code} · {b.checkIn} → {b.checkOut}</small></td><td>Room {b.room.number}</td><td><button className="btn sm" onClick={async () => { setErr(''); try { await api(`/bookings/${b._id}/checkin`, { method: 'POST' }); load(); } catch (e) { setErr(e.message); } }}>Check in</button></td></tr>)}{!td.arrivals.length && <tr><td>Nobody is waiting to arrive.</td></tr>}</tbody></table></div>
        <div className="card"><h3>Guests leaving today ({td.departures.length})</h3><table><tbody>{td.departures.map((b) => <tr key={b._id}><td><b>{b.guest.name}</b><br /><small>{b.code}</small></td><td>Room {b.room.number}</td><td><button className="btn gold sm" onClick={() => setOpen(b._id)}>Open bill & check out</button></td></tr>)}{!td.departures.length && <tr><td>Nobody is leaving today.</td></tr>}</tbody></table></div>
        <div className="card"><h3>Staying now ({td.inHouse.length})</h3><div className="scroll-x" style={{ maxHeight: 340, overflow: 'auto' }}><table><tbody>{td.inHouse.map((b) => <tr key={b._id}><td>{b.guest.name}</td><td>Room {b.room.number}</td><td>leaves {b.checkOut}</td><td><button className="btn ghost sm" onClick={() => setOpen(b._id)}>Bill</button></td></tr>)}</tbody></table></div></div>
        <div className="card"><h3>Arriving tomorrow ({td.tomorrow.length})</h3><table><tbody>{td.tomorrow.map((b) => <tr key={b._id}><td>{b.guest.name}</td><td>Room {b.room.number}</td><td>{b.adults + b.children} people</td></tr>)}{!td.tomorrow.length && <tr><td>No bookings arriving tomorrow.</td></tr>}</tbody></table></div>
      </div>}
      {tab === 'find' && <div className="card"><label>Guest name, phone or booking code<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Try “Hassan” or GN00042" /></label>
        <table style={{ marginTop: 12 }}><tbody>{found.map((b) => <tr key={b._id}><td>{b.code}</td><td>{b.guest.name}</td><td>Room {b.room.number}</td><td>{b.checkIn} → {b.checkOut}</td><td><Pill s={b.status} /></td><td><button className="btn sm" onClick={() => setOpen(b._id)}>Open folio</button></td></tr>)}</tbody></table></div>}
      {tab === 'hk' && <div className="card scroll-x"><table><thead><tr><th>Room</th><th>Type</th><th>Status</th><th>Set status</th></tr></thead><tbody>
        {rooms.map((r) => <tr key={r._id}><td><b>{r.number}</b></td><td>{r.type}</td><td><Pill s={r.status} /></td><td>{['dirty', 'clean', 'inspected', 'out_of_order'].map((s) => <button key={s} disabled={r.status === s} className="btn ghost sm" style={{ marginRight: 6 }} onClick={() => setStatus(r._id, s)}>{s.replace('_', ' ')}</button>)}</td></tr>)}</tbody></table></div>}
      {open && <Folio id={open} user={user} onClose={() => setOpen(null)} onChange={load} />}
      {nb && <NewBooking preset={nb} onClose={() => setNb(null)} onDone={() => { setNb(null); load(); }} />}
    </>
  );
}
