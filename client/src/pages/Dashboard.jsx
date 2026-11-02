import React, { useEffect, useState } from 'react';
import { api, egp } from '../api.js';
import { Head, Pill } from '../ui.jsx';

export default function Dashboard({ user }) {
  const [d, setD] = useState(null);
  useEffect(() => { api('/dashboard').then(setD); }, []);
  if (!d) return <p>Loading the day…</p>;
  const { kpi } = d, maxRev = Math.max(...d.daily.map((x) => x.rooms + x.fnb + x.other), 1);
  const hk = d.housekeeping;
  return (
    <>
      <Head title={`Good day, ${user.name.split(' ')[0]}`} sub={new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} />
      <div className="grid g4">
        <div className="card kpi hero"><span>Rooms taken tonight</span><b>{kpi.occupancyPct}%</b><span>{kpi.inHouse} of {kpi.totalRooms} rooms · {kpi.people} people</span></div>
        <div className="card kpi"><span>Income today (before tax)</span><b>{egp(kpi.revenueToday)}</b><span>Rooms, restaurant, rooftop and extras</span></div>
        <div className="card kpi"><span>Average price per room sold</span><b>{egp(kpi.adr)}</b><span>Per available room {egp(kpi.revpar)}</span></div>
        <div className="card kpi"><span>Open restaurant & rooftop orders</span><b>{kpi.openOrders}</b><span>Waiting to be paid</span></div>
      </div>
      <div className="grid g2" style={{ marginTop: 16 }}>
        <div className="card"><h3>Rooms taken, last 14 days</h3>
          <div className="bars" style={{ marginTop: 14 }}>{d.occupancy.map((o, i) => <div key={o.date} className={i === 13 ? 't' : ''} style={{ height: `${(o.occupied / kpi.totalRooms) * 100}%` }} data-t={`${o.date.slice(5)} · ${o.occupied} rooms`} />)}</div></div>
        <div className="card"><h3>Income by day (before tax)</h3>
          <div className="bars" style={{ marginTop: 14 }}>{d.daily.map((x, i) => { const t = x.rooms + x.fnb + x.other; return <div key={x.date} className={i === 13 ? 't' : ''} style={{ height: `${(t / maxRev) * 100}%` }} data-t={`${x.date.slice(5)} · ${egp(t)}`} />; })}</div>
          <div className="legend"><span>Today in gold</span><span>Rooms {egp(d.daily[13].rooms)}</span><span>Food & drinks {egp(d.daily[13].fnb)}</span></div></div>
      </div>
      <div className="grid g2" style={{ marginTop: 16 }}>
        <div className="card"><h3>Guests arriving today ({d.arrivals.length})</h3>
          <table><tbody>{d.arrivals.length ? d.arrivals.map((b) => <tr key={b._id}><td>{b.guest.name}{b.guest.vip && ' ★'}</td><td>Room {b.room.number}</td><td>{b.room.type}</td></tr>) : <tr><td>Nobody is waiting to arrive.</td></tr>}</tbody></table></div>
        <div className="card"><h3>Guests leaving today ({d.departures.length})</h3>
          <table><tbody>{d.departures.length ? d.departures.map((b) => <tr key={b._id}><td>{b.guest.name}</td><td>Room {b.room.number}</td><td>until {b.checkOut}</td></tr>) : <tr><td>Nobody is leaving today.</td></tr>}</tbody></table></div>
      </div>
      <div className="grid g2" style={{ marginTop: 16 }}>
        <div className="card"><h3>Room cleaning</h3>
          <div className="row" style={{ marginTop: 12 }}>{['clean', 'inspected', 'dirty', 'out_of_order'].map((s) => <div key={s}><Pill s={s} /><div className="kpi"><b>{hk[s] || 0}</b></div></div>)}</div></div>
        <div className="card"><h3>Running low in stock</h3>
          <table><tbody>{d.lowStock.length ? d.lowStock.map((s) => <tr key={s._id}><td>{s.name}</td><td className="n">{s.qty} {s.unit}</td><td className="n"><span className="pill alert">reorder at {s.reorderLevel}</span></td></tr>) : <tr><td>Stock levels are fine.</td></tr>}</tbody></table></div>
      </div>
    </>
  );
}
