import React, { useEffect, useState } from 'react';
import { api, egp } from '../api.js';
import { Err, Head, Modal, Tabs } from '../ui.jsx';
import SalesReport from '../SalesReport.jsx';
import { tr } from '../i18n.js';

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
      <Head title={tr("Stock & sales")} sub={tr('{n} items · stock value {amount}', { n: items.length, amount: egp(value) })}><button className="btn gold" onClick={() => { setErr(''); setM({ type: 'new', form: { name: '', category: 'kitchen', unit: 'kg', qty: '', reorderLevel: '', cost: '', supplier: '' } }); }}>{tr("Add a new item")}</button></Head>
      <Tabs tab={tab} setTab={setTab} tabs={[['stock', tr("Stock in the stores")], ['sales', tr("Items sold & what is left")]]} />
      {tab === 'sales' ? <SalesReport /> : <>
        {low.length > 0 && <div className="err"><b>{tr('{n} items are running low:', { n: low.length })}</b> {low.map((i) => tr(i.name)).join(tr(', '))}</div>}
        <div className="tabs">{[['all', tr('Everything')], ['kitchen', tr('Kitchen')], ['beverage', tr('Drinks')], ['housekeeping', tr('Cleaning & rooms')]].map(([c, l]) => <button key={c} className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>{l}</button>)}</div>
        <div className="card scroll-x"><table><thead><tr><th>{tr("Item")}</th><th>{tr("Supplier")}</th><th className="n">{tr("In stock")}</th><th className="n">{tr("Reorder at")}</th><th className="n">{tr("Average cost")}</th><th className="n">{tr("Value")}</th><th /></tr></thead><tbody>
          {shown.map((i) => <tr key={i._id}><td><b>{tr(i.name)}</b></td><td>{tr(i.supplier)}</td><td className="n">{i.qty} {tr(i.unit)} {i.qty <= i.reorderLevel && <span className="pill alert">{tr("low")}</span>}</td><td className="n">{i.reorderLevel}</td><td className="n">{i.cost.toFixed(2)}</td><td className="n">{egp(i.qty * i.cost)}</td>
            <td><button className="btn sm" onClick={() => { setErr(''); setM({ type: 'purchase', item: i, qty: '', cost: i.cost, supplier: i.supplier, payment: 'credit' }); }}>{tr("Receive delivery")}</button> <button className="btn ghost sm" onClick={() => { setErr(''); setM({ type: 'issue', item: i, qty: '' }); }}>{tr("Take out")}</button></td></tr>)}</tbody></table></div></>}
      {m && <Modal title={m.type === 'purchase' ? tr('Receive delivery: {name}', { name: tr(m.item.name) }) : m.type === 'issue' ? tr('Take out: {name}', { name: tr(m.item.name) }) : tr('Add a new stock item')} onClose={() => setM(null)}>
        {m.type === 'new' ? <div className="grid g2">
          {[['name', tr('Item name')], ['unit', tr('Unit (kg, L, pcs)')], ['supplier', tr('Supplier')], ['qty', tr('In stock now')], ['reorderLevel', tr('Warn me when below')], ['cost', tr('Cost per unit (EGP)')]].map(([k, l]) => <label key={k}>{l}<input value={m.form[k]} onChange={(e) => setM({ ...m, form: { ...m.form, [k]: e.target.value } })} /></label>)}
          <label>{tr("Group")}<select value={m.form.category} onChange={(e) => setM({ ...m, form: { ...m.form, category: e.target.value } })}><option value="kitchen">{tr("Kitchen")}</option><option value="beverage">{tr("Drinks")}</option><option value="housekeeping">{tr("Cleaning & rooms")}</option></select></label></div>
        : <div className="grid g2"><label>{tr('Quantity ({unit})', { unit: tr(m.item.unit) })}<input type="number" value={m.qty} onChange={(e) => setM({ ...m, qty: e.target.value })} autoFocus /></label>
          {m.type === 'purchase' && <><label>{tr("Cost per unit (EGP)")}<input type="number" value={m.cost} onChange={(e) => setM({ ...m, cost: e.target.value })} /></label><label>{tr("Supplier")}<input value={m.supplier} onChange={(e) => setM({ ...m, supplier: e.target.value })} /></label>
            <label>{tr("How is it paid?")}<select value={m.payment} onChange={(e) => setM({ ...m, payment: e.target.value })}><option value="credit">{tr("Pay later (we owe the supplier)")}</option><option value="cash">{tr("Cash now")}</option><option value="bank">{tr("Bank now")}</option></select></label></>}</div>}
        {m.type !== 'new' && <p style={{ color: 'var(--muted)' }}>{m.type === 'purchase' ? tr('The stock goes up and the accounts are updated by themselves.') : tr('The cost is counted as {what}.', { what: tr(m.item.category === 'housekeeping' ? 'cleaning & room supplies used' : 'cost of food & drinks') })}</p>}
        <Err e={err} /><button className="btn gold" disabled={m.type === 'new' ? !m.form.name || !m.form.unit : !(m.qty > 0)} onClick={submit}>{tr("Save")}</button></Modal>}
    </>
  );
}
