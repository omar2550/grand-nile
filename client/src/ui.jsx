import React, { createContext, useState } from 'react';
import { downloadExcel } from './api.js';
import { tr, tm, lang, setLang } from './i18n.js';

export const HotelCtx = createContext({ hotel: null, hotels: [] });
export const Modal = ({ title, onClose, wide, children }) => (
  <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <div className={'modal' + (wide ? ' wide' : '')} role="dialog" aria-label={title}>
      <div className="top"><h2>{title}</h2><button className="x" onClick={onClose} aria-label={tr("Close")}>×</button></div>{children}
    </div>
  </div>
);
export const Pill = ({ s, label }) => <span className={'pill ' + s}>{tr(label || String(s).replace('_', ' '))}</span>;
export const Err = ({ e }) => (e ? <div className="err">{tm(e)}</div> : null);
export const Head = ({ title, sub, children }) => <div className="head"><div><h1>{title}</h1>{sub && <p>{sub}</p>}</div><div className="row" style={{ flex: 'none' }}>{children}</div></div>;
export const money = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const SOURCE = { folio: tr('Guest bill'), pos: tr('Restaurant / Rooftop'), purchasing: tr('Purchase'), expense: tr('Expense'), payment: tr('Payment to supplier'), trip: tr('Trip'), opening: tr('Opening balance'), manual: tr('Manual entry'), inventory: tr('Stock issued'), reversal: tr('Reversal') };

/** Green "Download Excel" button. Pass the report name and the filters it needs. */
export function ExportBtn({ kind, params, label = tr('Download Excel') }) {
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  return (<>
    <button className="btn xl" disabled={busy} onClick={async () => { setBusy(true); setErr(''); try { await downloadExcel(kind, params); } catch (e) { setErr(e.message); } setBusy(false); }}>{busy ? tr('Preparing…') : `⬇ ${label}`}</button>
    {err && <span className="pill alert">{tm(err)}</span>}
  </>);
}
export const Range = ({ from, to, setFrom, setTo }) => (<>
  <label>{tr("From")}<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
  <label>{tr("To")}<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
</>);
export const Tabs = ({ tabs, tab, setTab }) => <div className="tabs">{tabs.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>;

/** Small EN / عربي switch. Reloads the page so every screen matches the chosen language. */
export const LangSwitch = ({ className = 'langsw' }) => (
  <div className={className} role="group" aria-label={tr('Language')}>
    <button className={lang === 'en' ? 'on' : ''} onClick={() => lang !== 'en' && setLang('en')} lang="en">English</button>
    <button className={lang === 'ar' ? 'on' : ''} onClick={() => lang !== 'ar' && setLang('ar')} lang="ar">العربية</button>
  </div>
);
