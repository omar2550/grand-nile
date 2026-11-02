import React, { useEffect, useState } from 'react';
import { api, addDays, today, egp } from '../api.js';
import { ExportBtn, Range, Err, Head, Modal, Pill, money } from '../ui.jsx';

const blank = () => ({ kind: 'tour', title: '', destination: '', date: today(), time: '09:00', company: '', driver: '', pax: 2, price: '', companyCost: '', transportCost: '', payment: 'room', bookingId: '', guestName: '', notes: '' });

export default function Trips() {
  const [from, setFrom] = useState(addDays(today(), -30)); const [to, setTo] = useState(addDays(today(), 60));
  const [d, setD] = useState(null); const [err, setErr] = useState(''); const [f, setF] = useState(null); const [guests, setGuests] = useState([]); const [fe, setFe] = useState('');
  const load = () => api(`/trips?from=${from}&to=${to}`).then(setD).catch((e) => setErr(e.message)); useEffect(() => { setErr(''); load(); }, [from, to]);
  useEffect(() => { api('/inhouse?all=1').then(setGuests).catch(() => {}); }, []);
  const act = async (fn) => { setErr(''); try { await fn(); load(); } catch (e) { setErr(e.message); } };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const kindChange = (e) => setF({ ...f, kind: e.target.value, title: e.target.value === 'airport' ? 'Hotel → Airport' : '', pax: e.target.value === 'airport' ? 1 : 2 });
  const save = async () => { setFe(''); try { await api('/trips', { method: 'POST', body: f }); setF(null); load(); } catch (e) { setFe(e.message); } };
  const profit = (+f?.price || 0) - (+f?.companyCost || 0) - (+f?.transportCost || 0);
  return (
    <>
      <Head title="Trips & airport rides" sub="Tours inside Egypt, and rides from the hotel to the airport: what guests pay, what the company and cars cost, and your profit">
        <Range from={from} to={to} setFrom={setFrom} setTo={setTo} /><ExportBtn kind="trips" params={{ from, to }} /><button className="btn gold" onClick={() => { setFe(''); setF(blank()); }}>Book a trip or ride</button>
      </Head>
      <Err e={err} />
      {d && <>
        <div className="cardrow">
          <div className="card"><span>Trips & rides</span><b>{d.totals.trips}</b></div><div className="card"><span>People</span><b>{d.totals.pax}</b></div>
          <div className="card"><span>Charged to guests</span><b>{egp(d.totals.income)}</b></div><div className="card"><span>Paid / owed to companies & cars</span><b>{egp(d.totals.cost)}</b></div>
          <div className="card"><span>Profit</span><b className="pos-c">{egp(d.totals.profit)}</b></div><div className="card"><span>Still to pay companies</span><b className="neg">{egp(d.totals.owed)}</b></div>
        </div>
        <div className="card scroll-x"><table><thead><tr><th>When</th><th>Trip</th><th>Company / driver</th><th>Guest</th><th className="n">People</th><th className="n">Guest pays</th><th className="n">Our cost</th><th className="n">Profit</th><th>Status</th><th /></tr></thead><tbody>
          {d.rows.map((t) => <tr key={t.id} style={t.status === 'cancelled' ? { opacity: 0.5 } : {}}>
            <td>{t.date}<br /><small>{t.time}</small></td><td><b>{t.title}</b><br /><small>{t.kind === 'airport' ? 'Airport ride' : 'Tour'}{t.destination ? ` · ${t.destination}` : ''}</small></td><td>{t.company || '–'}<br /><small>{t.driver}</small></td><td>{t.guest}<br /><small>{t.payment === 'room' ? 'on room bill' : `paid ${t.payment}`}</small></td>
            <td className="n">{t.pax}</td><td className="n">{money(t.price)}</td><td className="n">{money(t.cost)}<br /><small>{t.cost > 0 ? (t.costPaid ? 'paid' : 'not paid yet') : ''}</small></td><td className="n">{money(t.profit)}</td><td><Pill s={t.status === 'planned' ? 'reserved' : t.status === 'done' ? 'paid' : 'alert'} label={t.status} /></td>
            <td>{t.status !== 'cancelled' && <>
              {t.cost > 0 && !t.costPaid && <button className="btn sm" onClick={() => act(() => api(`/trips/${t.id}/pay`, { method: 'POST', body: { method: 'cash' } }))}>Pay company</button>} {t.status === 'planned' && <button className="btn ghost sm" onClick={() => act(() => api(`/trips/${t.id}/done`, { method: 'POST' }))}>Done</button>} <button className="btn ghost sm" onClick={() => confirm('Cancel this trip? Money charged to the guest and costs are reversed.') && act(() => api(`/trips/${t.id}/cancel`, { method: 'POST' }))}>Cancel</button></>}</td></tr>)}
          {!d.rows.length && <tr><td colSpan="10">No trips in this period.</td></tr>}</tbody></table></div>
        {d.companies.length > 0 && <div className="card" style={{ marginTop: 14, maxWidth: 560 }}><h3>By company / driver</h3><table><thead><tr><th>Company</th><th className="n">Trips</th><th className="n">Cost</th><th className="n">Still owed</th></tr></thead><tbody>{d.companies.map((c) => <tr key={c.company}><td>{c.company}</td><td className="n">{c.trips}</td><td className="n">{money(c.cost)}</td><td className="n">{money(c.owed)}</td></tr>)}</tbody></table></div>}
      </>}
      {f && <Modal title={f.kind === 'airport' ? 'Book an airport ride' : 'Book a tour'} onClose={() => setF(null)}>
        <div className="grid g2">
          <label>Type<select value={f.kind} onChange={kindChange}><option value="tour">Tour inside Egypt</option><option value="airport">Ride from hotel to airport</option></select></label>
          <label>Name of the trip<input value={f.title} onChange={set('title')} placeholder={f.kind === 'airport' ? 'Hotel → Airport' : 'Pyramids day trip'} /></label>
          <label>Date<input type="date" value={f.date} onChange={set('date')} /></label><label>Pick-up time<input type="time" value={f.time} onChange={set('time')} /></label>
          {f.kind === 'tour' && <label>Where to<input value={f.destination} onChange={set('destination')} /></label>}
          <label>Number of people<input type="number" min="1" value={f.pax} onChange={set('pax')} /></label>
          <label>{f.kind === 'airport' ? 'Car company' : 'Tour company'}<input list="co" value={f.company} onChange={set('company')} /><datalist id="co">{[...new Set((d?.rows || []).map((r) => r.company).filter(Boolean))].map((c) => <option key={c} value={c} />)}</datalist></label>
          {f.kind === 'airport' && <label>Driver<input value={f.driver} onChange={set('driver')} /></label>}
          <label>Total the guest pays (EGP)<input type="number" value={f.price} onChange={set('price')} /></label>
          {f.kind === 'tour' && <label>Cost: tour company (EGP)<input type="number" value={f.companyCost} onChange={set('companyCost')} /></label>}
          <label>Cost: car & driver (EGP)<input type="number" value={f.transportCost} onChange={set('transportCost')} /></label>
          <label>How does the guest pay?<select value={f.payment} onChange={set('payment')}><option value="room">Add to the guest's room bill</option><option value="cash">Guest pays cash at reception</option><option value="card">Guest pays by card</option></select></label>
          {f.payment === 'room' ? <label>Guest<select value={f.bookingId} onChange={set('bookingId')}><option value="">Choose a guest…</option>{guests.map((b) => <option key={b._id} value={b._id}>Room {b.room.number} · {b.guest.name}{b.status === 'reserved' ? ' (booked)' : ''}</option>)}</select></label>
            : <label>Guest name<input value={f.guestName} onChange={set('guestName')} /></label>}
        </div>
        <p className="help" style={{ marginTop: 12 }}>Your profit on this trip: <b>{egp(profit)}</b>. The costs are saved as money you owe the company until you press "Pay company".</p>
        <Err e={fe} /><button className="btn gold" disabled={!f.title || !(+f.price >= 0) || (f.payment === 'room' && !f.bookingId)} onClick={save}>Save trip</button></Modal>}
    </>
  );
}
