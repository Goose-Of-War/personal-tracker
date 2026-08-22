import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useAccounts } from "../context/AccountsContext.jsx";
import NavBar from "../components/NavBar.jsx";
import TransactionList from "../components/TransactionList.jsx";
import TransactionForm from "../components/TransactionForm.jsx";

const PAGE_SIZE = 20;

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(month, delta) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month) {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export default function Transactions() {
  const { user } = useAuth();
  const { accounts, refresh: refreshAccounts } = useAccounts();
  const [transactions, setTransactions] = useState([]);
  const [month, setMonth] = useState(currentMonth());
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(undefined); // undefined = closed, null = new, object = edit

  const load = async (targetPage = page, targetMonth = month) => {
    setLoading(true);
    try {
      const txData = await api.get(`/transactions?page=${targetPage}&limit=${PAGE_SIZE}&month=${targetMonth}`);
      setTransactions(txData.items);
      setTotalPages(txData.totalPages);
      setPage(txData.page);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1, month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const accountsById = new Map(accounts.map((a) => [a._id, a]));

  const handleSave = async (payload) => {
    if (editing && editing._id) {
      await api.patch(`/transactions/${editing._id}`, payload);
    } else {
      await api.post("/transactions", payload);
    }
    await Promise.all([load(page, month), refreshAccounts()]);
  };

  const handleDelete = async (transaction) => {
    await api.delete(`/transactions/${transaction._id}`);
    setEditing(undefined);
    await Promise.all([load(page, month), refreshAccounts()]);
  };

  const goToPage = (p) => {
    if (p < 1 || p > totalPages) return;
    load(p, month);
  };

  return (
    <div className="page">
      <NavBar />
      <div className="page-header">
        <h1>Transactions</h1>
        <button onClick={() => setEditing(null)} disabled={accounts.length === 0}>
          + New transaction
        </button>
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

      {accounts.length === 0 && !loading && (
        <p className="page-hint">Add an account first before recording transactions.</p>
      )}

      {loading && <p>Loading…</p>}
      {error && <p className="form-error">{error}</p>}

      {!loading && !error && (
        <>
          <TransactionList transactions={transactions} accountsById={accountsById} onSelect={setEditing} />

          {totalPages > 1 && (
            <div className="pagination">
              <button className="button-secondary" onClick={() => goToPage(page - 1)} disabled={page <= 1}>
                Previous
              </button>
              <span>
                Page {page} of {totalPages}
              </span>
              <button className="button-secondary" onClick={() => goToPage(page + 1)} disabled={page >= totalPages}>
                Next
              </button>
            </div>
          )}
        </>
      )}

      {editing !== undefined && (
        <TransactionForm
          transaction={editing}
          accounts={accounts}
          categories={user?.categories ?? []}
          onClose={() => setEditing(undefined)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
