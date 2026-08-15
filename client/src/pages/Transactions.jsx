import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import NavBar from "../components/NavBar.jsx";
import TransactionList from "../components/TransactionList.jsx";
import TransactionForm from "../components/TransactionForm.jsx";

const PAGE_SIZE = 20;

export default function Transactions() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(undefined); // undefined = closed, null = new, object = edit

  const load = async (targetPage = page) => {
    setLoading(true);
    try {
      const [accountsData, txData] = await Promise.all([
        api.get("/accounts"),
        api.get(`/transactions?page=${targetPage}&limit=${PAGE_SIZE}`),
      ]);
      setAccounts(accountsData);
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
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const accountsById = new Map(accounts.map((a) => [a._id, a]));

  const handleSave = async (payload) => {
    if (editing && editing._id) {
      await api.patch(`/transactions/${editing._id}`, payload);
    } else {
      await api.post("/transactions", payload);
    }
    await load(page);
  };

  const handleDelete = async (transaction) => {
    await api.delete(`/transactions/${transaction._id}`);
    setEditing(undefined);
    await load(page);
  };

  const goToPage = (p) => {
    if (p < 1 || p > totalPages) return;
    load(p);
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
