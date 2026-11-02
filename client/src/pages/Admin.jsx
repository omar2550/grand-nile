import React, { useContext, useEffect, useState } from "react";
import { api, getToken } from "../api.js";
import { Err, Head, HotelCtx, Pill, Tabs, money } from "../ui.jsx";

const ROLES = [
  ["owner", "Owner (all hotels)"],
  ["admin", "Hotel administrator"],
  ["manager", "General manager"],
  ["front_desk", "Reception"],
  ["cashier", "Restaurant cashier"],
  ["accountant", "Accountant"],
  ["storekeeper", "Storekeeper"],
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
    const r = await fetch("/api/admin/backups/" + name, {
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
    ["users", "Users & job roles"],
    ["rooms", "Rooms & prices"],
    ["menu", "Menu & prices"],
    ["audit", "Activity log"],
    ["backup", "Backups"],
  ];
  return (
    <>
      <Head
        title="Users & settings"
        sub="Who can do what, your prices, and your safety copies"
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
                  <th>Name</th>
                  <th>Job role</th>
                  <th>Can sign in</th>
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
            <h3>Add a user</h3>
            <p className="help" style={{ marginTop: 8 }}>
              <b>Reception</b>: bookings & guest bills <br /> 
              <b>Cashier</b>: restaurant & rooftop <br /> 
              <b>Accountant</b>: accounts, cash, stock <br />
              <b>Storekeeper</b>: stock only <br />
              <b>Manager</b>: everything except settings <br />
              <b>Administrator</b>: everything for their hotel. <br />
              <i>There is no limit on the number of users.</i>
            </p>
            <div className="grid">
              <label>
                Name
                <input
                  value={nu.name}
                  onChange={(e) => setNu({ ...nu, name: e.target.value })}
                />
              </label>
              <label>
                Email (used to sign in)
                <input
                  value={nu.email}
                  onChange={(e) => setNu({ ...nu, email: e.target.value })}
                />
              </label>
              <label>
                Job role
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
                Password (at least 6 characters)
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
                    "User created.",
                  )
                }
              >
                Create user
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
                  <th>Room</th>
                  <th>Type</th>
                  <th>Price per night (EGP)</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((r) => (
                  <tr key={r._id}>
                    <td>
                      <b>{r.number}</b>
                    </td>
                    <td>{r.type}</td>
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
                            `Room ${r.number} price saved.`,
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
            <h3>Add a room</h3>
            <div className="grid" style={{ marginTop: 10 }}>
              <label>
                Room number
                <input
                  value={nr.number}
                  onChange={(e) => setNr({ ...nr, number: e.target.value })}
                />
              </label>
              <label>
                Type
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
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label>
                Price per night (EGP)
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
                    "Room added.",
                  )
                }
              >
                Add room
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
                  <th>Item</th>
                  <th>Sold in</th>
                  <th>Price (EGP)</th>
                  <th>On the menu</th>
                </tr>
              </thead>
              <tbody>
                {menu.map((m) => (
                  <tr key={m._id}>
                    <td>
                      {m.emoji} {m.name}
                      <br />
                      <small>{m.category}</small>
                    </td>
                    <td>
                      <small>
                        {m.outlets
                          .map((o) => (o === "room" ? "room service" : o))
                          .join(", ")}
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
                            `${m.name} price saved.`,
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
            <h3>Add a menu item</h3>
            <div className="grid" style={{ marginTop: 10 }}>
              <label>
                Name
                <input
                  value={nm.name}
                  onChange={(e) => setNm({ ...nm, name: e.target.value })}
                />
              </label>
              <label>
                Group (Drinks, Mains…)
                <input
                  value={nm.category}
                  onChange={(e) => setNm({ ...nm, category: e.target.value })}
                />
              </label>
              <label>
                Price (EGP, before tax)
                <input
                  type="number"
                  value={nm.price}
                  onChange={(e) => setNm({ ...nm, price: e.target.value })}
                />
              </label>
              <label>
                Emoji
                <input
                  value={nm.emoji}
                  onChange={(e) => setNm({ ...nm, emoji: e.target.value })}
                />
              </label>
              <div>
                <small>Sold in</small>
                {[
                  ["restaurant", "Restaurant"],
                  ["rooftop", "Rooftop"],
                  ["room", "Room service (QR in rooms)"],
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
                    "Menu item added.",
                  )
                }
              >
                Add item
              </button>
            </div>
          </div>
        </div>
      )}
      {tab === "audit" && (
        <div className="card scroll-x">
          <p className="help">
            Every important action is saved here with who did it and when.
            Cancelled items, manual entries and refused page attempts are
            highlighted.
          </p>
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>What</th>
                <th>Details</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {audit.map((a) => (
                <tr key={a._id}>
                  <td>{new Date(a.createdAt).toLocaleString("en-GB")}</td>
                  <td>
                    {a.user}
                    <br />
                    <small>{a.role}</small>
                  </td>
                  <td>{a.action}</td>
                  <td>{a.detail}</td>
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
              A full copy of <b>all hotels</b> is saved every night at 03:00 in
              the <code>server/backups</code> folder (the last 30 are kept).
              Copy that folder to another disk or computer regularly. To restore
              a copy, run <code>npm run restore -- backups/FILE.json</code> in
              the server folder.
            </p>
            <button
              className="btn gold"
              onClick={() =>
                run(
                  () => api("/admin/backups", { method: "POST" }),
                  "Backup saved.",
                )
              }
            >
              Make a backup now
            </button>
          </div>
          <table>
            <thead>
              <tr>
                <th>File</th>
                <th className="n">Size</th>
                <th>Made on</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {backups.map((b) => (
                <tr key={b.name}>
                  <td>{b.name}</td>
                  <td className="n">{b.sizeKB} KB</td>
                  <td>{new Date(b.at).toLocaleString("en-GB")}</td>
                  <td>
                    <button
                      className="btn ghost sm"
                      onClick={() => download(b.name)}
                    >
                      Download
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
