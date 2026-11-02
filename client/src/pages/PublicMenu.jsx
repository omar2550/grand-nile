import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

const fmt = (n) => Number(n).toLocaleString('en-EG', { maximumFractionDigits: 0 });

/** Page guests see after scanning a QR code. No sign-in. */
export default function PublicMenu() {
  const { slug } = useParams(); const [sp] = useSearchParams();
  const room = sp.get('room'), table = sp.get('table'), outlet = sp.get('outlet') === 'rooftop' ? 'rooftop' : 'room';
  const [d, setD] = useState(null); const [err, setErr] = useState(''); const [cat, setCat] = useState('All'); const [cart, setCart] = useState({});
  const [name, setName] = useState(''); const [note, setNote] = useState(''); const [sent, setSent] = useState(null); const [busy, setBusy] = useState(false);
  useEffect(() => { fetch(`${import.meta.env.VITE_BACKEND_URL}/api/public/${slug}/menu?outlet=${outlet}`).then((r) => r.json()).then((x) => (x.error ? setErr(x.error) : setD(x))).catch(() => setErr('Could not load the menu')); }, [slug, outlet]);
  const cats = useMemo(() => ['All', ...new Set((d?.items || []).map((i) => i.category))], [d]);
  const canOrder = !!(room || table);
  const lines = (d?.items || []).filter((i) => cart[i._id]); const total = lines.reduce((s, i) => s + i.price * cart[i._id], 0);
  const change = (id, n) => setCart((c) => { const q = Math.max(0, (c[id] || 0) + n); const x = { ...c }; if (q) x[id] = q; else delete x[id]; return x; });
  const send = async () => {
    setBusy(true); setErr('');
    try {
      const r = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/public/${slug}/order`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ room, table, guestName: name, note, items: lines.map((i) => ({ menuId: i._id, qty: cart[i._id] })) }) });
      const x = await r.json(); if (!r.ok) throw new Error(x.error); setSent(x.orderNo); setCart({});
    } catch (e) { setErr(e.message); } setBusy(false);
  };
  if (err && !d) return <div className="pm"><div className="note">{err}</div></div>;
  if (!d) return <div className="pm"><div className="note">Loading the menu…</div></div>;
  return (
    <div className="pm">
      <header><h1>{d.hotel.name}</h1><p>{outlet === 'rooftop' ? 'Rooftop menu' : 'Room-service menu'}{room ? ` · Room ${room}` : ''}{table ? ` · Table ${table}` : ''}</p></header>
      {sent ? <div className="note" style={{ color: 'var(--ink)', fontSize: 16 }}><h2>Thank you!</h2><p>Your order <b>#{sent}</b> was sent. {room ? 'Reception will confirm it and it will be added to your room bill.' : 'A waiter will bring it to your table.'}</p><button className="btn" onClick={() => setSent(null)}>Order something else</button></div> : <>
        <div className="chips">{cats.map((c) => <button key={c} className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>{c}</button>)}</div>
        {d.items.filter((i) => cat === 'All' || i.category === cat).map((i) => (
          <div className="item" key={i._id}><div className="e">{i.emoji}</div><div className="t"><b>{i.name}</b>{i.desc && <small>{i.desc}</small>}<small>EGP {fmt(i.price)}</small></div>
            {canOrder && <div className="qty">{cart[i._id] ? <><button onClick={() => change(i._id, -1)} aria-label="Less">−</button><b>{cart[i._id]}</b></> : null}<button onClick={() => change(i._id, 1)} aria-label="Add">+</button></div>}</div>))}
        <div className="note">Prices are before 12% service and 14% VAT.{!canOrder && ' To order, please ask your waiter or call reception.'}</div>
        {canOrder && lines.length > 0 && <div className="bar">
          <div className="row" style={{ marginBottom: 8 }}>{room && <label>Your name (optional)<input value={name} onChange={(e) => setName(e.target.value)} /></label>}<label>Note (optional)<input value={note} onChange={(e) => setNote(e.target.value)} placeholder="No onions, extra ice…" /></label></div>
          {err && <div className="err">{err}</div>}
          <button className="btn gold" style={{ width: '100%', padding: 14 }} disabled={busy} onClick={send}>Send order · EGP {fmt(total)} + tax</button></div>}
      </>}
    </div>
  );
}
