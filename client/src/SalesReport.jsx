import React, { useEffect, useState } from 'react';
import { api, addDays, today, egp } from './api.js';
import { ExportBtn, Range, Err, money } from './ui.jsx';
import { tr } from './i18n.js';

/** Items sold (how many, how much money) and what is still left in stock. Used on the Restaurant and Stock pages. */
export default function SalesReport() {
  const [from, setFrom] = useState(addDays(today(), -6)); const [to, setTo] = useState(today()); const [d, setD] = useState(null); const [err, setErr] = useState('');
  useEffect(() => { setErr(''); api(`/reports/sales?from=${from}&to=${to}`).then(setD).catch((e) => setErr(e.message)); }, [from, to]);
  return (
    <>
      <div className="row" style={{ marginBottom: 14 }}><Range from={from} to={to} setFrom={setFrom} setTo={setTo} /><ExportBtn kind="sales" params={{ from, to }} /></div>
      <Err e={err} />
      {d && <>
        <div className="cardrow">
          <div className="card"><span>{tr("Sales (before tax)")}</span><b>{egp(d.totals.revenue)}</b></div>
          <div className="card"><span>{tr("Restaurant")}</span><b>{egp(d.byOutlet.restaurant)}</b></div>
          <div className="card"><span>{tr("Rooftop")}</span><b>{egp(d.byOutlet.rooftop)}</b></div>
          <div className="card"><span>{tr("Room service")}</span><b>{egp(d.byOutlet.room)}</b></div>
          <div className="card"><span>{tr("Stock value now")}</span><b>{egp(d.totals.stockValue)}</b></div>
        </div>
        <div className="grid g2">
          <div className="card scroll-x"><h3>{tr("Items sold")}</h3><table><thead><tr><th>{tr("Item")}</th><th className="n">{tr("Sold")}</th><th className="n">{tr("Sales")}</th><th className="n">{tr("Portions left")}</th></tr></thead><tbody>
            {d.rows.map((r) => <tr key={r.name}><td>{tr(r.name)}<br /><small>{tr(r.category)}</small></td><td className="n">{r.qty}</td><td className="n">{money(r.revenue)}</td><td className="n">{r.portionsLeft === null ? '–' : r.portionsLeft <= 10 ? <span className="pill alert">{r.portionsLeft}</span> : r.portionsLeft}</td></tr>)}</tbody></table></div>
          <div className="card scroll-x"><h3>{tr("What is left in stock")}</h3><table><thead><tr><th>{tr("Item")}</th><th className="n">{tr("In stock")}</th><th className="n">{tr("Reorder at")}</th></tr></thead><tbody>
            {d.stock.map((s) => <tr key={s.name}><td>{tr(s.name)}<br /><small>{tr(s.category)}</small></td><td className="n">{s.qty} {tr(s.unit)}</td><td className="n">{s.low ? <span className="pill alert">{tr('low · {n}', { n: s.reorderLevel })}</span> : s.reorderLevel}</td></tr>)}</tbody></table></div>
        </div></>}
    </>
  );
}
