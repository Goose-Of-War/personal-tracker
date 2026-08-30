import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import NavBar from "../components/NavBar.jsx";
import { currentMonth, shiftMonth, monthLabel } from "../lib/monthNav.js";
import { formatMoney } from "../lib/money.js";

const SLICE_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#a855f7", "#ec4899", "#84cc16"];

export default function Dashboard() {
  const { user } = useAuth();
  const currency = user?.currency || "INR";
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [breakdownView, setBreakdownView] = useState("expenses"); // 'expenses' | 'deposits'

  useEffect(() => {
    setLoading(true);
    api
      .get(`/dashboard?month=${month}`)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [month]);

  const breakdown = data?.categoryBreakdown?.[breakdownView] ?? [];
  const dailyTrend = data?.dailyTrend ?? [];
  const summary = data?.summary;

  const typeComparisonData = summary
    ? [
        { name: "Expenses", value: summary.totalExpenses },
        { name: "Deposits", value: summary.totalDeposits },
        { name: "Transfers", value: summary.totalTransfers },
      ]
    : [];

  return (
    <div className="page">
      <NavBar />
      <div className="page-header">
        <h1>Dashboard</h1>
      </div>

      <div className="month-nav">
        <button className="button-secondary" onClick={() => setMonth((m) => shiftMonth(m, -1))}>
          ← Prev
        </button>
        <span>{monthLabel(month)}</span>
        <button className="button-secondary" onClick={() => setMonth((m) => shiftMonth(m, 1))}>
          Next →
        </button>
      </div>

      {loading && <p>Loading…</p>}
      {error && <p className="form-error">{error}</p>}

      {!loading && !error && summary && (
        <>
          <div className="summary-grid">
            <div className="summary-card">
              <span className="summary-card__label">Expenses</span>
              <span className="summary-card__value">{formatMoney(summary.totalExpenses, currency)}</span>
            </div>
            <div className="summary-card">
              <span className="summary-card__label">Deposits</span>
              <span className="summary-card__value">{formatMoney(summary.totalDeposits, currency)}</span>
            </div>
            <div className="summary-card">
              <span className="summary-card__label">Transfers</span>
              <span className="summary-card__value">{formatMoney(summary.totalTransfers, currency)}</span>
            </div>
            <div className="summary-card">
              <span className="summary-card__label">Net (deposits − expenses)</span>
              <span className="summary-card__value">{formatMoney(summary.net, currency)}</span>
            </div>
          </div>

          <section className="page-section">
            <div className="page-section__header">
              <h2>Category breakdown</h2>
              <div className="toggle-group">
                <button
                  className={breakdownView === "expenses" ? "" : "button-secondary"}
                  onClick={() => setBreakdownView("expenses")}
                >
                  Expenses
                </button>
                <button
                  className={breakdownView === "deposits" ? "" : "button-secondary"}
                  onClick={() => setBreakdownView("deposits")}
                >
                  Deposits
                </button>
              </div>
            </div>

            {breakdown.length === 0 ? (
              <p className="page-hint">No {breakdownView} recorded this month.</p>
            ) : (
              <div className="dashboard-breakdown">
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={breakdown} dataKey="total" nameKey="category" outerRadius={100} label>
                      {breakdown.map((_, i) => (
                        <Cell key={i} fill={SLICE_COLORS[i % SLICE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatMoney(value, currency)} />
                  </PieChart>
                </ResponsiveContainer>
                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdown.map((row) => (
                      <tr key={row.category}>
                        <td>{row.category}</td>
                        <td>{formatMoney(row.total, currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="page-section">
            <h2>Daily expenses</h2>
            {dailyTrend.length === 0 ? (
              <p className="page-hint">No expenses recorded this month.</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={dailyTrend}>
                  <XAxis dataKey="day" />
                  <YAxis tickFormatter={(v) => formatMoney(v, currency)} width={80} />
                  <Tooltip formatter={(value) => formatMoney(value, currency)} labelFormatter={(d) => `Day ${d}`} />
                  <Bar dataKey="total" fill="#6366f1" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </section>

          <section className="page-section">
            <h2>Expenses vs. deposits vs. transfers</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={typeComparisonData}>
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(v) => formatMoney(v, currency)} width={80} />
                <Tooltip formatter={(value) => formatMoney(value, currency)} />
                <Legend />
                <Bar dataKey="value" name="Total" fill="#22c55e" />
              </BarChart>
            </ResponsiveContainer>
          </section>
        </>
      )}
    </div>
  );
}
