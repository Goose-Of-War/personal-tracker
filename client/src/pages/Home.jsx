import { useEffect, useState } from "react";
import { formatMoney } from "../lib/money.js";
import { useAuth } from "../context/AuthContext.jsx";
import NavBar from "../components/NavBar.jsx";
import { api } from "../api/client.js";
import { monthLabel } from "../lib/monthNav.js";

const CHUNK_COLORS = ["#6366f1", "#2f6f4f", "#8f2f4f", "#2f5f8f", "#b3441f", "#8a5a1f"];

function DeltaBadge({ delta }) {
  if (delta == null) {
    return <span className="home-delta home-delta--none">no comparison last month</span>;
  }
  const up = delta >= 0;
  return (
    <span className="home-delta">
      <span
        className={`home-delta__triangle ${up ? "home-delta__triangle--up" : "home-delta__triangle--down"}`}
      >
        {up ? "▲" : "▼"}
      </span>
      <span className="home-delta__pct">{Math.abs(delta).toFixed(1)}%</span>
    </span>
  );
}

export default function Home() {
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

  const breakdown = stats?.currentMonth?.breakdown ?? [];
  const monthTotal = stats?.currentMonth?.total ?? 0;
  const dailyAvg = stats?.currentMonth?.dailyAvg ?? 0;
  const delta = stats?.dailyAvgDelta;
  const chunkColor = (b, i) => (b.category === "Other" ? "var(--muted)" : CHUNK_COLORS[i % CHUNK_COLORS.length]);

  return (
    <div className="page">
      <NavBar />
      <h1>Overview</h1>

      {statsLoading && <p>Loading…</p>}
      {statsError && <p className="form-error">{statsError}</p>}

      {!statsLoading && !statsError && (
        <section className="page-section">
          <div className="page-section__header">
            <h2>{monthLabel(stats.month)} — Expenses</h2>
          </div>
          {breakdown.length === 0 ? (
            <p className="page-hint">No expenses recorded this month.</p>
          ) : (
            <>
              <div className="expense-bar">
                {breakdown.map((b, i) => (
                  <div
                    key={b.category}
                    className="expense-bar__chunk"
                    style={{ width: `${(b.total / monthTotal) * 100}%`, backgroundColor: chunkColor(b, i) }}
                    title={b.category}
                  />
                ))}
              </div>

              <div className="expense-legend">
                {breakdown.map((b, i) => (
                  <span key={b.category} className="expense-legend__item">
                    <i className="expense-legend__dot" style={{ backgroundColor: chunkColor(b, i) }} />
                    {b.category}
                  </span>
                ))}
              </div>

              <div className="expense-row">
                <span className="expense-row__total">
                  {formatMoney(monthTotal, currency)}
                  <span className="expense-row__avg"> (avg {formatMoney(dailyAvg, currency)}/day)</span>
                </span>
                <DeltaBadge delta={delta} />
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}