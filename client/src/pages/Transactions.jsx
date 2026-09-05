import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useAccounts } from "../context/AccountsContext.jsx";
import NavBar from "../components/NavBar.jsx";
import TransactionList from "../components/TransactionList.jsx";
import TransactionForm from "../components/TransactionForm.jsx";
import { currentMonth, shiftMonth, monthLabel } from "../lib/monthNav.js";

const PAGE_SIZE = 20;

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
  const [duplicating, setDuplicating] = useState(undefined); // undefined = closed, object = template to duplicate as new

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
      const id = editing._id;
      const snapshot = transactions;
      // Optimistic: apply the edit immediately.
      setTransactions((cur) => cur.map((t) => (t._id === id ? { ...t, ...payload } : t)));
      try {
        const saved = await api.patch(`/transactions/${id}`, payload);
        // Reconcile with the server's authoritative response.
        setTransactions((cur) => cur.map((t) => (t._id === id ? saved : t)));
        await refreshAccounts();
      } catch (err) {
        setTransactions(snapshot);
        throw err;
      }
    } else {
      const snapshot = transactions;
      const tempId = `temp-${Date.now()}`;
      // Optimistic: show the new transaction while the request is in flight.
      setTransactions((cur) => [
        { _id: tempId, date: payload.date ? new Date(payload.date) : new Date(), ...payload },
        ...cur,
      ]);
      try {
        const created = await api.post("/transactions", payload);
        // Swap the temp entry for the real one (keeps its position).
        setTransactions((cur) => cur.map((t) => (t._id === tempId ? created : t)));
        await refreshAccounts();
      } catch (err) {
        setTransactions(snapshot);
        throw err;
      }
    }
  };

  const handleDelete = async (transaction) => {
    const snapshot = transactions;
    // Optimistic: remove it immediately.
    setTransactions((cur) => cur.filter((t) => t._id !== transaction._id));
    setEditing(undefined);
    setDuplicating(undefined);
    try {
      await api.delete(`/transactions/${transaction._id}`);
      await refreshAccounts();
    } catch (err) {
      setTransactions(snapshot);
      throw err;
    }
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
          <TransactionList
            transactions={transactions}
            accountsById={accountsById}
            onSelect={setEditing}
            onDuplicate={setDuplicating}
          />

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

      {duplicating !== undefined && (
        <TransactionForm
          transaction={duplicating}
          accounts={accounts}
          categories={user?.categories ?? []}
          isDuplicate
          onClose={() => setDuplicating(undefined)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
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
