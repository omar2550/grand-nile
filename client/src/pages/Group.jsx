import React, { useEffect, useState } from 'react';
import { api, egp } from '../api.js';
import { Head } from '../ui.jsx';
import { tr } from '../i18n.js';

export default function Group({ switchHotel }) {
  const [rows, setRows] = useState(null);
  useEffect(() => { api('/group/overview').then(setRows); }, []);
  if (!rows) return <p>{tr("Loading all hotels…")}</p>;
  const sum = (k) => rows.reduce((s, r) => s + r[k], 0);
  return (
    <>
      <Head title={tr("All hotels")} sub={tr("Today's numbers for every hotel in one place. Click a hotel to open it.")} />
      <div className="cardrow">
        <div className="card"><span>{tr("Guests staying now (rooms)")}</span><b>{tr('{a} of {b}', { a: sum('inHouse'), b: sum('rooms') })}</b></div>
        <div className="card"><span>{tr("Income today (before tax)")}</span><b>{egp(sum('revenueToday'))}</b></div>
        <div className="card"><span>{tr("Guests still owe us")}</span><b>{egp(sum('guestsOwe'))}</b></div>
        <div className="card"><span>{tr("Items to reorder")}</span><b>{sum('lowStock')}</b></div>
      </div>
      <div className="grid g2">{rows.map((r) => (
        <div key={r._id} className="card hotelcard" onClick={() => switchHotel(r._id)}>
          <h2>{tr(r.name)}</h2><p style={{ color: 'var(--muted)', margin: '2px 0 12px' }}>{tr(r.city)}</p>
          <div className="stack"><i style={{ width: r.occupancyPct + '%', background: 'var(--teal)' }} /></div>
          <table style={{ marginTop: 10 }}><tbody>
            <tr><td>{tr("Rooms taken")}</td><td className="n">{tr('{a} of {b}', { a: r.inHouse, b: r.rooms })} ({r.occupancyPct}%)</td></tr>
            <tr><td>{tr("Income today")}</td><td className="n">{egp(r.revenueToday)}</td></tr>
            <tr><td>{tr("Guests still owe")}</td><td className="n">{egp(r.guestsOwe)}</td></tr>
            <tr><td>{tr("Items to reorder")}</td><td className="n">{r.lowStock}</td></tr></tbody></table>
        </div>))}</div>
    </>
  );
}
