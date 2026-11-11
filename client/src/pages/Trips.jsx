import React, { useEffect, useState } from 'react';
import { api, addDays, today, egp } from '../api.js';
import { ExportBtn, Range, Err, Head, Modal, Pill, money } from '../ui.jsx';
import { tr, tm, rich } from '../i18n.js';

const blank = () => ({ kind: 'tour', title: '', destination: '', date: today(), time: '09:00', company: '', driver: '', pax: 2, price: '', companyCost: '', transportCost: '', payment: 'room', bookingId: '', guestName: '', notes: '' });

export default function Trips() {
  const [from, setFrom] = useState(addDays(today(), -30)); const [to, setTo] = useState(addDays(today(), 60));
  const [d, setD] = useState(null); const [err, setErr] = useState(''); const [f, setF] = useState(null); const [guests, setGuests] = useState([]); const [fe, setFe] = useState('');
  const load = () => api(`/trips?from=${from}&to=${to}`).then(setD).catch((e) => setErr(e.message)); useEffect(() => { setErr(''); load(); }, [from, to]);
  useEffect(() => { api('/inhouse?all=1').then(setGuests).catch(() => {}); }, []);
  const act = async (fn) => { setErr(''); try { await fn(); load(); } catch (e) { setErr(e.message); } };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const kindChange = (e) => setF({ ...f, kind: e.target.value, title: e.target.value === 'airport' ? tr('Hotel → Airport') : '', pax: e.target.value === 'airport' ? 1 : 2 });
  const save = async () => { setFe(''); try { await api('/trips', { method: 'POST', body: f }); setF(null); load(); } catch (e) { setFe(e.message); } };
  const profit = (+f?.price || 0) - (+f?.companyCost || 0) - (+f?.transportCost || 0);
  return (
    <>
      <Head title={tr("Trips & airport rides")} sub={tr("Tours inside Egypt, and rides from the hotel to the airport: what guests pay, what the company and cars cost, and your profit")}>
        <Range from={from} to={to} setFrom={setFrom} setTo={setTo} /><ExportBtn kind="trips" params={{ from, to }} /><button className="btn gold" onClick={() => { setFe(''); setF(blank()); }}>{tr("Book a trip or ride")}</button>
      </Head>
      <Err e={err} />
      {d && <>
        <div className="cardrow">
          <div className="card"><span>{tr("Trips & rides")}</span><b>{d.totals.trips}</b></div><div className="card"><span>{tr("People")}</span><b>{d.totals.pax}</b></div>
          <div className="card"><span>{tr("Charged to guests")}</span><b>{egp(d.totals.income)}</b></div><div className="card"><span>{tr("Paid / owed to companies & cars")}</span><b>{egp(d.totals.cost)}</b></div>
          <div className="card"><span>{tr("Profit")}</span><b className="pos-c">{egp(d.totals.profit)}</b></div><div className="card"><span>{tr("Still to pay companies")}</span><b className="neg">{egp(d.totals.owed)}</b></div>
        </div>
        <div className="card scroll-x"><table><thead><tr><th>{tr("When")}</th><th>{tr("Trip")}</th><th>{tr("Company / driver")}</th><th>{tr("Guest")}</th><th className="n">{tr("People")}</th><th className="n">{tr("Guest pays")}</th><th className="n">{tr("Our cost")}</th><th className="n">{tr("Profit")}</th><th>{tr("Status")}</th><th /></tr></thead><tbody>
          {d.rows.map((t) => <tr key={t.id} style={t.status === 'cancelled' ? { opacity: 0.5 } : {}}>
            <td>{t.date}<br /><small>{t.time}</small></td><td><b>{tr(t.title)}</b><br /><small>{tr(t.kind === 'airport' ? 'Airport ride' : 'Tour')}{t.destination ? ` · ${tr(t.destination)}` : ''}</small></td><td>{t.company || '–'}<br /><small>{t.driver}</small></td><td>{t.guest}<br /><small>{t.payment === 'room' ? tr('on room bill') : tr('paid {method}', { method: tr(t.payment) })}</small></td>
            <td className="n">{t.pax}</td><td className="n">{money(t.price)}</td><td className="n">{money(t.cost)}<br /><small>{t.cost > 0 ? tr(t.costPaid ? 'paid' : 'not paid yet') : ''}</small></td><td className="n">{money(t.profit)}</td><td><Pill s={t.status === 'planned' ? 'reserved' : t.status === 'done' ? 'paid' : 'alert'} label={t.status} /></td>
            <td>{t.status !== 'cancelled' && <>
              {t.cost > 0 && !t.costPaid && <button className="btn sm" onClick={() => act(() => api(`/trips/${t.id}/pay`, { method: 'POST', body: { method: 'cash' } }))}>{tr("Pay company")}</button>} {t.status === 'planned' && <button className="btn ghost sm" onClick={() => act(() => api(`/trips/${t.id}/done`, { method: 'POST' }))}>{tr("Done")}</button>} <button className="btn ghost sm" onClick={() => confirm(tr('Cancel this trip? Money charged to the guest and costs are reversed.')) && act(() => api(`/trips/${t.id}/cancel`, { method: 'POST' }))}>{tr("Cancel")}</button></>}</td></tr>)}
          {!d.rows.length && <tr><td colSpan="10">{tr("No trips in this period.")}</td></tr>}</tbody></table></div>
        {d.companies.length > 0 && <div className="card" style={{ marginTop: 14, maxWidth: 560 }}><h3>{tr("By company / driver")}</h3><table><thead><tr><th>{tr("Company")}</th><th className="n">{tr("Trips")}</th><th className="n">{tr("Cost")}</th><th className="n">{tr("Still owed")}</th></tr></thead><tbody>{d.companies.map((c) => <tr key={c.company}><td>{c.company}</td><td className="n">{c.trips}</td><td className="n">{money(c.cost)}</td><td className="n">{money(c.owed)}</td></tr>)}</tbody></table></div>}
      </>}
      {f && <Modal title={tr(f.kind === 'airport' ? 'Book an airport ride' : 'Book a tour')} onClose={() => setF(null)}>
        <div className="grid g2">
          <label>{tr("Type")}<select value={f.kind} onChange={kindChange}><option value="tour">{tr("Tour inside Egypt")}</option><option value="airport">{tr("Ride from hotel to airport")}</option></select></label>
          <label>{tr("Name of the trip")}<input value={f.title} onChange={set('title')} placeholder={tr(f.kind === 'airport' ? 'Hotel → Airport' : 'Pyramids day trip')} /></label>
          <label>{tr("Date")}<input type="date" value={f.date} onChange={set('date')} /></label><label>{tr("Pick-up time")}<input type="time" value={f.time} onChange={set('time')} /></label>
          {f.kind === 'tour' && <label>{tr("Where to")}<input value={f.destination} onChange={set('destination')} /></label>}
          <label>{tr("Number of people")}<input type="number" min="1" value={f.pax} onChange={set('pax')} /></label>
          <label>{tr(f.kind === 'airport' ? 'Car company' : 'Tour company')}<input list="co" value={f.company} onChange={set('company')} /><datalist id="co">{[...new Set((d?.rows || []).map((r) => r.company).filter(Boolean))].map((c) => <option key={c} value={c} />)}</datalist></label>
          {f.kind === 'airport' && <label>{tr("Driver")}<input value={f.driver} onChange={set('driver')} /></label>}
          <label>{tr("Total the guest pays (EGP)")}<input type="number" value={f.price} onChange={set('price')} /></label>
          {f.kind === 'tour' && <label>{tr("Cost: tour company (EGP)")}<input type="number" value={f.companyCost} onChange={set('companyCost')} /></label>}
          <label>{tr("Cost: car & driver (EGP)")}<input type="number" value={f.transportCost} onChange={set('transportCost')} /></label>
          <label>{tr("How does the guest pay?")}<select value={f.payment} onChange={set('payment')}><option value="room">{tr("Add to the guest's room bill")}</option><option value="cash">{tr("Guest pays cash at reception")}</option><option value="card">{tr("Guest pays by card")}</option></select></label>
          {f.payment === 'room' ? <label>{tr("Guest")}<select value={f.bookingId} onChange={set('bookingId')}><option value="">{tr("Choose a guest…")}</option>{guests.map((b) => <option key={b._id} value={b._id}>{tr('Room {n}', { n: b.room.number })} · {b.guest.name}{b.status === 'reserved' ? ` (${tr('booked')})` : ''}</option>)}</select></label>
            : <label>{tr("Guest name")}<input value={f.guestName} onChange={set('guestName')} /></label>}
        </div>
        <p className="help" style={{ marginTop: 12 }}>{rich('Your profit on this trip: <b>{profit}</b>. The costs are saved as money you owe the company until you press "Pay company".', { profit: egp(profit) })}</p>
        <Err e={fe} /><button className="btn gold" disabled={!f.title || !(+f.price >= 0) || (f.payment === 'room' && !f.bookingId)} onClick={save}>{tr("Save trip")}</button></Modal>}
    </>
  );
}
