import React, { useEffect, useState } from 'react';
import { api, addDays, today, egp } from '../api.js';
import { ExportBtn, Range, Err, Head, Tabs, money, SOURCE } from '../ui.jsx';

export default function Cash() {
  const [tab, setTab] = useState('cash'); const [from, setFrom] = useState(addDays(today(), -6)); const [to, setTo] = useState(today());
  const [d, setD] = useState(null); const [err, setErr] = useState(''); const [ok, setOk] = useState(''); const [accts, setAccts] = useState([]); const [showMoves, setShowMoves] = useState(false);
  const [ex, setEx] = useState({ code: '6300', amount: '', memo: '', paidFrom: '1110', date: today() }); const [pay, setPay] = useState({ amount: '', memo: '', method: 'cash', date: today() });
  useEffect(() => { setErr(''); api(`/reports/money?from=${from}&to=${to}`).then(setD).catch((e) => setErr(e.message)); }, [from, to, ok]);
  useEffect(() => { api('/accounts').then(setAccts); }, []);
  const send = async (path, body, msg) => { setErr(''); setOk(''); try { await api(path, { method: 'POST', body }); setOk(msg); } catch (e) { setErr(e.message); } };
  return (
    <>
      <Head title="Cash, purchases & expenses" sub="Every day: what came into the cash drawers, what went out, what was bought and what was spent">
        <Range from={from} to={to} setFrom={setFrom} setTo={setTo} /><ExportBtn kind="money" params={{ from, to }} label="Download Excel (all 3 reports)" />
      </Head>
      <Tabs tab={tab} setTab={setTab} tabs={[['cash', 'Daily cashbox'], ['buy', 'Purchases'], ['exp', 'Expenses']]} />
      <Err e={err} />{ok && <div className="ok">{ok}</div>}
      {d && tab === 'cash' && <>
        <div className="cardrow">{d.drawers.map((x) => <div className="card" key={x.code}><span>{x.name}</span><b>{egp(x.closing)}</b><span>in {money(x.cashIn)} · out {money(x.cashOut)}</span></div>)}</div>
        <div className="card scroll-x"><table><thead><tr><th>Day</th><th className="n">Cash at start</th><th className="n">Money in</th><th className="n">Money out</th><th className="n">Cash at end</th></tr></thead><tbody>
          {d.days.map((x) => <tr key={x.date}><td>{x.date}</td><td className="n">{money(x.opening)}</td><td className="n pos-c">{money(x.cashIn)}</td><td className="n neg">{money(x.cashOut)}</td><td className="n"><b>{money(x.closing)}</b></td></tr>)}
          <tr className="total"><td>Total</td><td /><td className="n">{money(d.totals.cashIn)}</td><td className="n">{money(d.totals.cashOut)}</td><td /></tr></tbody></table></div>
        <p><button className="btn ghost" onClick={() => setShowMoves(!showMoves)}>{showMoves ? 'Hide' : 'Show'} every cash movement ({d.moves.length})</button></p>
        {showMoves && <div className="card scroll-x"><table><thead><tr><th>Day</th><th>What happened</th><th>From</th><th>Cash drawer</th><th className="n">In</th><th className="n">Out</th></tr></thead><tbody>
          {d.moves.map((m, i) => <tr key={i}><td>{m.date}</td><td>{m.memo}</td><td>{SOURCE[m.source] || m.source}</td><td>{m.drawer}</td><td className="n">{m.cashIn ? money(m.cashIn) : ''}</td><td className="n">{m.cashOut ? money(m.cashOut) : ''}</td></tr>)}</tbody></table></div>}
      </>}
      {d && tab === 'buy' && <div className="grid g2">
        <div className="card scroll-x"><h3>Purchases and supplier payments · {egp(d.totals.purchases)}</h3><table><thead><tr><th>Day</th><th>What</th><th className="n">Amount</th><th>How paid</th></tr></thead><tbody>
          {d.purchases.map((p) => <tr key={p.no}><td>{p.date}</td><td>{p.memo}<br /><small>{p.type}</small></td><td className="n">{money(p.amount)}</td><td><small>{p.paidBy}</small></td></tr>)}{!d.purchases.length && <tr><td colSpan="4">Nothing in this period.</td></tr>}</tbody></table>
          <p className="help" style={{ marginTop: 12 }}>To record a new delivery, open <b>Stock & sales</b> and press "Receive delivery".</p></div>
        <div className="card"><h3>Pay a supplier or company</h3><div className="grid" style={{ marginTop: 10 }}>
          <label>Who / what for<input value={pay.memo} onChange={(e) => setPay({ ...pay, memo: e.target.value })} placeholder="Delta Grocers – October invoice" /></label>
          <label>Amount (EGP)<input type="number" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} /></label>
          <label>Paid from<select value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}><option value="cash">Cash – Reception</option><option value="bank">Bank</option></select></label>
          <label>Date<input type="date" value={pay.date} onChange={(e) => setPay({ ...pay, date: e.target.value })} /></label>
          <button className="btn gold" disabled={!(pay.amount > 0) || !pay.memo} onClick={() => send('/payments/company', pay, 'Payment saved.')}>Save payment</button></div></div></div>}
      {d && tab === 'exp' && <div className="grid g2">
        <div className="card scroll-x"><h3>Expenses · {egp(d.totals.expenses)}</h3><table><thead><tr><th>Day</th><th>What for</th><th className="n">Amount</th><th>Paid from</th></tr></thead><tbody>
          {d.expenses.map((p) => <tr key={p.no}><td>{p.date}</td><td>{p.memo}<br /><small>{p.account}</small></td><td className="n">{money(p.amount)}</td><td><small>{p.paidFrom}</small></td></tr>)}{!d.expenses.length && <tr><td colSpan="4">Nothing in this period.</td></tr>}</tbody></table></div>
        <div className="card"><h3>Add an expense</h3><div className="grid" style={{ marginTop: 10 }}>
          <label>Type<select value={ex.code} onChange={(e) => setEx({ ...ex, code: e.target.value })}>{accts.filter((a) => !a.isGroup && a.type === 'expense' && a.code.startsWith('6')).map((a) => <option key={a.code} value={a.code}>{a.name}</option>)}</select></label>
          <label>What for<input value={ex.memo} onChange={(e) => setEx({ ...ex, memo: e.target.value })} /></label>
          <label>Amount (EGP)<input type="number" value={ex.amount} onChange={(e) => setEx({ ...ex, amount: e.target.value })} /></label>
          <label>Paid from<select value={ex.paidFrom} onChange={(e) => setEx({ ...ex, paidFrom: e.target.value })}><option value="1110">Cash – Reception</option><option value="1115">Cash – Restaurant</option><option value="1116">Cash – Rooftop</option><option value="1120">Bank</option></select></label>
          <label>Date<input type="date" value={ex.date} onChange={(e) => setEx({ ...ex, date: e.target.value })} /></label>
          <button className="btn gold" disabled={!(ex.amount > 0) || !ex.memo} onClick={() => send('/expenses', ex, 'Expense saved.')}>Save expense</button></div></div></div>}
    </>
  );
}
