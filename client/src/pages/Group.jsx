import React, { useEffect, useState } from 'react';
import { api, egp } from '../api.js';
import { Head } from '../ui.jsx';

export default function Group({ switchHotel }) {
  const [rows, setRows] = useState(null);
  useEffect(() => { api('/group/overview').then(setRows); }, []);
  if (!rows) return <p>Loading all hotels…</p>;
  const sum = (k) => rows.reduce((s, r) => s + r[k], 0);
  return (
    <>
      <Head title="All hotels" sub="Today's numbers for every hotel in one place. Click a hotel to open it." />
      <div className="cardrow">
        <div className="card"><span>Guests staying now (rooms)</span><b>{sum('inHouse')} of {sum('rooms')}</b></div>
        <div className="card"><span>Income today (before tax)</span><b>{egp(sum('revenueToday'))}</b></div>
        <div className="card"><span>Guests still owe us</span><b>{egp(sum('guestsOwe'))}</b></div>
        <div className="card"><span>Items to reorder</span><b>{sum('lowStock')}</b></div>
      </div>
      <div className="grid g2">{rows.map((r) => (
        <div key={r._id} className="card hotelcard" onClick={() => switchHotel(r._id)}>
          <h2>{r.name}</h2><p style={{ color: 'var(--muted)', margin: '2px 0 12px' }}>{r.city}</p>
          <div className="stack"><i style={{ width: r.occupancyPct + '%', background: 'var(--teal)' }} /></div>
          <table style={{ marginTop: 10 }}><tbody>
            <tr><td>Rooms taken</td><td className="n">{r.inHouse} of {r.rooms} ({r.occupancyPct}%)</td></tr>
            <tr><td>Income today</td><td className="n">{egp(r.revenueToday)}</td></tr>
            <tr><td>Guests still owe</td><td className="n">{egp(r.guestsOwe)}</td></tr>
            <tr><td>Items to reorder</td><td className="n">{r.lowStock}</td></tr></tbody></table>
        </div>))}</div>
    </>
  );
}
