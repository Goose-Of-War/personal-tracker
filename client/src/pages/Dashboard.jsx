import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from "recharts";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import NavBar from "../components/NavBar.jsx";
import { currentMonth, shiftMonth, monthLabel } from "../lib/monthNav.js";
import { formatMoney } from "../lib/money.js";

const SLICE_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#a855f7", "#ec4899", "#84cc16"];
const CHART_ANIMATION_MS = 500;

function BreakdownBlock({ title, rows, currency }) {
  const total = rows.reduce((sum, row) => sum + row.total, 0);
  return (
    <div className="dashboard-breakdown">
      <h3 className="dashboard-breakdown__title">{title}</h3>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie data={rows} dataKey="total" nameKey="category" outerRadius={90} animationDuration={CHART_ANIMATION_MS}>
            {rows.map((_, i) => (
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
            <th>%</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.category}>
              <td>{row.category}</td>
              <td>{formatMoney(row.total, currency)}</td>
              <td>{total > 0 ? ((row.total / total) * 100).toFixed(1) : "0"}%</td>
            </tr>
          ))}
          <tr className="dashboard-table__total">
            <td>Total</td>
            <td>{formatMoney(total, currency)}</td>
            <td>100%</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const currency = user?.currency || "INR";
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    api
      .get(`/dashboard?month=${month}`)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [month]);

  const expenseBreakdown = data?.categoryBreakdown?.expenses ?? [];
  const depositBreakdown = data?.categoryBreakdown?.deposits ?? [];
  const dailyTrend = data?.dailyTrend ?? [];
  const summary = data?.summary;
  const avgDailyExpense = dailyTrend.length > 0 ? dailyTrend.reduce((sum, d) => sum + d.total, 0) / dailyTrend.length : 0;

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
            </div>

            {expenseBreakdown.length === 0 && depositBreakdown.length === 0 ? (
              <p className="page-hint">No expenses or deposits recorded this month.</p>
            ) : (
              <div className="dashboard-columns">
                {expenseBreakdown.length > 0 ? (
                  <BreakdownBlock title="Expenses" rows={expenseBreakdown} currency={currency} />
                ) : (
                  <p className="page-hint">No expenses recorded this month.</p>
                )}
                {depositBreakdown.length > 0 ? (
                  <BreakdownBlock title="Deposits" rows={depositBreakdown} currency={currency} />
                ) : (
                  <p className="page-hint">No deposits recorded this month.</p>
                )}
              </div>
            )}
          </section>

          <section className="page-section">
            <h2>Daily expenses</h2>
            {dailyTrend.length === 0 ? (
              <p className="page-hint">No expenses recorded this month.</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={dailyTrend}>
                  <XAxis dataKey="day" />
                  <YAxis tickFormatter={(v) => formatMoney(v, currency)} width={80} />
                  <Tooltip formatter={(value) => formatMoney(value, currency)} labelFormatter={(d) => `Day ${d}`} />
                  <ReferenceLine
                    y={avgDailyExpense}
                    stroke="#8f2f4f"
                    strokeDasharray="4 4"
                    label={{ value: "Avg", position: "insideTopRight" }}
                  />
                  <Line dataKey="total" name="Total" stroke="#6366f1" strokeWidth={2} dot={{ r: 3, shape: "square" }} animationDuration={CHART_ANIMATION_MS} />
                </LineChart>
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
                <Bar dataKey="value" name="Total" fill="#22c55e" animationDuration={CHART_ANIMATION_MS} />
              </BarChart>
            </ResponsiveContainer>
          </section>
        </>
      )}
    </div>
  );
}
