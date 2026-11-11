import React, { useCallback, useEffect, useState } from 'react';
import { api, egp, today, addDays, dayDiff } from '../api.js';
import { Modal, Pill, Err, Head } from '../ui.jsx';
import { tr, tm, lang, dir, locale, ARROW, isAr } from '../i18n.js';

const DAYS = 28, CW = 46;
const esc = (x) => String(x ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const cur = (n) => (isAr ? `${n} ج.م` : `EGP ${n}`);
const invoiceHtml = (f) => `<html lang="${lang}" dir="${dir}"><head><meta charset="utf-8"><title>${esc(tr('Invoice'))} ${esc(f.booking.code)}</title><style>body{font:14px Arial,Tahoma,sans-serif;padding:30px}table{width:100%;border-collapse:collapse}td,th{padding:6px;border-bottom:1px solid #ccc;text-align:start}.r{text-align:end}</style></head><body>
<h2>${esc(tr(localStorage.getItem('gn_hotel_name')))} – ${esc(tr('Guest Bill'))}</h2><p>${esc(f.booking.guest.name)} · ${esc(tr('Room {n}', { n: f.booking.room.number }))} · ${esc(f.booking.checkIn)} ${ARROW} ${esc(f.booking.checkOut)} · ${esc(f.booking.code)}</p>
<table><tr><th>${esc(tr('Date'))}</th><th>${esc(tr('Description'))}</th><th class="r">${esc(tr('Net'))}</th><th class="r">${esc(tr('Service 12%'))}</th><th class="r">${esc(tr('VAT 14%'))}</th><th class="r">${esc(tr('Total'))}</th></tr>
${f.entries.map((e) => `<tr><td>${esc(e.date)}</td><td>${esc(tm(e.description))}</td><td class="r">${e.kind === 'charge' ? e.net.toFixed(2) : ''}</td><td class="r">${e.kind === 'charge' ? e.service.toFixed(2) : ''}</td><td class="r">${e.kind === 'charge' ? e.vat.toFixed(2) : ''}</td><td class="r">${e.kind === 'payment' ? '-' : ''}${e.total.toFixed(2)}</td></tr>`).join('')}
</table><h3 class="r">${esc(tr('Balance due'))}: ${cur(f.balance.toFixed(2))}</h3><script>window.print()</script></body></html>`;

function Folio({ id, onClose, onChange, user }) {
  const [f, setF] = useState(null); const [err, setErr] = useState('');
  const [chg, setChg] = useState({ dept: 'minibar', description: '', net: '' }); const [pay, setPay] = useState({ amount: '', method: 'cash' });
  const load = useCallback(() => api(`/bookings/${id}/folio`).then(setF), [id]); useEffect(() => { load(); }, [load]);
  const run = async (fn) => { setErr(''); try { await fn(); await load(); onChange(); } catch (e) { setErr(e.message); } };
  if (!f) return null; const b = f.booking, canVoid = ['admin', 'manager'].includes(user.role);
  return (
    <Modal wide title={`${b.guest.name}  ·  ${tr('Room {n}', { n: b.room.number })}`} onClose={onClose}>
      <div className="row" style={{ marginBottom: 12 }}>
        <div><Pill s={b.status} /> <b className="mono">{b.code}</b><br /><small>{b.checkIn} {ARROW} {b.checkOut} · {tr('{n} nights', { n: dayDiff(b.checkIn, b.checkOut) })} · {tr(b.board)} · {tr(b.source)}</small></div>
        <div style={{ textAlign: 'end' }}><small>{tr("Amount still owed")}</small><h2 style={{ color: f.balance > 0 ? 'var(--hib)' : 'var(--ok)' }}>{egp(f.balance)}</h2></div>
      </div>
      <Err e={err} />
      <div className="scroll-x"><table><thead><tr><th>{tr("Date")}</th><th>{tr("Item")}</th><th className="n">{tr("Net")}</th><th className="n">{tr("Svc+VAT")}</th><th className="n">{tr("Total")}</th><th /></tr></thead><tbody>
        {f.entries.map((e) => <tr key={e._id}><td>{e.date}</td><td>{tm(e.description)} <small>({tr(e.dept)})</small></td><td className="n">{e.kind === 'charge' ? e.net.toFixed(2) : ''}</td><td className="n">{e.kind === 'charge' ? (e.service + e.vat).toFixed(2) : ''}</td>
          <td className="n" style={{ color: e.kind === 'payment' ? 'var(--ok)' : undefined }}>{e.kind === 'payment' ? '−' : ''}{e.total.toFixed(2)}</td>
          <td>{canVoid && <button className="btn ghost sm" onClick={() => confirm(tr('Cancel this line? It will be taken off the bill and the accounts will be corrected.')) && run(() => api(`/folio/${e._id}/void`, { method: 'POST' }))}>{tr("Cancel line")}</button>}</td></tr>)}
        <tr className="total"><td colSpan="4">{tr('Charges {a} − payments {b}', { a: egp(f.charges), b: egp(f.payments) })}</td><td className="n">{f.balance.toFixed(2)}</td><td /></tr></tbody></table></div>
      {b.status !== 'checked_out' && b.status !== 'cancelled' && <div className="grid g2" style={{ marginTop: 14 }}>
        <div className="row"><label>{tr("Post a charge")}<select value={chg.dept} onChange={(e) => setChg({ ...chg, dept: e.target.value })}><option value="minibar">{tr("Minibar")}</option><option value="laundry">{tr("Laundry")}</option><option value="spa">{tr("Spa")}</option><option value="restaurant">{tr("Restaurant")}</option><option value="other">{tr("Other")}</option></select></label>
          <label>{tr("Description")}<input value={chg.description} onChange={(e) => setChg({ ...chg, description: e.target.value })} /></label>
          <label>{tr("Net EGP")}<input type="number" value={chg.net} onChange={(e) => setChg({ ...chg, net: e.target.value })} /></label>
          <button className="btn" onClick={() => run(async () => { await api(`/bookings/${id}/charge`, { method: 'POST', body: chg }); setChg({ ...chg, description: '', net: '' }); })}>{tr("Post")}</button></div>
        <div className="row"><label>{tr("Take a payment")}<select value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}><option value="cash">{tr("Cash")}</option><option value="card">{tr("Card")}</option><option value="transfer">{tr("Bank transfer")}</option></select></label>
          <label>{tr("Amount EGP")}<input type="number" value={pay.amount} placeholder={f.balance > 0 ? f.balance : ''} onChange={(e) => setPay({ ...pay, amount: e.target.value })} /></label>
          <button className="btn gold" onClick={() => run(async () => { await api(`/bookings/${id}/payment`, { method: 'POST', body: pay }); setPay({ ...pay, amount: '' }); })}>{tr("Receive")}</button></div></div>}
      <div className="row" style={{ marginTop: 18, justifyContent: 'flex-end' }}>
        <button className="btn ghost" onClick={() => { const w = window.open('', '_blank'); w.document.write(invoiceHtml(f)); w.document.close(); }}>{tr("Print invoice")}</button>
        {b.status === 'reserved' && <><button className="btn ghost" onClick={() => run(() => api(`/bookings/${id}/cancel`, { method: 'POST' }))}>{tr("Cancel booking")}</button><button className="btn" onClick={() => run(() => api(`/bookings/${id}/checkin`, { method: 'POST' }))}>{tr("Check in")}</button></>}
        {b.status === 'in_house' && <button className="btn gold" onClick={() => run(() => api(`/bookings/${id}/checkout`, { method: 'POST' }))}>{tr("Check out")}</button>}
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
    <Modal title={tr("New reservation")} onClose={onClose}>
      <div className="grid g2"><label>{tr("Guest name")}<input value={f.name} onChange={set('name')} autoFocus /></label><label>{tr("Phone")}<input value={f.phone} onChange={set('phone')} /></label>
        <label>{tr("Nationality")}<input value={f.nationality} onChange={set('nationality')} /></label><label>{tr("Email")}<input value={f.email} onChange={set('email')} /></label>
        <label>{tr("Check-in")}<input type="date" value={f.checkIn} onChange={set('checkIn')} /></label><label>{tr("Check-out")}<input type="date" value={f.checkOut} onChange={set('checkOut')} /></label>
        <label>{tr("Available room")}<select value={f.roomId} onChange={set('roomId')}><option value="">{tr("Choose a room…")}</option>{free.map((r) => <option key={r._id} value={r._id}>{r.number} · {tr(r.type)} · {tr('{view} view', { view: tr(r.view) })} · {egp(r.rate)}</option>)}</select></label>
        <label>{tr("Nightly rate (EGP)")}<input type="number" value={f.rate} placeholder={room ? room.rate : ''} onChange={set('rate')} /></label>
        <label>{tr("Meal plan")}<select value={f.board} onChange={set('board')}><option value="RO">{tr("Room only")}</option><option value="BB">{tr("Bed & breakfast")}</option><option value="HB">{tr("Half board")}</option></select></label>
        <label>{tr("Source")}<select value={f.source} onChange={set('source')}>{['Direct', 'Booking.com', 'Expedia', 'Corporate', 'Travel Agent', 'Walk-in'].map((s) => <option key={s} value={s}>{tr(s)}</option>)}</select></label></div>
      <Err e={err} /><div className="row" style={{ justifyContent: 'flex-end', marginTop: 14 }}><button className="btn gold" disabled={!f.name || !f.roomId} onClick={submit}>{tr("Create reservation")}</button></div>
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
      <Head title={tr("Reception")} sub={tr("Room calendar, bookings and guest bills")}>
        <button className="btn ghost" onClick={async () => { const r = await api('/night-audit', { method: 'POST', body: {} }); setMsg(tr('Done: {n} room charges were added to guest bills for {date}.', { n: r.posted, date: r.date })); load(); }}>{tr("Add today's room charges to bills")}</button>
        <button className="btn gold" onClick={() => setNb({ date: today() })}>{tr("New reservation")}</button>
      </Head>
      {msg && <div className="ok">{msg}</div>}<Err e={err} />
      <div className="tabs">{[['tape', tr('Room calendar')], ['today', tr('Arrivals & departures')], ['find', tr('Find a booking')], ['hk', tr('Room cleaning')]].map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'tape' && <>
        <div className="legend"><span><i style={{ background: 'var(--lapis)' }} />{tr("Booked (not arrived)")}</span><span><i style={{ background: 'var(--teal)' }} />{tr("Staying now")}</span><span><i style={{ background: 'var(--stone)' }} />{tr("Already left")}</span><span>{tr("Click an empty night to book it. Click a stay to open the folio.")}</span></div>
        <div className="tape" style={{ '--days': DAYS, '--cw': CW + 'px' }}>
          <div className="hdr"><div className="key">{tr("Room")}</div>{days.map((d) => { const dt = new Date(d + 'T00:00:00Z'); return <div key={d} className={(d === today() ? 'today ' : '') + ([5, 6].includes(dt.getUTCDay()) ? 'we' : '')}>{dt.toLocaleDateString(locale, { weekday: 'short', timeZone: 'UTC' })}<br /><b>{dt.getUTCDate()}</b></div>; })}</div>
          {rooms.map((r) => (
            <div className="rrow" key={r._id}>
              <div className="key"><b>{r.number}</b>{tr(({ 'Deluxe View': 'Deluxe', 'Family Suite': 'Family', 'Royal Suite': 'Royal' })[r.type] || r.type)}</div>
              {days.map((d) => <div key={d} className={'cell' + (d === today() ? ' today' : '') + (r.status === 'out_of_order' ? ' ooo' : '')} onClick={() => r.status !== 'out_of_order' && setNb({ date: d, roomId: r._id })} />)}
              {bookings.filter((b) => String(b.room) === r._id).map((b) => { const s = Math.max(0, dayDiff(from, b.checkIn)), e = Math.min(DAYS, dayDiff(from, b.checkOut)); if (e <= s) return null;
                return <button key={b._id} className={'bar ' + b.status} style={{ left: 130 + s * CW + 2, width: (e - s) * CW - 4 }} title={`${b.guest.name} · ${b.checkIn} ${ARROW} ${b.checkOut}`} onClick={() => setOpen(b._id)}>{b.guest.vip && '★ '}{b.guest.name}</button>; })}
            </div>))}
        </div></>}
      {tab === 'today' && td && <div className="grid g2">
        <div className="card"><h3>{tr('Guests arriving ({n})', { n: td.arrivals.length })}</h3><table><tbody>{td.arrivals.map((b) => <tr key={b._id}><td><b>{b.guest.name}</b><br /><small>{b.code} · {b.checkIn} {ARROW} {b.checkOut}</small></td><td>{tr('Room {n}', { n: b.room.number })}</td><td><button className="btn sm" onClick={async () => { setErr(''); try { await api(`/bookings/${b._id}/checkin`, { method: 'POST' }); load(); } catch (e) { setErr(e.message); } }}>{tr("Check in")}</button></td></tr>)}{!td.arrivals.length && <tr><td>{tr("Nobody is waiting to arrive.")}</td></tr>}</tbody></table></div>
        <div className="card"><h3>{tr('Guests leaving today ({n})', { n: td.departures.length })}</h3><table><tbody>{td.departures.map((b) => <tr key={b._id}><td><b>{b.guest.name}</b><br /><small>{b.code}</small></td><td>{tr('Room {n}', { n: b.room.number })}</td><td><button className="btn gold sm" onClick={() => setOpen(b._id)}>{tr("Open bill & check out")}</button></td></tr>)}{!td.departures.length && <tr><td>{tr("Nobody is leaving today.")}</td></tr>}</tbody></table></div>
        <div className="card"><h3>{tr('Staying now ({n})', { n: td.inHouse.length })}</h3><div className="scroll-x" style={{ maxHeight: 340, overflow: 'auto' }}><table><tbody>{td.inHouse.map((b) => <tr key={b._id}><td>{b.guest.name}</td><td>{tr('Room {n}', { n: b.room.number })}</td><td>{tr('leaves {date}', { date: b.checkOut })}</td><td><button className="btn ghost sm" onClick={() => setOpen(b._id)}>{tr("Bill")}</button></td></tr>)}</tbody></table></div></div>
        <div className="card"><h3>{tr('Arriving tomorrow ({n})', { n: td.tomorrow.length })}</h3><table><tbody>{td.tomorrow.map((b) => <tr key={b._id}><td>{b.guest.name}</td><td>{tr('Room {n}', { n: b.room.number })}</td><td>{tr('{n} people', { n: b.adults + b.children })}</td></tr>)}{!td.tomorrow.length && <tr><td>{tr("No bookings arriving tomorrow.")}</td></tr>}</tbody></table></div>
      </div>}
      {tab === 'find' && <div className="card"><label>{tr("Guest name, phone or booking code")}<input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Try “Hassan” or GN00042")} /></label>
        <table style={{ marginTop: 12 }}><tbody>{found.map((b) => <tr key={b._id}><td>{b.code}</td><td>{b.guest.name}</td><td>{tr('Room {n}', { n: b.room.number })}</td><td>{b.checkIn} {ARROW} {b.checkOut}</td><td><Pill s={b.status} /></td><td><button className="btn sm" onClick={() => setOpen(b._id)}>{tr("Open folio")}</button></td></tr>)}</tbody></table></div>}
      {tab === 'hk' && <div className="card scroll-x"><table><thead><tr><th>{tr("Room")}</th><th>{tr("Type")}</th><th>{tr("Status")}</th><th>{tr("Set status")}</th></tr></thead><tbody>
        {rooms.map((r) => <tr key={r._id}><td><b>{r.number}</b></td><td>{tr(r.type)}</td><td><Pill s={r.status} /></td><td>{['dirty', 'clean', 'inspected', 'out_of_order'].map((s) => <button key={s} disabled={r.status === s} className="btn ghost sm" style={{ marginRight: 6 }} onClick={() => setStatus(r._id, s)}>{tr(s.replace('_', ' '))}</button>)}</td></tr>)}</tbody></table></div>}
      {open && <Folio id={open} user={user} onClose={() => setOpen(null)} onChange={load} />}
      {nb && <NewBooking preset={nb} onClose={() => setNb(null)} onDone={() => { setNb(null); load(); }} />}
    </>
  );
}
