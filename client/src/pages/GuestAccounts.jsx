import React, { useEffect, useState } from 'react';
import { api, addDays, today, egp } from '../api.js';
import { ExportBtn, Range, Err, Head, Pill, Tabs, money } from '../ui.jsx';
import { tr } from '../i18n.js';

export default function GuestAccounts() {
  const [tab, setTab] = useState('guests'); const [status, setStatus] = useState('in_house');
  const [from, setFrom] = useState(addDays(today(), -30)); const [to, setTo] = useState(today());
  const [g, setG] = useState(null); const [r, setR] = useState(null); const [err, setErr] = useState('');
  useEffect(() => { setErr(''); if (tab === 'guests') api(`/reports/guests?status=${status}&from=${from}&to=${to}`).then(setG).catch((e) => setErr(e.message)); else api(`/reports/rooms?from=${from}&to=${to}`).then(setR).catch((e) => setErr(e.message)); }, [tab, status, from, to]);
  return (
    <>
      <Head title={tr("Guests & rooms accounts")} sub={tr("How many guests, what they paid, what is still owed, and how each room did")} />
      <Tabs tab={tab} setTab={setTab} tabs={[['guests', tr("Guests: bills, paid & owed")], ['rooms', tr("Rooms (arrivals, departures, income)")]]} />
      <Err e={err} />
      {tab === 'guests' && <>
        <div className="row" style={{ marginBottom: 14 }}>
          <label>{tr("Show")}<select value={status} onChange={(e) => setStatus(e.target.value)}><option value="in_house">{tr("Guests staying now")}</option><option value="reserved">{tr("Booked, not arrived yet")}</option><option value="checked_out">{tr("Guests who left")}</option><option value="all">{tr("Everyone")}</option></select></label>
          {status !== 'in_house' && <Range from={from} to={to} setFrom={setFrom} setTo={setTo} />}
          <ExportBtn kind="guests" params={{ status, from, to }} />
        </div>
        {g && <>
          <div className="cardrow">
            <div className="card"><span>{tr("Bookings")}</span><b>{g.totals.bookings}</b></div>
            <div className="card"><span>{tr("Number of people")}</span><b>{g.totals.people}</b></div>
            <div className="card"><span>{tr("Total bills")}</span><b>{egp(g.totals.charges)}</b></div>
            <div className="card"><span>{tr("Paid so far")}</span><b className="pos-c">{egp(g.totals.paid)}</b></div>
            <div className="card"><span>{tr("Still owed")}</span><b className="neg">{egp(g.totals.remaining)}</b></div>
          </div>
          <div className="card scroll-x"><table><thead><tr><th>{tr("Room")}</th><th>{tr("Guest")}</th><th>{tr("Arrives")}</th><th>{tr("Leaves")}</th><th className="n">{tr("People")}</th><th className="n">{tr("Total bill")}</th><th className="n">{tr("Paid")}</th><th className="n">{tr("Still owed")}</th><th /></tr></thead><tbody>
            {g.rows.map((x) => <tr key={x.code}><td><b>{x.room}</b></td><td>{x.guest}<br /><small>{tr(x.nationality)} · {x.code}</small></td><td>{x.checkIn}</td><td>{x.checkOut}</td><td className="n">{x.people}</td><td className="n">{money(x.charges)}</td><td className="n">{money(x.paid)}</td><td className={'n ' + (x.remaining > 0.01 ? 'neg' : '')}>{money(x.remaining)}</td><td><Pill s={x.status} /></td></tr>)}
            <tr className="total"><td colSpan="4">{tr("Total")}</td><td className="n">{g.totals.people}</td><td className="n">{money(g.totals.charges)}</td><td className="n">{money(g.totals.paid)}</td><td className="n">{money(g.totals.remaining)}</td><td /></tr></tbody></table></div></>}
      </>}
      {tab === 'rooms' && <>
        <div className="row" style={{ marginBottom: 14 }}><Range from={from} to={to} setFrom={setFrom} setTo={setTo} /><ExportBtn kind="rooms" params={{ from, to }} /></div>
        {r && <>
          <div className="cardrow"><div className="card"><span>{tr("Rooms")}</span><b>{r.totals.rooms}</b></div><div className="card"><span>{tr("Taken now")}</span><b>{r.totals.occupiedNow}</b></div><div className="card"><span>{tr("Nights sold in this period")}</span><b>{r.totals.nights}</b></div><div className="card"><span>{tr("Room income (before tax)")}</span><b>{egp(r.totals.income)}</b></div></div>
          <div className="card scroll-x"><table><thead><tr><th>{tr("Room")}</th><th>{tr("Type")}</th><th>{tr("Guest now")}</th><th>{tr("Arrived")}</th><th>{tr("Leaves")}</th><th>{tr("Next guest")}</th><th className="n">{tr("Nights sold")}</th><th className="n">{tr("Income")}</th><th className="n">{tr("Busy")}</th></tr></thead><tbody>
            {r.rows.map((x) => <tr key={x.room}><td><b>{x.room}</b> <Pill s={x.status} /></td><td>{tr(x.type)}</td><td>{x.guest || <small>{tr("empty")}</small>}</td><td>{x.arrives}</td><td>{x.leaves}</td><td><small>{x.nextGuest}</small></td><td className="n">{x.nights}</td><td className="n">{money(x.income)}</td><td className="n">{x.occupancyPct}%</td></tr>)}</tbody></table></div></>}
      </>}
    </>
  );
}
