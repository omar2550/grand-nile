import React, { useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { api, getToken } from './api.js';
import { HotelCtx, LangSwitch } from './ui.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Group from './pages/Group.jsx';
import FrontDesk from './pages/FrontDesk.jsx';
import GuestAccounts from './pages/GuestAccounts.jsx';
import Restaurant from './pages/Restaurant.jsx';
import Qr from './pages/Qr.jsx';
import Inventory from './pages/Inventory.jsx';
import Trips from './pages/Trips.jsx';
import Cash from './pages/Cash.jsx';
import Accounting from './pages/Accounting.jsx';
import Admin from './pages/Admin.jsx';
import PublicMenu from './pages/PublicMenu.jsx';
import { tr } from './i18n.js';

const NAV = [
  ['/', tr('Today'), '◐', null], ['/reception', tr('Reception'), '▦', 'pms'], ['/guests', tr('Guests & rooms accounts'), '☰', 'pms'],
  ['/restaurant', tr('Restaurant & rooftop'), '◍', 'pos'], ['/qr', tr('QR menus'), '▤', 'qr'], ['/stock', tr('Stock & sales'), '▥', 'inventory'], ['/trips', tr('Trips & airport rides'), '✈', 'trips'],
  ['/cash', tr('Cash, purchases & expenses'), '$', 'accounting'], ['/accounts', tr('Accounts & reports'), '∑', 'accounting'], ['/admin', tr('Users & settings'), '⚙', 'admin'],
];
const roleLabel = { owner: tr('Owner'), admin: tr('Hotel administrator'), manager: tr('General manager'), front_desk: tr('Reception'), cashier: tr('Restaurant cashier'), accountant: tr('Accountant'), storekeeper: tr('Storekeeper') };

function Login({ onDone }) {
  const [f, setF] = useState({ email: 'admin@grandnile.com', password: 'Admin@123' }); const [err, setErr] = useState('');
  const submit = async (e) => { e.preventDefault(); setErr(''); try { const r = await api('/auth/login', { method: 'POST', body: f }); localStorage.setItem('gn_token', r.token); onDone(await api('/auth/me')); } catch (x) { setErr(x.message); } };
  const demo = [[tr('Owner'), 'admin@grandnile.com', 'Admin@123'], [tr('Manager'), 'manager@grandnile.com', 'Manager@123'], [tr('Reception'), 'frontdesk@grandnile.com', 'Front@123'], [tr('Cashier'), 'cashier@grandnile.com', 'Cashier@123'], [tr('Accountant'), 'accountant@grandnile.com', 'Account@123'], [tr('Store'), 'store@grandnile.com', 'Store@123']];
  return (
    <div className="login">
      <LangSwitch className="langsw login-sw" />
      <div className="art"><h1>{tr("Hotel Suite")}</h1><p>{tr("One system for all your hotels: rooms, restaurant, rooftop, stock, trips and accounts. Open it from any browser.")}</p></div>
      <form onSubmit={submit}>
        <h2>{tr("Sign in")}</h2>
        <label>{tr("Email")}<input dir="ltr" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
        <label>{tr("Password")}<input dir="ltr" type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></label>
        {err && <div className="err">{err}</div>}
        <button className="btn gold">{tr("Sign in")}</button>
        <div className="demo">{tr("Demo logins (click one):")} {demo.map(([n, e, p]) => <span key={e}><code onClick={() => setF({ email: e, password: p })}>{n}</code> </span>)}</div>
      </form>
    </div>
  );
}

export default function App() {
  const loc = useLocation();
  const [user, setUser] = useState(null); const [ready, setReady] = useState(!getToken());
  useEffect(() => { if (getToken()) api('/auth/me').then(setUser).catch(() => {}).finally(() => setReady(true)); }, []);
  if (loc.pathname.startsWith('/m/')) return <Routes><Route path="/m/:slug" element={<PublicMenu />} /></Routes>;
  if (!ready) return null;
  if (!user) return <Login onDone={setUser} />;
  const hotel = user.hotels.find((h) => h._id === localStorage.getItem('gn_hotel')) || user.hotels[0];
  localStorage.setItem('gn_hotel', hotel._id); localStorage.setItem('gn_hotel_name', hotel.name);
  const can = (m) => !m || user.modules.includes(m);
  const guard = (m, el) => (can(m) ? el : <Navigate to="/" />);
  return (
    <HotelCtx.Provider value={{ hotel, hotels: user.hotels }}>
      <div className="shell">
        <nav className="side">
          <div className="brand">{tr("Henu Hotel")}<small>{tr("Cairo")}</small></div>
          {NAV.filter(([, , , m]) => can(m)).map(([to, label, icon]) => <NavLink key={to} to={to} end={to === '/'}><span>{icon}</span>{label}</NavLink>)}
          <div className="who"><b>{user.name}</b><br />{roleLabel[user.role]}<br /><LangSwitch className="langsw side-sw" /><button onClick={() => { localStorage.removeItem('gn_token'); location.assign('/'); }}>{tr("Sign out")}</button></div>
        </nav>
        <main>
          <Routes>
            <Route path="/" element={<Dashboard user={user} />} />
            <Route path="/reception" element={guard('pms', <FrontDesk user={user} />)} />
            <Route path="/guests" element={guard('pms', <GuestAccounts />)} />
            <Route path="/restaurant" element={guard('pos', <Restaurant />)} />
            <Route path="/qr" element={guard('qr', <Qr />)} />
            <Route path="/stock" element={guard('inventory', <Inventory />)} />
            <Route path="/trips" element={guard('trips', <Trips />)} />
            <Route path="/cash" element={guard('accounting', <Cash />)} />
            <Route path="/accounts" element={guard('accounting', <Accounting />)} />
            <Route path="/admin" element={guard('admin', <Admin user={user} />)} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </HotelCtx.Provider>
  );
}
