import React, { useContext, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { api } from '../api.js';
import { Head, HotelCtx } from '../ui.jsx';

function Code({ url, title, sub }) {
  const [src, setSrc] = useState('');
  useEffect(() => { QRCode.toDataURL(url, { width: 300, margin: 1 }).then(setSrc); }, [url]);
  return <div className="qrbox"><b>{title}</b>{src && <img src={src} alt={`QR code for ${title}`} />}<small>{sub}</small></div>;
}

export default function Qr() {
  const { hotel } = useContext(HotelCtx);
  const [rooms, setRooms] = useState([]); const [tables, setTables] = useState([]);
  const [base, setBase] = useState((hotel.publicUrl || window.location.origin).replace(/\/$/, ''));
  useEffect(() => { api('/rooms').then(setRooms); api('/tables').then((t) => setTables(t.filter((x) => x.outlet === 'rooftop'))); }, []);
  const roof = `${base}/m/${hotel.slug}?outlet=rooftop`;
  return (
    <>
      <Head title="QR menus" sub="Guests scan the code with their phone camera and see the menu. They can send an order from their phone."><button className="btn gold" onClick={() => window.print()}>Print this page</button></Head>
      <div className="card noprint" style={{ marginBottom: 16 }}>
        <label>Web address the guests' phones will open
          <input value={base} onChange={(e) => setBase(e.target.value.trim())} /></label>
        <p className="help" style={{ margin: '10px 0 0' }}>The QR codes only work if guests' phones can reach this address. Use your hotel's website address, or the computer's address on the hotel Wi-Fi (for example <b>http://192.168.1.20:5173</b>). Change it here and the codes update at once. Print after you set the right address.</p>
      </div>
      <h2 style={{ margin: '8px 0 12px' }}>Rooftop</h2>
      <div className="qrsheet">
        <Code url={roof} title="Rooftop menu" sub="View the menu" />
        {tables.map((t) => <Code key={t._id} url={`${roof}&table=${t.number}`} title={`Rooftop table ${t.number}`} sub="View menu & order" />)}
      </div>
      <h2 style={{ margin: '24px 0 12px' }}>Rooms ({rooms.length})</h2>
      <div className="qrsheet">{rooms.map((r) => <Code key={r._id} url={`${base}/m/${hotel.slug}?room=${r.number}`} title={`Room ${r.number}`} sub="Room-service menu" />)}</div>
    </>
  );
}
