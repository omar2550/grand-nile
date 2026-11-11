import React, { useCallback, useEffect, useState } from 'react';
import { api, egp } from '../api.js';
import { Err, Head, Tabs } from '../ui.jsx';
import SalesReport from '../SalesReport.jsx';
import { tr, tm, locale } from '../i18n.js';

export default function Restaurant() {
  const [outlet, setOutlet] = useState('restaurant'); const [d, setD] = useState(null); const [sel, setSel] = useState(null); const [cat, setCat] = useState('All');
  const [inhouse, setInhouse] = useState([]); const [room, setRoom] = useState(''); const [err, setErr] = useState(''); const [done, setDone] = useState('');
  const sales = outlet === 'sales', real = outlet === 'rooftop' ? 'rooftop' : 'restaurant';
  const load = useCallback(() => api(`/pos/floor?outlet=${real}`).then(setD).catch((e) => setErr(e.message)), [real]);
  useEffect(() => { setSel(null); setCat('All'); load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]); // refresh so guest QR orders appear
  useEffect(() => { api('/inhouse').then(setInhouse).catch(() => {}); }, []);
  if (!d) return <p>{tr("Loading…")}</p>;
  const tab = outlet;
  const order = d.orders.find((o) => String(o.table) === sel);
  const live = (order?.items || []).filter((i) => !i.voided);
  const net = live.reduce((s, i) => s + i.price * i.qty, 0), svc = net * 0.12, vat = (net + svc) * 0.14;
  const cats = ['All', ...new Set(d.menu.map((m) => m.category))];
  const act = async (fn) => { setErr(''); setDone(''); try { await fn(); await load(); } catch (e) { setErr(e.message); } };
  const add = (m) => act(() => api('/pos/orders', { method: 'POST', body: { tableId: sel, items: [{ menuId: m._id, qty: 1 }] } }));
  const settle = (id, method, bookingId, msg) => act(async () => { await api(`/pos/orders/${id}/settle`, { method: 'POST', body: { method, bookingId } }); setDone(msg); setSel(null); setRoom(''); });
  const zones = [...new Set(d.tables.map((t) => t.zone))].map((z) => ({ z, y: Math.min(...d.tables.filter((t) => t.zone === z).map((t) => t.y)) }));
  const tableNo = d.tables.find((t) => t._id === sel)?.number;
  return (
    <>
      <Head title={tr("Restaurant & rooftop")} sub={tr("Take orders, charge the guest's room or take payment, and see what has been sold")} />
      <Tabs tab={tab} setTab={setOutlet} tabs={[['restaurant', tr("Restaurant")], ['rooftop', tr("Rooftop")], ['rooms', tr('Room-service orders') + (d.roomOrders.length ? ` (${d.roomOrders.length})` : '')], ['sales', tr("Items sold & stock left")]]} />
      {done && <div className="ok">{done}</div>}<Err e={err} />
      {sales && <SalesReport />}
      {outlet === 'rooms' && <div className="card">
        <p className="help">{tr("Orders sent by guests from the QR code in their room appear here. Check the room number, then confirm to add it to the guest's bill.")}</p>
        {!d.roomOrders.length && <p>{tr("No room-service orders waiting.")}</p>}
        {d.roomOrders.map((o) => <div key={o._id} className="card" style={{ marginBottom: 10 }}>
          <div className="row"><div><b>{tr('Order #{no} · Room {room}', { no: o.no, room: o.roomNo })}</b><br /><small>{o.booking?.guest?.name || o.guestName} · {new Date(o.createdAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false })}</small>{o.note && <><br /><small>{tr('Note: {note}', { note: o.note })}</small></>}</div>
            <div style={{ flex: 2 }}>{o.items.filter((i) => !i.voided).map((i) => <div key={i._id}>{i.qty}× {tr(i.name)}</div>)}</div>
            <div style={{ flex: 'none', textAlign: 'end' }}><b>{egp(o.items.filter((i) => !i.voided).reduce((s, i) => s + i.price * i.qty, 0) * 1.12 * 1.14)}</b><br /><small>{tr("with service & VAT")}</small></div></div>
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
            <button className="btn ghost" onClick={() => act(() => api(`/pos/orders/${o._id}/reject`, { method: 'POST' }))}>{tr("Reject")}</button>
            <button className="btn gold" onClick={() => settle(o._id, 'room', o.booking?._id, tr("Order #{no} was added to the guest's bill for room {room}.", { no: o.no, room: o.roomNo }))}>{tr("Confirm & charge to room")}</button></div></div>)}
      </div>}
      {(outlet === 'restaurant' || outlet === 'rooftop') && <div className="pos">
        <div>
          <div className={'floor ' + (real === 'rooftop' ? 'night' : 'day')}>
            {zones.map((z) => <span key={z.z} className="zone" style={{ top: `${Math.max(1, z.y - 14)}%` }}>{tr(z.z)}</span>)}
            {d.tables.map((t) => { const o = d.orders.find((x) => String(x.table) === t._id); const tot = o ? o.items.filter((i) => !i.voided).reduce((s, i) => s + i.price * i.qty, 0) : 0;
              return <button key={t._id} className={'tbl' + (o ? ' busy' : '') + (sel === t._id ? ' sel' : '')} style={{ left: t.x + '%', top: t.y + '%' }} onClick={() => setSel(t._id)} aria-label={tr('Table {n}', { n: t.number })}><span><b>{t.number}</b><br />{o ? egp(tot) : tr('{n} seats', { n: t.seats })}{o?.qr && <small className="qr">{tr("guest order")}</small>}</span></button>; })}
          </div>
          {sel && <><div className="tabs" style={{ marginTop: 14 }}>{cats.map((c) => <button key={c} className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>{tr(c)}</button>)}</div>
            <div className="menu">{d.menu.filter((m) => cat === 'All' || m.category === cat).map((m) => <button key={m._id} onClick={() => add(m)}><span>{m.emoji}</span>{tr(m.name)}<br /><small>{egp(m.price)}</small></button>)}</div></>}
        </div>
        <div className="card" style={{ alignSelf: 'start' }}>
          {!sel ? <p>{tr("Tap a table on the plan to start or continue an order.")}</p> : <>
            <h2>{tr(real === 'rooftop' ? 'Rooftop table {n}' : 'Table {n}', { n: tableNo })}{order && ` · ${tr('Order #{no}', { no: order.no })}`}</h2>
            {order?.note && <p className="help">{tr('Guest note: {note}', { note: order.note })}</p>}
            <table><tbody>{live.map((i) => <tr key={i._id}><td>{i.qty}× {tr(i.name)}{i.fromQr && <span className="pill warn" style={{ marginLeft: 6 }}>{tr("guest")}</span>}</td><td className="n">{(i.qty * i.price).toFixed(0)}</td><td><button className="btn ghost sm" onClick={() => confirm(tr('Remove {name} from this order? This is saved in the activity log.', { name: tr(i.name) })) && act(() => api(`/pos/orders/${order._id}/void/${i._id}`, { method: 'POST' }))}>{tr("Remove")}</button></td></tr>)}</tbody></table>
            {!live.length && <p>{tr("Tap dishes to add them.")}</p>}
            {live.length > 0 && <>
              <table style={{ marginTop: 8 }}><tbody><tr><td>{tr("Items")}</td><td className="n">{net.toFixed(2)}</td></tr><tr><td>{tr("Service 12%")}</td><td className="n">{svc.toFixed(2)}</td></tr><tr><td>{tr("VAT 14%")}</td><td className="n">{vat.toFixed(2)}</td></tr><tr className="total"><td>{tr("Total to pay")}</td><td className="n">{(net + svc + vat).toFixed(2)}</td></tr></tbody></table>
              <div className="row" style={{ marginTop: 12 }}><button className="btn" onClick={() => settle(order._id, 'cash', null, tr('Paid in cash. The sale is recorded in the accounts.'))}>{tr("Paid cash")}</button><button className="btn" onClick={() => settle(order._id, 'card', null, tr('Paid by card. The sale is recorded in the accounts.'))}>{tr("Paid by card")}</button></div>
              <label style={{ marginTop: 12 }}>{tr("Or charge to a guest's room")}<select value={room} onChange={(e) => setRoom(e.target.value)}><option value="">{tr("Choose a guest staying now…")}</option>{inhouse.map((b) => <option key={b._id} value={b._id}>{tr('Room {n}', { n: b.room.number })} · {b.guest.name}</option>)}</select></label>
              <button className="btn gold" style={{ marginTop: 8, width: '100%' }} disabled={!room} onClick={() => settle(order._id, 'room', room, tr('Added to the guest bill.'))}>{tr("Charge to room")}</button></>}
          </>}
        </div>
      </div>}
    </>
  );
}
