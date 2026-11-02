import React, { useEffect, useState } from 'react';
import { api, egp } from '../api.js';
import { Err, Head, Modal, Tabs } from '../ui.jsx';
import SalesReport from '../SalesReport.jsx';

export default function Inventory() {
  const [tab, setTab] = useState('stock'); const [items, setItems] = useState([]); const [cat, setCat] = useState('all'); const [m, setM] = useState(null); const [err, setErr] = useState('');
  const load = () => api('/inventory').then(setItems); useEffect(() => { load(); }, []);
  const shown = items.filter((i) => cat === 'all' || i.category === cat), low = items.filter((i) => i.qty <= i.reorderLevel);
  const value = items.reduce((s, i) => s + i.qty * i.cost, 0);
  const submit = async () => { setErr(''); try {
    if (m.type === 'purchase') await api('/inventory/purchase', { method: 'POST', body: { supplier: m.supplier, payment: m.payment, lines: [{ stock: m.item._id, qty: +m.qty, cost: +m.cost }] } });
    else if (m.type === 'issue') await api('/inventory/issue', { method: 'POST', body: { stock: m.item._id, qty: +m.qty } });
    else await api('/inventory/items', { method: 'POST', body: { ...m.form, qty: +m.form.qty || 0, reorderLevel: +m.form.reorderLevel || 0, cost: +m.form.cost || 0 } });
    setM(null); load(); } catch (e) { setErr(e.message); } };
  return (
    <>
      <Head title="Stock & sales" sub={`${items.length} items · stock value ${egp(value)}`}><button className="btn gold" onClick={() => { setErr(''); setM({ type: 'new', form: { name: '', category: 'kitchen', unit: 'kg', qty: '', reorderLevel: '', cost: '', supplier: '' } }); }}>Add a new item</button></Head>
      <Tabs tab={tab} setTab={setTab} tabs={[['stock', 'Stock in the stores'], ['sales', 'Items sold & what is left']]} />
      {tab === 'sales' ? <SalesReport /> : <>
        {low.length > 0 && <div className="err"><b>{low.length} items are running low:</b> {low.map((i) => i.name).join(', ')}</div>}
        <div className="tabs">{[['all', 'Everything'], ['kitchen', 'Kitchen'], ['beverage', 'Drinks'], ['housekeeping', 'Cleaning & rooms']].map(([c, l]) => <button key={c} className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>{l}</button>)}</div>
        <div className="card scroll-x"><table><thead><tr><th>Item</th><th>Supplier</th><th className="n">In stock</th><th className="n">Reorder at</th><th className="n">Average cost</th><th className="n">Value</th><th /></tr></thead><tbody>
          {shown.map((i) => <tr key={i._id}><td><b>{i.name}</b></td><td>{i.supplier}</td><td className="n">{i.qty} {i.unit} {i.qty <= i.reorderLevel && <span className="pill alert">low</span>}</td><td className="n">{i.reorderLevel}</td><td className="n">{i.cost.toFixed(2)}</td><td className="n">{egp(i.qty * i.cost)}</td>
            <td><button className="btn sm" onClick={() => { setErr(''); setM({ type: 'purchase', item: i, qty: '', cost: i.cost, supplier: i.supplier, payment: 'credit' }); }}>Receive delivery</button> <button className="btn ghost sm" onClick={() => { setErr(''); setM({ type: 'issue', item: i, qty: '' }); }}>Take out</button></td></tr>)}</tbody></table></div></>}
      {m && <Modal title={m.type === 'purchase' ? `Receive delivery: ${m.item.name}` : m.type === 'issue' ? `Take out: ${m.item.name}` : 'Add a new stock item'} onClose={() => setM(null)}>
        {m.type === 'new' ? <div className="grid g2">
          {[['name', 'Item name'], ['unit', 'Unit (kg, L, pcs)'], ['supplier', 'Supplier'], ['qty', 'In stock now'], ['reorderLevel', 'Warn me when below'], ['cost', 'Cost per unit (EGP)']].map(([k, l]) => <label key={k}>{l}<input value={m.form[k]} onChange={(e) => setM({ ...m, form: { ...m.form, [k]: e.target.value } })} /></label>)}
          <label>Group<select value={m.form.category} onChange={(e) => setM({ ...m, form: { ...m.form, category: e.target.value } })}><option value="kitchen">Kitchen</option><option value="beverage">Drinks</option><option value="housekeeping">Cleaning & rooms</option></select></label></div>
        : <div className="grid g2"><label>Quantity ({m.item.unit})<input type="number" value={m.qty} onChange={(e) => setM({ ...m, qty: e.target.value })} autoFocus /></label>
          {m.type === 'purchase' && <><label>Cost per unit (EGP)<input type="number" value={m.cost} onChange={(e) => setM({ ...m, cost: e.target.value })} /></label><label>Supplier<input value={m.supplier} onChange={(e) => setM({ ...m, supplier: e.target.value })} /></label>
            <label>How is it paid?<select value={m.payment} onChange={(e) => setM({ ...m, payment: e.target.value })}><option value="credit">Pay later (we owe the supplier)</option><option value="cash">Cash now</option><option value="bank">Bank now</option></select></label></>}</div>}
        {m.type !== 'new' && <p style={{ color: 'var(--muted)' }}>{m.type === 'purchase' ? 'The stock goes up and the accounts are updated by themselves.' : `The cost is counted as ${m.item.category === 'housekeeping' ? 'cleaning & room supplies used' : 'cost of food & drinks'}.`}</p>}
        <Err e={err} /><button className="btn gold" disabled={m.type === 'new' ? !m.form.name || !m.form.unit : !(m.qty > 0)} onClick={submit}>Save</button></Modal>}
    </>
  );
}
