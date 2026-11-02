import React, { useEffect, useState } from 'react';
import { api, addDays, today, egp } from '../api.js';
import { ExportBtn, Range, Err, Head, Pill, Tabs, money } from '../ui.jsx';

export default function GuestAccounts() {
  const [tab, setTab] = useState('guests'); const [status, setStatus] = useState('in_house');
  const [from, setFrom] = useState(addDays(today(), -30)); const [to, setTo] = useState(today());
  const [g, setG] = useState(null); const [r, setR] = useState(null); const [err, setErr] = useState('');
  useEffect(() => { setErr(''); if (tab === 'guests') api(`/reports/guests?status=${status}&from=${from}&to=${to}`).then(setG).catch((e) => setErr(e.message)); else api(`/reports/rooms?from=${from}&to=${to}`).then(setR).catch((e) => setErr(e.message)); }, [tab, status, from, to]);
  return (
    <>
      <Head title="Guests & rooms accounts" sub="How many guests, what they paid, what is still owed, and how each room did" />
      <Tabs tab={tab} setTab={setTab} tabs={[['guests', 'Guests: bills, paid & owed'], ['rooms', 'Rooms (arrivals, departures, income)']]} />
      <Err e={err} />
      {tab === 'guests' && <>
        <div className="row" style={{ marginBottom: 14 }}>
          <label>Show<select value={status} onChange={(e) => setStatus(e.target.value)}><option value="in_house">Guests staying now</option><option value="reserved">Booked, not arrived yet</option><option value="checked_out">Guests who left</option><option value="all">Everyone</option></select></label>
          {status !== 'in_house' && <Range from={from} to={to} setFrom={setFrom} setTo={setTo} />}
          <ExportBtn kind="guests" params={{ status, from, to }} />
        </div>
        {g && <>
          <div className="cardrow">
            <div className="card"><span>Bookings</span><b>{g.totals.bookings}</b></div>
            <div className="card"><span>Number of people</span><b>{g.totals.people}</b></div>
            <div className="card"><span>Total bills</span><b>{egp(g.totals.charges)}</b></div>
            <div className="card"><span>Paid so far</span><b className="pos-c">{egp(g.totals.paid)}</b></div>
            <div className="card"><span>Still owed</span><b className="neg">{egp(g.totals.remaining)}</b></div>
          </div>
          <div className="card scroll-x"><table><thead><tr><th>Room</th><th>Guest</th><th>Arrives</th><th>Leaves</th><th className="n">People</th><th className="n">Total bill</th><th className="n">Paid</th><th className="n">Still owed</th><th /></tr></thead><tbody>
            {g.rows.map((x) => <tr key={x.code}><td><b>{x.room}</b></td><td>{x.guest}<br /><small>{x.nationality} · {x.code}</small></td><td>{x.checkIn}</td><td>{x.checkOut}</td><td className="n">{x.people}</td><td className="n">{money(x.charges)}</td><td className="n">{money(x.paid)}</td><td className={'n ' + (x.remaining > 0.01 ? 'neg' : '')}>{money(x.remaining)}</td><td><Pill s={x.status} /></td></tr>)}
            <tr className="total"><td colSpan="4">Total</td><td className="n">{g.totals.people}</td><td className="n">{money(g.totals.charges)}</td><td className="n">{money(g.totals.paid)}</td><td className="n">{money(g.totals.remaining)}</td><td /></tr></tbody></table></div></>}
      </>}
      {tab === 'rooms' && <>
        <div className="row" style={{ marginBottom: 14 }}><Range from={from} to={to} setFrom={setFrom} setTo={setTo} /><ExportBtn kind="rooms" params={{ from, to }} /></div>
        {r && <>
          <div className="cardrow"><div className="card"><span>Rooms</span><b>{r.totals.rooms}</b></div><div className="card"><span>Taken now</span><b>{r.totals.occupiedNow}</b></div><div className="card"><span>Nights sold in this period</span><b>{r.totals.nights}</b></div><div className="card"><span>Room income (before tax)</span><b>{egp(r.totals.income)}</b></div></div>
          <div className="card scroll-x"><table><thead><tr><th>Room</th><th>Type</th><th>Guest now</th><th>Arrived</th><th>Leaves</th><th>Next guest</th><th className="n">Nights sold</th><th className="n">Income</th><th className="n">Busy</th></tr></thead><tbody>
            {r.rows.map((x) => <tr key={x.room}><td><b>{x.room}</b> <Pill s={x.status} /></td><td>{x.type}</td><td>{x.guest || <small>empty</small>}</td><td>{x.arrives}</td><td>{x.leaves}</td><td><small>{x.nextGuest}</small></td><td className="n">{x.nights}</td><td className="n">{money(x.income)}</td><td className="n">{x.occupancyPct}%</td></tr>)}</tbody></table></div></>}
      </>}
    </>
  );
}
