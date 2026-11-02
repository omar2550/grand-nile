import React, { createContext, useState } from 'react';
import { downloadExcel } from './api.js';

export const HotelCtx = createContext({ hotel: null, hotels: [] });
export const Modal = ({ title, onClose, wide, children }) => (
  <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <div className={'modal' + (wide ? ' wide' : '')} role="dialog" aria-label={title}>
      <div className="top"><h2>{title}</h2><button className="x" onClick={onClose} aria-label="Close">×</button></div>{children}
    </div>
  </div>
);
export const Pill = ({ s, label }) => <span className={'pill ' + s}>{label || String(s).replace('_', ' ')}</span>;
export const Err = ({ e }) => (e ? <div className="err">{e}</div> : null);
export const Head = ({ title, sub, children }) => <div className="head"><div><h1>{title}</h1>{sub && <p>{sub}</p>}</div><div className="row" style={{ flex: 'none' }}>{children}</div></div>;
export const money = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const SOURCE = { folio: 'Guest bill', pos: 'Restaurant / Rooftop', purchasing: 'Purchase', expense: 'Expense', payment: 'Payment to supplier', trip: 'Trip', opening: 'Opening balance', manual: 'Manual entry', inventory: 'Stock issued', reversal: 'Reversal' };

/** Green "Download Excel" button. Pass the report name and the filters it needs. */
export function ExportBtn({ kind, params, label = 'Download Excel' }) {
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  return (<>
    <button className="btn xl" disabled={busy} onClick={async () => { setBusy(true); setErr(''); try { await downloadExcel(kind, params); } catch (e) { setErr(e.message); } setBusy(false); }}>{busy ? 'Preparing…' : `⬇ ${label}`}</button>
    {err && <span className="pill alert">{err}</span>}
  </>);
}
export const Range = ({ from, to, setFrom, setTo }) => (<>
  <label>From<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
  <label>To<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
</>);
export const Tabs = ({ tabs, tab, setTab }) => <div className="tabs">{tabs.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>;
