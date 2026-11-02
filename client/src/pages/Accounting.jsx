import React, { useEffect, useState } from "react";
import { api, addDays, today } from "../api.js";
import { Err, ExportBtn, Head, Range, Tabs, money, SOURCE } from "../ui.jsx";

export default function Accounting() {
  const [tab, setTab] = useState("journal");
  const [from, setFrom] = useState(addDays(today(), -7));
  const [to, setTo] = useState(today());
  const [data, setData] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [je, setJe] = useState({
    memo: "",
    date: today(),
    lines: [
      { code: "", debit: "", credit: "" },
      { code: "", debit: "", credit: "" },
    ],
  });
  useEffect(() => {
    api("/accounts").then(setAccounts);
  }, [ok]);
  useEffect(() => {
    if (tab === "manual") return;
    setData(null);
    setErr("");
    const q = `?from=${from}&to=${to}`;
    ({
      journal: () => api("/journal" + q),
      coa: () => api("/accounts"),
      tb: () => api("/reports/trial-balance" + q),
      pl: () => api("/reports/income" + q),
      bs: () => api("/reports/balance-sheet?to=" + to),
    })
      [tab]()
      .then(setData)
      .catch((e) => setErr(e.message));
  }, [tab, from, to, ok]);
  const postable = accounts.filter((a) => !a.isGroup);
  const drs = je.lines.reduce((s, l) => s + +l.debit, 0),
    crs = je.lines.reduce((s, l) => s + +l.credit, 0);
  const tbd =
    tab === "tb" && Array.isArray(data)
      ? data.filter((r) => r.debit || r.credit)
      : [];
  const setLine = (i, k, v) =>
    setJe({
      ...je,
      lines: je.lines.map((x, n) => (n === i ? { ...x, [k]: v } : x)),
    });
  const kind = {
    journal: "journal",
    tb: "trial-balance",
    pl: "income",
    bs: "balance-sheet",
  }[tab];
  return (
    <>
      <Head
        title="Accounts & reports"
        sub="The hotel's books. Everything done in the hotel is recorded here automatically."
      >
        {tab !== "coa" && tab !== "manual" && (
          <Range from={from} to={to} setFrom={setFrom} setTo={setTo} />
        )}
        {kind && <ExportBtn kind={kind} params={{ from, to }} />}
      </Head>
      <Tabs
        tab={tab}
        setTab={setTab}
        tabs={[
          ["journal", "Daily entries (journal)"],
          ["tb", "Trial balance"],
          ["pl", "Profit & loss"],
          ["bs", "Balance sheet"],
          ["manual", "Add a manual entry"],
        ]}
      />
      <p className="help">
        {
          {
            journal:
              "Every money event of the day, written as a debit and a credit that are always equal.",
            tb: "The total debit and credit of every account. The two totals must be equal.",
            pl: "Income minus costs and expenses for the period = profit.",
            bs: "What the hotel owns, what it owes, and the owners’ money, on the last date.",
            manual:
              "For corrections only. Debit and credit must be equal. This is recorded in the activity log.",
          }[tab]
        }
      </p>
      <Err e={err} />
      {ok && <div className="ok">{ok}</div>}
      {tab === "journal" && Array.isArray(data) && (
        <div className="card scroll-x">
          <table>
            <thead>
              <tr>
                <th>No.</th>
                <th>Day</th>
                <th>What happened</th>
                <th>From</th>
                <th>Accounts used</th>
                <th className="n">Amount</th>
              </tr>
            </thead>
            <tbody>
              {console.log(data)}
              {data.map((j) => (
                <tr key={j._id}>
                  <td>#{j.no}</td>
                  <td>{j.date}</td>
                  <td>{j.memo}</td>
                  <td>
                    <span className="pill">{SOURCE[j.source] || j.source}</span>
                  </td>
                  <td>
                    <small>
                      {j.user}
                    </small>
                  </td>
                  <td className="n">
                    {money(j.lines.reduce((s, l) => s + l.debit, 0))}
                  </td>
                </tr>
              ))}
              {!data.length && (
                <tr>
                  <td colSpan="6">No entries in this period.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {tab === "tb" && (
        <div className="card scroll-x">
          <table>
            <thead>
              <tr>
                <th>Account</th>
                <th className="n">Debit</th>
                <th className="n">Credit</th>
                <th className="n">Balance</th>
              </tr>
            </thead>
            <tbody>
              {tbd.map((r) => (
                <tr key={r.code}>
                  <td>
                    {r.code} · {r.name}
                  </td>
                  <td className="n">{money(r.debit)}</td>
                  <td className="n">{money(r.credit)}</td>
                  <td className="n">{money(r.balance)}</td>
                </tr>
              ))}
              {tbd.length > 0 && (
                <tr className="total">
                  <td>Totals</td>
                  <td className="n">
                    {money(tbd.reduce((s, r) => s + r.debit, 0))}
                  </td>
                  <td className="n">
                    {money(tbd.reduce((s, r) => s + r.credit, 0))}
                  </td>
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {tab === "pl" && data?.revenue && (
        <div className="card" style={{ maxWidth: 660 }}>
          <table>
            <tbody>
              <tr>
                <td colSpan="2">
                  <b>Income</b>
                </td>
              </tr>
              {data.revenue.map((r) => (
                <tr key={r.code}>
                  <td>{r.name}</td>
                  <td className="n">{money(r.balance)}</td>
                </tr>
              ))}
              <tr className="total">
                <td>Total income</td>
                <td className="n">{money(data.totalRevenue)}</td>
              </tr>
              <tr>
                <td colSpan="2">
                  <b>Direct costs</b>
                </td>
              </tr>
              {data.costs.map((r) => (
                <tr key={r.code}>
                  <td>{r.name}</td>
                  <td className="n">({money(r.balance)})</td>
                </tr>
              ))}
              <tr className="total">
                <td>Gross profit</td>
                <td className="n">{money(data.grossProfit)}</td>
              </tr>
              <tr>
                <td colSpan="2">
                  <b>Running expenses</b>
                </td>
              </tr>
              {data.opex.map((r) => (
                <tr key={r.code}>
                  <td>{r.name}</td>
                  <td className="n">({money(r.balance)})</td>
                </tr>
              ))}
              <tr className="total">
                <td>Net profit</td>
                <td className={"n " + (data.netIncome < 0 ? "neg" : "pos-c")}>
                  {money(data.netIncome)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      {tab === "bs" && data?.assets && (
        <div className="grid g2">
          <div className="card">
            <table>
              <tbody>
                <tr>
                  <td colSpan="2">
                    <b>What the hotel owns</b>
                  </td>
                </tr>
                {data.assets.map((r) => (
                  <tr key={r.code}>
                    <td>{r.name}</td>
                    <td className="n">{money(r.balance)}</td>
                  </tr>
                ))}
                <tr className="total">
                  <td>Total owned</td>
                  <td className="n">{money(data.totalAssets)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="card">
            <table>
              <tbody>
                <tr>
                  <td colSpan="2">
                    <b>What the hotel owes</b>
                  </td>
                </tr>
                {data.liabilities.map((r) => (
                  <tr key={r.code}>
                    <td>{r.name}</td>
                    <td className="n">{money(r.balance)}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan="2">
                    <b>Owners’ money</b>
                  </td>
                </tr>
                {data.equity.map((r) => (
                  <tr key={r.code}>
                    <td>{r.name}</td>
                    <td className="n">{money(r.balance)}</td>
                  </tr>
                ))}
                <tr>
                  <td>Profit so far</td>
                  <td className="n">{money(data.currentEarnings)}</td>
                </tr>
                <tr className="total">
                  <td>Total owed + owners’ money</td>
                  <td className="n">
                    {money(data.totalLiabilities + data.totalEquity)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
      {tab === "manual" && (
        <div className="card" style={{ maxWidth: 760 }}>
          <div className="grid">
            <div className="row">
              <label>
                What is this for?
                <input
                  value={je.memo}
                  onChange={(e) => setJe({ ...je, memo: e.target.value })}
                />
              </label>
              <label>
                Date
                <input
                  type="date"
                  value={je.date}
                  onChange={(e) => setJe({ ...je, date: e.target.value })}
                />
              </label>
            </div>
            {je.lines.map((l, i) => (
              <div className="row" key={i}>
                <label>
                  Account
                  <select
                    value={l.code}
                    onChange={(e) => setLine(i, "code", e.target.value)}
                  >
                    <option value="">Choose…</option>
                    {postable.map((a) => (
                      <option key={a.code} value={a.code}>
                        {a.code} · {a.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Debit
                  <input
                    type="number"
                    value={l.debit}
                    onChange={(e) => setLine(i, "debit", e.target.value)}
                  />
                </label>
                <label>
                  Credit
                  <input
                    type="number"
                    value={l.credit}
                    onChange={(e) => setLine(i, "credit", e.target.value)}
                  />
                </label>
              </div>
            ))}
            <div className="row">
              <button
                className="btn ghost"
                onClick={() =>
                  setJe({
                    ...je,
                    lines: [...je.lines, { code: "", debit: "", credit: "" }],
                  })
                }
              >
                Add a line
              </button>
              <span className="pill" style={{ flex: "none" }}>
                {drs === crs && drs > 0
                  ? "Balanced"
                  : `Difference ${(drs - crs).toFixed(2)}`}
              </span>
            </div>
            <button
              className="btn"
              disabled={
                drs !== crs ||
                !drs ||
                !je.memo ||
                je.lines.some((l) => (+l.debit || +l.credit) && !l.code)
              }
              onClick={async () => {
                setErr("");
                setOk("");
                try {
                  await api("/journal", { method: "POST", body: je });
                  setOk("Entry saved.");
                  setJe({
                    ...je,
                    memo: "",
                    lines: je.lines.map(() => ({
                      code: "",
                      debit: "",
                      credit: "",
                    })),
                  });
                } catch (e) {
                  setErr(e.message);
                }
              }}
            >
              Save entry
            </button>
          </div>
        </div>
      )}
    </>
  );
}
