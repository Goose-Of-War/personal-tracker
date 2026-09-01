import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { formatMoney } from "../lib/money.js";
import { groupAccountsByType } from "../lib/accountTypes.js";
import { useAccounts } from "../context/AccountsContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import NavBar from "../components/NavBar.jsx";
import { api } from "../api/client.js";
import { currentMonth, monthLabel } from "../lib/monthNav.js";

export default function Home() {
  const { accounts, loading, error } = useAccounts();
  const { user } = useAuth();
  const currency = user?.currency || "INR";

  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState("");

  useEffect(() => {
    let cancelled = false;
    api
      .get("/home/expense-stats")
      .then((d) => !cancelled && setStats(d))
      .catch((err) => !cancelled && setStatsError(err.message))
      .finally(() => !cancelled && setStatsLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  // Category totals instead of one combined net worth figure - a large loan
  // balance made a single net number swing painfully negative to look at.
  // Each is a plain sum of that type's account balances, no cross-type netting.
  const sumByType = (type) => accounts.filter((a) => a.type === type).reduce((sum, a) => sum + a.balance, 0);
  const summary = [
    { label: "Amount in savings", value: sumByType("savings") },
    { label: "Amount in investments", value: sumByType("investment") },
    { label: "Credit due", value: sumByType("credit") },
    { label: "Loan due", value: sumByType("loan") },
    { label: "Owed to you", value: sumByType("iou") },
  ];

  const breakdown = stats?.currentMonth?.breakdown ?? [];
  const delta = stats?.dailyAvgDelta;

  return (
    <div className="page">
      <NavBar />
      <h1>Overview</h1>

      {statsLoading && <p>Loading…</p>}
      {statsError && <p className="form-error">{statsError}</p>}
      {!statsLoading && !statsError && (
        <section className="page-section">
          <div className="page-section__header">
            <h2>{monthLabel(currentMonth())} — Expenses</h2>
          </div>
          {breakdown.length === 0 ? (
            <p className="page-hint">No expenses recorded this month.</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={breakdown}>
                  <XAxis dataKey="category" />
                  <YAxis tickFormatter={(v) => formatMoney(v, currency)} width={80} />
                  <Tooltip formatter={(value) => formatMoney(value, currency)} />
                  <Bar dataKey="total" name="Spend" animationDuration={500}>
                    {breakdown.map((_, i) => (
                      <Cell key={i} fill={i === breakdown.length - 1 && breakdown[breakdown.length - 1].category === "Other" ? "#9ca3af" : "#6366f1"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {delta != null ? (
                <p className={`home-delta ${delta >= 0 ? "home-delta--up" : "home-delta--down"}`}>
                  Avg daily spend is {delta >= 0 ? "up" : "down"}{" "}
                  <strong>{Math.abs(delta).toFixed(1)}%</strong> vs {monthLabel(stats.previousMonth)}
                </p>
              ) : (
                <p className="page-hint">
                  No expenses last month — nothing to compare this month against.
                </p>
              )}
            </>
          )}
        </section>
      )}

      {loading && <p>Loading…</p>}
      {error && <p className="form-error">{error}</p>}

      {!loading && !error && (
        <>
          <div className="summary-grid">
            {summary.map((s) => (
              <div key={s.label} className="summary-card">
                <span className="summary-card__label">{s.label}</span>
                <span className="summary-card__value">{formatMoney(s.value, currency)}</span>
              </div>
            ))}
          </div>

          {accounts.length === 0 && <p>No accounts yet — add one on the Accounts page.</p>}

          {groupAccountsByType(accounts).map((group) => (
            <div key={group.type} className="account-group">
              <h2 className="account-group__title">{group.label}</h2>
              <ul className="account-status-list">
                {group.accounts.map((a) => (
                  <li key={a._id} className={`account-status-list__item account-status-list__item--${a.type}`}>
                    <span>{a.name}</span>
                    <span>{formatMoney(a.balance, currency)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
