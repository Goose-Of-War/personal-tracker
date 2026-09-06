import { useEffect, useState, useMemo } from "react";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useAccounts } from "../context/AccountsContext.jsx";
import NavBar from "../components/NavBar.jsx";
import TransactionList from "../components/TransactionList.jsx";
import TransactionForm from "../components/TransactionForm.jsx";
import { currentMonth, shiftMonth, monthLabel } from "../lib/monthNav.js";
import { toSmallestUnit, accountDisplayName } from "../lib/money.js";

// Server fetches happen at this page size, then loop until the whole month is
// collected. The visible list is paginated client-side at PAGE_SIZE instead.
const PAGE_SIZE = 20;
const FETCH_LIMIT = 100;

export default function Transactions() {
  const { user } = useAuth();
  const { accounts, refresh: refreshAccounts } = useAccounts();
  const [transactions, setTransactions] = useState([]); // the whole month
  const [month, setMonth] = useState(currentMonth());
  const [page, setPage] = useState(1); // client-side page of the filtered list
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(undefined); // undefined = closed, null = new, object = edit
  const [duplicating, setDuplicating] = useState(undefined); // undefined = closed, object = template to duplicate as new
  // Frontend-only filters. Seeded from the URL (so a filtered/shared link keeps
  // its filters) and mirrored back into the address bar via history.replaceState.
  const [filters, setFilters] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      type: params.get("type") || "",
      category: params.get("category") || "",
      primaryAccount: params.get("primaryAccount") || "",
      secondaryAccount: params.get("secondaryAccount") || "",
      min: params.get("min") || "",
      max: params.get("max") || "",
    };
  });

  useEffect(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== "" && value != null) params.set(key, value);
    });
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  }, [filters]);

  const hasActiveFilters = Object.values(filters).some((v) => v !== "");

  // Reset to the first page whenever the filtered view changes.
  useEffect(() => {
    setPage(1);
  }, [filters]);

  const filteredTransactions = useMemo(() => {
    if (!hasActiveFilters) return transactions;
    const minUnit = filters.min !== "" ? toSmallestUnit(filters.min) : null;
    const maxUnit = filters.max !== "" ? toSmallestUnit(filters.max) : null;
    return transactions.filter((t) => {
      if (filters.type && t.type !== filters.type) return false;
      if (filters.category && (t.category || "") !== filters.category) return false;
      if (filters.primaryAccount && String(t.primaryAccount) !== filters.primaryAccount) return false;
      if (filters.secondaryAccount && String(t.secondaryAccount || "") !== filters.secondaryAccount) return false;
      if (minUnit !== null && t.primaryAmount < minUnit) return false;
      if (maxUnit !== null && t.primaryAmount > maxUnit) return false;
      return true;
    });
  }, [transactions, filters, hasActiveFilters]);

  // Client-side pagination: filter against the WHOLE month, then show 20 at a time.
  const clientTotalPages = Math.max(1, Math.ceil(filteredTransactions.length / PAGE_SIZE));
  const clampedPage = Math.min(page, clientTotalPages);
  const pageSlice = filteredTransactions.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE);

  const clearFilters = () => setFilters({ type: "", category: "", primaryAccount: "", secondaryAccount: "", min: "", max: "" });

  const setFilter = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }));

  // Fetch the ENTIRE selected month (looping over server pages) so filters and
  // pagination can both run on the full dataset in the frontend.
  const load = async (targetMonth = month) => {
    setLoading(true);
    try {
      const items = [];
      let serverPage = 1;
      for (;;) {
        const txData = await api.get(`/transactions?page=${serverPage}&limit=${FETCH_LIMIT}&month=${targetMonth}`);
        items.push(...txData.items);
        if (items.length >= txData.total) break;
        serverPage += 1;
      }
      setTransactions(items);
      setPage(1);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const accountsById = new Map(accounts.map((a) => [a._id, a]));

  // Mirrors the server's sort ({ date: -1, createdAt: -1 }) so optimistic adds
  // and edits land in the right spot instead of sticking at the front.
  const sortMonthly = (list) =>
    [...list].sort((a, b) => {
      const aDate = new Date(a.date).getTime();
      const bDate = new Date(b.date).getTime();
      if (aDate !== bDate) return bDate - aDate;
      const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bCreated - aCreated;
    });

  const handleSave = async (payload) => {
    if (editing && editing._id) {
      const id = editing._id;
      const snapshot = transactions;
      // Optimistic: apply the edit immediately.
      setTransactions((cur) => sortMonthly(cur.map((t) => (t._id === id ? { ...t, ...payload } : t))));
      try {
        const saved = await api.patch(`/transactions/${id}`, payload);
        // Reconcile with the server's authoritative response.
        setTransactions((cur) => sortMonthly(cur.map((t) => (t._id === id ? saved : t))));
        await refreshAccounts();
      } catch (err) {
        setTransactions(snapshot);
        throw err;
      }
    } else {
      const snapshot = transactions;
      const tempId = `temp-${Date.now()}`;
      // Optimistic: show the new transaction while the request is in flight.
      setTransactions((cur) =>
        sortMonthly([
          { _id: tempId, createdAt: new Date().toISOString(), date: payload.date ? new Date(payload.date) : new Date(), ...payload },
          ...cur,
        ])
      );
      try {
        const created = await api.post("/transactions", payload);
        // Swap the temp entry for the real one (keeps its position).
        setTransactions((cur) => sortMonthly(cur.map((t) => (t._id === tempId ? created : t))));
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
    if (p < 1 || p > clientTotalPages) return;
    setPage(p);
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
          <div className="filter-bar">
            <select value={filters.type} onChange={setFilter("type")} aria-label="Type">
              <option value="">All types</option>
              <option value="deposit">Deposit</option>
              <option value="expense">Expense</option>
              <option value="transfer">Transfer</option>
            </select>
            <select value={filters.category} onChange={setFilter("category")} aria-label="Category">
              <option value="">Any category</option>
              {(user?.categories ?? []).map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
            <select value={filters.primaryAccount} onChange={setFilter("primaryAccount")} aria-label="Primary account">
              <option value="">Any account</option>
              {accounts.map((a) => (
                <option key={a._id} value={a._id}>
                  {accountDisplayName(a)}
                </option>
              ))}
            </select>
            <select value={filters.secondaryAccount} onChange={setFilter("secondaryAccount")} aria-label="Secondary account">
              <option value="">Any secondary account</option>
              {accounts.map((a) => (
                <option key={a._id} value={a._id}>
                  {accountDisplayName(a)}
                </option>
              ))}
            </select>
            <input type="number" step="0.01" placeholder="Min amount" value={filters.min} onChange={setFilter("min")} />
            <input type="number" step="0.01" placeholder="Max amount" value={filters.max} onChange={setFilter("max")} />
            {hasActiveFilters && (
              <button type="button" className="button-secondary" onClick={clearFilters}>
                Reset
              </button>
            )}
          </div>

          {hasActiveFilters && (
            <p className="page-hint">
              Showing {filteredTransactions.length} of {transactions.length} transactions this month.
            </p>
          )}

          {filteredTransactions.length === 0 && hasActiveFilters ? (
            <p className="page-hint">No transactions match the current filters.</p>
          ) : (
            <TransactionList
              transactions={pageSlice}
              accountsById={accountsById}
              onSelect={setEditing}
              onDuplicate={setDuplicating}
            />
          )}

          {clientTotalPages > 1 && (
            <div className="pagination">
              <button className="button-secondary" onClick={() => goToPage(clampedPage - 1)} disabled={clampedPage <= 1}>
                Previous
              </button>
              <span>
                Page {clampedPage} of {clientTotalPages}
              </span>
              <button className="button-secondary" onClick={() => goToPage(clampedPage + 1)} disabled={clampedPage >= clientTotalPages}>
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
