import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { toDisplay } from "../lib/money.js";
import { groupAccountsByType } from "../lib/accountTypes.js";
import NavBar from "../components/NavBar.jsx";

export default function Home() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/accounts")
      .then(setAccounts)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
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

  return (
    <div className="page">
      <NavBar />
      <h1>Overview</h1>

      {loading && <p>Loading…</p>}
      {error && <p className="form-error">{error}</p>}

      {!loading && !error && (
        <>
          <div className="summary-grid">
            {summary.map((s) => (
              <div key={s.label} className="summary-card">
                <span className="summary-card__label">{s.label}</span>
                <span className="summary-card__value">{toDisplay(s.value)}</span>
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
                    <span>{toDisplay(a.balance)}</span>
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
