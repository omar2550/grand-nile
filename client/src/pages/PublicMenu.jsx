import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { tr, tm, rich, isAr } from '../i18n.js';
import { LangSwitch } from '../ui.jsx';

const fmt = (n) => Number(n).toLocaleString('en-EG', { maximumFractionDigits: 0 });
const cur = (n) => (isAr ? `${fmt(n)} ج.م` : `EGP ${fmt(n)}`);

/** Page guests see after scanning a QR code. No sign-in. */
export default function PublicMenu() {
  const { slug } = useParams(); const [sp] = useSearchParams();
  const room = sp.get('room'), table = sp.get('table'), outlet = sp.get('outlet') === 'rooftop' ? 'rooftop' : 'room';
  const [d, setD] = useState(null); const [err, setErr] = useState(''); const [cat, setCat] = useState('All'); const [cart, setCart] = useState({});
  const [name, setName] = useState(''); const [note, setNote] = useState(''); const [sent, setSent] = useState(null); const [busy, setBusy] = useState(false);
  useEffect(() => { fetch(`${import.meta.env.VITE_BACKEND_URL}/api/public/${slug}/menu?outlet=${outlet}`).then((r) => r.json()).then((x) => (x.error ? setErr(tm(x.error)) : setD(x))).catch(() => setErr(tr('Could not load the menu'))); }, [slug, outlet]);
  const cats = useMemo(() => ['All', ...new Set((d?.items || []).map((i) => i.category))], [d]);
  const canOrder = !!(room || table);
  const lines = (d?.items || []).filter((i) => cart[i._id]); const total = lines.reduce((s, i) => s + i.price * cart[i._id], 0);
  const change = (id, n) => setCart((c) => { const q = Math.max(0, (c[id] || 0) + n); const x = { ...c }; if (q) x[id] = q; else delete x[id]; return x; });
  const send = async () => {
    setBusy(true); setErr('');
    try {
      const r = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/public/${slug}/order`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ room, table, guestName: name, note, items: lines.map((i) => ({ menuId: i._id, qty: cart[i._id] })) }) });
      const x = await r.json(); if (!r.ok) throw new Error(tm(x.error)); setSent(x.orderNo); setCart({});
    } catch (e) { setErr(e.message); } setBusy(false);
  };
  if (err && !d) return <div className="pm"><div className="note">{err}</div></div>;
  if (!d) return <div className="pm"><div className="note">{tr("Loading the menu…")}</div></div>;
  return (
    <div className="pm">
      <header><LangSwitch className="langsw pm-sw" /><h1>{tr(d.hotel.name)}</h1><p>{tr(outlet === 'rooftop' ? 'Rooftop menu' : 'Room-service menu')}{room ? ` · ${tr('Room {n}', { n: room })}` : ''}{table ? ` · ${tr('Table {n}', { n: table })}` : ''}</p></header>
      {sent ? <div className="note" style={{ color: 'var(--ink)', fontSize: 16 }}><h2>{tr("Thank you!")}</h2><p>{rich('Your order <b>#{no}</b> was sent.', { no: sent })} {tr(room ? 'Reception will confirm it and it will be added to your room bill.' : 'A waiter will bring it to your table.')}</p><button className="btn" onClick={() => setSent(null)}>{tr("Order something else")}</button></div> : <>
        <div className="chips">{cats.map((c) => <button key={c} className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>{tr(c)}</button>)}</div>
        {d.items.filter((i) => cat === 'All' || i.category === cat).map((i) => (
          <div className="item" key={i._id}><div className="e">{i.emoji}</div><div className="t"><b>{tr(i.name)}</b>{i.desc && <small>{tr(i.desc)}</small>}<small>{cur(i.price)}</small></div>
            {canOrder && <div className="qty">{cart[i._id] ? <><button onClick={() => change(i._id, -1)} aria-label={tr("Less")}>−</button><b>{cart[i._id]}</b></> : null}<button onClick={() => change(i._id, 1)} aria-label={tr("Add")}>+</button></div>}</div>))}
        <div className="note">{tr('Prices are before 12% service and 14% VAT.')}{!canOrder && ' ' + tr('To order, please ask your waiter or call reception.')}</div>
        {canOrder && lines.length > 0 && <div className="bar">
          <div className="row" style={{ marginBottom: 8 }}>{room && <label>{tr("Your name (optional)")}<input value={name} onChange={(e) => setName(e.target.value)} /></label>}<label>{tr("Note (optional)")}<input value={note} onChange={(e) => setNote(e.target.value)} placeholder={tr("No onions, extra ice…")} /></label></div>
          {err && <div className="err">{err}</div>}
          <button className="btn gold" style={{ width: '100%', padding: 14 }} disabled={busy} onClick={send}>{tr('Send order · {amount} + tax', { amount: cur(total) })}</button></div>}
      </>}
    </div>
  );
}
