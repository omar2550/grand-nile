import React, { useContext, useEffect, useState } from "react";
import { api, getToken } from "../api.js";
import { Err, Head, HotelCtx, Pill, Tabs, money } from "../ui.jsx";
import { tr, tm, rich, locale } from '../i18n.js';

const ROLES = [
  ["owner", tr("Owner (all hotels)")],
  ["admin", tr("Hotel administrator")],
  ["manager", tr("General manager")],
  ["front_desk", tr("Reception")],
  ["cashier", tr("Restaurant cashier")],
  ["accountant", tr("Accountant")],
  ["storekeeper", tr("Storekeeper")],
];

export default function Admin({ user }) {
  const { hotels } = useContext(HotelCtx);
  const owner = user.role === "owner";
  const [tab, setTab] = useState("users");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [users, setUsers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [menu, setMenu] = useState([]);
  const [hl, setHl] = useState([]);
  const [audit, setAudit] = useState([]);
  const [backups, setBackups] = useState([]);
  const [nu, setNu] = useState({
    name: "",
    email: "",
    role: "front_desk",
    password: "",
    hotels: [],
  });
  const [nr, setNr] = useState({ number: "", type: "Standard", rate: "" });
  const [nm, setNm] = useState({
    name: "",
    category: "",
    price: "",
    emoji: "🍽️",
    outlets: ["restaurant"],
  });
  const [nh, setNh] = useState({ name: "", code: "", city: "", publicUrl: "" });
  const load = () => {
    api("/admin/users").then(setUsers);
    api("/rooms").then(setRooms);
    api("/menu").then(setMenu);
    api("/admin/audit").then(setAudit);
    api("/admin/backups").then(setBackups);
    if (owner) api("/admin/hotels").then(setHl);
  };
  useEffect(load, []);
  const run = async (fn, msg) => {
    setErr("");
    setOk("");
    try {
      await fn();
      if (msg) setOk(msg);
      load();
    } catch (e) {
      setErr(e.message);
    }
  };
  const download = async (name) => {
    const r = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/admin/backups/` + name, {
      headers: { Authorization: "Bearer " + getToken() },
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(await r.blob());
    a.download = name;
    a.click();
  };
  const toggle = (arr, v) =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
  const tabs = [
    ["users", tr("Users & job roles")],
    ["rooms", tr("Rooms & prices")],
    ["menu", tr("Menu & prices")],
    ["audit", tr("Activity log")],
    ["backup", tr("Backups")],
  ];
  return (
    <>
      <Head
        title={tr("Users & settings")}
        sub={tr("Who can do what, your prices, and your safety copies")}
      />
      <Tabs
        tab={tab}
        setTab={(t) => {
          setTab(t);
          setErr("");
          setOk("");
        }}
        tabs={tabs}
      />
      <Err e={err} />
      {ok && <div className="ok">{ok}</div>}
      {tab === "users" && (
        <div className="grid g2">
          <div className="card scroll-x">
            <table>
              <thead>
                <tr>
                  <th>{tr("Name")}</th>
                  <th>{tr("Job role")}</th>
                  <th>{tr("Can sign in")}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u._id}>
                    <td>
                      <b>{u.name}</b>
                      <br />
                      <small>{u.email}</small>
                    </td>
                    <td>
                      <select
                        value={u.role}
                        onChange={(e) =>
                          run(() =>
                            api("/admin/users/" + u._id, {
                              method: "PATCH",
                              body: { role: e.target.value },
                            }),
                          )
                        }
                      >
                        {ROLES.filter(([r]) => owner || r !== "owner").map(
                          ([r, l]) => (
                            <option key={r} value={r}>
                              {l}
                            </option>
                          ),
                        )}
                      </select>
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        style={{ width: "auto" }}
                        checked={u.active}
                        onChange={(e) =>
                          run(() =>
                            api("/admin/users/" + u._id, {
                              method: "PATCH",
                              body: { active: e.target.checked },
                            }),
                          )
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card">
            <h3>{tr("Add a user")}</h3>
            <p className="help" style={{ marginTop: 8 }}>
              {[
                ["Reception", "bookings & guest bills"],
                ["Cashier", "restaurant & rooftop"],
                ["Accountant", "accounts, cash, stock"],
                ["Storekeeper", "stock only"],
                ["Manager", "everything except settings"],
                ["Administrator", "everything for their hotel."],
              ].map(([role, what]) => (
                <React.Fragment key={role}>
                  <b>{tr(role)}</b>: {tr(what)} <br />
                </React.Fragment>
              ))}
              <i>{tr("There is no limit on the number of users.")}</i>
            </p>
            <div className="grid">
              <label>
                {tr("Name")}
                <input
                  value={nu.name}
                  onChange={(e) => setNu({ ...nu, name: e.target.value })}
                />
              </label>
              <label>
                {tr("Email (used to sign in)")}
                <input
                  value={nu.email}
                  onChange={(e) => setNu({ ...nu, email: e.target.value })}
                />
              </label>
              <label>
                {tr("Job role")}
                <select
                  value={nu.role}
                  onChange={(e) => setNu({ ...nu, role: e.target.value })}
                >
                  {ROLES.filter(([r]) => owner || r !== "owner").map(
                    ([r, l]) => (
                      <option key={r} value={r}>
                        {l}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <label>
                {tr("Password (at least 6 characters)")}
                <input
                  type="password"
                  value={nu.password}
                  onChange={(e) => setNu({ ...nu, password: e.target.value })}
                />
              </label>
              <button
                className="btn gold"
                disabled={!nu.name || !nu.email || nu.password.length < 6}
                onClick={() =>
                  run(
                    () => api("/admin/users", { method: "POST", body: nu }),
                    tr("User created."),
                  )
                }
              >
                {tr("Create user")}
              </button>
            </div>
          </div>
        </div>
      )}
      {tab === "rooms" && (
        <div className="grid g2">
          <div className="card scroll-x">
            <table>
              <thead>
                <tr>
                  <th>{tr("Room")}</th>
                  <th>{tr("Type")}</th>
                  <th>{tr("Price per night (EGP)")}</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((r) => (
                  <tr key={r._id}>
                    <td>
                      <b>{r.number}</b>
                    </td>
                    <td>{tr(r.type)}</td>
                    <td>
                      <input
                        type="number"
                        style={{ width: 120 }}
                        defaultValue={r.rate}
                        onBlur={(e) =>
                          +e.target.value !== r.rate &&
                          run(
                            () =>
                              api("/rooms/" + r._id, {
                                method: "PATCH",
                                body: { rate: e.target.value },
                              }),
                            tr("Room {n} price saved.", { n: r.number }),
                          )
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card">
            <h3>{tr("Add a room")}</h3>
            <div className="grid" style={{ marginTop: 10 }}>
              <label>
                {tr("Room number")}
                <input
                  value={nr.number}
                  onChange={(e) => setNr({ ...nr, number: e.target.value })}
                />
              </label>
              <label>
                {tr("Type")}
                <select
                  value={nr.type}
                  onChange={(e) => setNr({ ...nr, type: e.target.value })}
                >
                  {[
                    "Standard",
                    "Deluxe View",
                    "Family Suite",
                    "Royal Suite",
                  ].map((t) => (
                    <option key={t} value={t}>{tr(t)}</option>
                  ))}
                </select>
              </label>
              <label>
                {tr("Price per night (EGP)")}
                <input
                  type="number"
                  value={nr.rate}
                  onChange={(e) => setNr({ ...nr, rate: e.target.value })}
                />
              </label>
              <button
                className="btn gold"
                disabled={!nr.number || !(nr.rate > 0)}
                onClick={() =>
                  run(
                    () => api("/rooms", { method: "POST", body: nr }),
                    tr("Room added."),
                  )
                }
              >
                {tr("Add room")}
              </button>
            </div>
          </div>
        </div>
      )}
      {tab === "menu" && (
        <div className="grid g2">
          <div className="card scroll-x">
            <table>
              <thead>
                <tr>
                  <th>{tr("Item")}</th>
                  <th>{tr("Sold in")}</th>
                  <th>{tr("Price (EGP)")}</th>
                  <th>{tr("On the menu")}</th>
                </tr>
              </thead>
              <tbody>
                {menu.map((m) => (
                  <tr key={m._id}>
                    <td>
                      {m.emoji} {tr(m.name)}
                      <br />
                      <small>{tr(m.category)}</small>
                    </td>
                    <td>
                      <small>
                        {m.outlets
                          .map((o) => tr(o === "room" ? "room service" : o))
                          .join(tr(", "))}
                      </small>
                    </td>
                    <td>
                      <input
                        type="number"
                        style={{ width: 100 }}
                        defaultValue={m.price}
                        onBlur={(e) =>
                          +e.target.value !== m.price &&
                          run(
                            () =>
                              api("/menu/" + m._id, {
                                method: "PATCH",
                                body: { price: e.target.value },
                              }),
                            tr("{name} price saved.", { name: tr(m.name) }),
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        style={{ width: "auto" }}
                        checked={m.available !== false}
                        onChange={(e) =>
                          run(() =>
                            api("/menu/" + m._id, {
                              method: "PATCH",
                              body: { available: e.target.checked },
                            }),
                          )
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card">
            <h3>{tr("Add a menu item")}</h3>
            <div className="grid" style={{ marginTop: 10 }}>
              <label>
                {tr("Name")}
                <input
                  value={nm.name}
                  onChange={(e) => setNm({ ...nm, name: e.target.value })}
                />
              </label>
              <label>
                {tr("Group (Drinks, Mains…)")}
                <input
                  value={nm.category}
                  onChange={(e) => setNm({ ...nm, category: e.target.value })}
                />
              </label>
              <label>
                {tr("Price (EGP, before tax)")}
                <input
                  type="number"
                  value={nm.price}
                  onChange={(e) => setNm({ ...nm, price: e.target.value })}
                />
              </label>
              <label>
                {tr("Emoji")}
                <input
                  value={nm.emoji}
                  onChange={(e) => setNm({ ...nm, emoji: e.target.value })}
                />
              </label>
              <div>
                <small>{tr("Sold in")}</small>
                {[
                  ["restaurant", tr("Restaurant")],
                  ["rooftop", tr("Rooftop")],
                  ["room", tr("Room service (QR in rooms)")],
                ].map(([o, l]) => (
                  <label
                    key={o}
                    style={{ display: "flex", gap: 8, alignItems: "center" }}
                  >
                    <input
                      type="checkbox"
                      style={{ width: "auto", margin: 0 }}
                      checked={nm.outlets.includes(o)}
                      onChange={() =>
                        setNm({ ...nm, outlets: toggle(nm.outlets, o) })
                      }
                    />
                    {l}
                  </label>
                ))}
              </div>
              <button
                className="btn gold"
                disabled={!nm.name || !(nm.price > 0)}
                onClick={() =>
                  run(
                    () => api("/menu", { method: "POST", body: nm }),
                    tr("Menu item added."),
                  )
                }
              >
                {tr("Add item")}
              </button>
            </div>
          </div>
        </div>
      )}
      {tab === "audit" && (
        <div className="card scroll-x">
          <p className="help">
            {tr("Every important action is saved here with who did it and when. Cancelled items, manual entries and refused page attempts are highlighted.")}
          </p>
          <table>
            <thead>
              <tr>
                <th>{tr("When")}</th>
                <th>{tr("Who")}</th>
                <th>{tr("What")}</th>
                <th>{tr("Details")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {audit.map((a) => (
                <tr key={a._id}>
                  <td>{new Date(a.createdAt).toLocaleString(locale)}</td>
                  <td>
                    {a.user}
                    <br />
                    <small>{(ROLES.find(([r]) => r === a.role) || [])[1] || a.role}</small>
                  </td>
                  <td>{tm(a.action)}</td>
                  <td>{tm(a.detail)}</td>
                  <td>{a.severity !== "info" && <Pill s={a.severity} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {tab === "backup" && (
        <div className="card">
          <div className="row" style={{ marginBottom: 12 }}>
            <p style={{ margin: 0 }}>
              {rich("A full copy of <b>all hotels</b> is saved every night at 03:00 in the <code>server/backups</code> folder (the last 30 are kept). Copy that folder to another disk or computer regularly. To restore a copy, run <code>npm run restore -- backups/FILE.json</code> in the server folder.")}
            </p>
            <button
              className="btn gold"
              onClick={() =>
                run(
                  () => api("/admin/backups", { method: "POST" }),
                  tr("Backup saved."),
                )
              }
            >
              {tr("Make a backup now")}
            </button>
          </div>
          <table>
            <thead>
              <tr>
                <th>{tr("File")}</th>
                <th className="n">{tr("Size")}</th>
                <th>{tr("Made on")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {backups.map((b) => (
                <tr key={b.name}>
                  <td>{b.name}</td>
                  <td className="n">{b.sizeKB} {tr("KB")}</td>
                  <td>{new Date(b.at).toLocaleString(locale)}</td>
                  <td>
                    <button
                      className="btn ghost sm"
                      onClick={() => download(b.name)}
                    >
                      {tr("Download")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
