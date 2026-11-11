import React, { useEffect, useState } from 'react';
import { api, egp } from '../api.js';
import { Head, Pill } from '../ui.jsx';
import { tr, locale } from '../i18n.js';

export default function Dashboard({ user }) {
  const [d, setD] = useState(null);
  useEffect(() => { api('/dashboard').then(setD); }, []);
  if (!d) return <p>{tr("Loading the day…")}</p>;
  const { kpi } = d, maxRev = Math.max(...d.daily.map((x) => x.rooms + x.fnb + x.other), 1);
  const hk = d.housekeeping;
  return (
    <>
      <Head title={tr('Good day, {name}', { name: user.name.split(' ')[0] })} sub={new Date().toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} />
      <div className="grid g4">
        <div className="card kpi hero"><span>{tr("Rooms taken tonight")}</span><b>{kpi.occupancyPct}%</b><span>{tr('{a} of {b} rooms · {c} people', { a: kpi.inHouse, b: kpi.totalRooms, c: kpi.people })}</span></div>
        <div className="card kpi"><span>{tr("Income today (before tax)")}</span><b>{egp(kpi.revenueToday)}</b><span>{tr("Rooms, restaurant, rooftop and extras")}</span></div>
        <div className="card kpi"><span>{tr("Average price per room sold")}</span><b>{egp(kpi.adr)}</b><span>{tr('Per available room {amount}', { amount: egp(kpi.revpar) })}</span></div>
        <div className="card kpi"><span>{tr("Open restaurant & rooftop orders")}</span><b>{kpi.openOrders}</b><span>{tr("Waiting to be paid")}</span></div>
      </div>
      <div className="grid g2" style={{ marginTop: 16 }}>
        <div className="card"><h3>{tr("Rooms taken, last 14 days")}</h3>
          <div className="bars" style={{ marginTop: 14 }}>{d.occupancy.map((o, i) => <div key={o.date} className={i === 13 ? 't' : ''} style={{ height: `${(o.occupied / kpi.totalRooms) * 100}%` }} data-t={tr('{date} · {n} rooms', { date: o.date.slice(5), n: o.occupied })} />)}</div></div>
        <div className="card"><h3>{tr("Income by day (before tax)")}</h3>
          <div className="bars" style={{ marginTop: 14 }}>{d.daily.map((x, i) => { const t = x.rooms + x.fnb + x.other; return <div key={x.date} className={i === 13 ? 't' : ''} style={{ height: `${(t / maxRev) * 100}%` }} data-t={`${x.date.slice(5)} · ${egp(t)}`} />; })}</div>
          <div className="legend"><span>{tr("Today in gold")}</span><span>{tr('Rooms {amount}', { amount: egp(d.daily[13].rooms) })}</span><span>{tr('Food & drinks {amount}', { amount: egp(d.daily[13].fnb) })}</span></div></div>
      </div>
      <div className="grid g2" style={{ marginTop: 16 }}>
        <div className="card"><h3>{tr('Guests arriving today ({n})', { n: d.arrivals.length })}</h3>
          <table><tbody>{d.arrivals.length ? d.arrivals.map((b) => <tr key={b._id}><td>{b.guest.name}{b.guest.vip && ' ★'}</td><td>{tr('Room {n}', { n: b.room.number })}</td><td>{tr(b.room.type)}</td></tr>) : <tr><td>{tr("Nobody is waiting to arrive.")}</td></tr>}</tbody></table></div>
        <div className="card"><h3>{tr('Guests leaving today ({n})', { n: d.departures.length })}</h3>
          <table><tbody>{d.departures.length ? d.departures.map((b) => <tr key={b._id}><td>{b.guest.name}</td><td>{tr('Room {n}', { n: b.room.number })}</td><td>{tr('until {date}', { date: b.checkOut })}</td></tr>) : <tr><td>{tr("Nobody is leaving today.")}</td></tr>}</tbody></table></div>
      </div>
      <div className="grid g2" style={{ marginTop: 16 }}>
        <div className="card"><h3>{tr("Room cleaning")}</h3>
          <div className="row" style={{ marginTop: 12 }}>{['clean', 'inspected', 'dirty', 'out_of_order'].map((s) => <div key={s}><Pill s={s} /><div className="kpi"><b>{hk[s] || 0}</b></div></div>)}</div></div>
        <div className="card"><h3>{tr("Running low in stock")}</h3>
          <table><tbody>{d.lowStock.length ? d.lowStock.map((s) => <tr key={s._id}><td>{tr(s.name)}</td><td className="n">{s.qty} {tr(s.unit)}</td><td className="n"><span className="pill alert">{tr('reorder at {n}', { n: s.reorderLevel })}</span></td></tr>) : <tr><td>{tr("Stock levels are fine.")}</td></tr>}</tbody></table></div>
      </div>
    </>
  );
}
