import { useState } from "react";
import { api } from "../api/client.js";
import AccountCard from "../components/AccountCard.jsx";
import AccountEditOverlay from "../components/AccountEditOverlay.jsx";
import NavBar from "../components/NavBar.jsx";
import { groupAccountsByType } from "../lib/accountTypes.js";
import { useAccounts } from "../context/AccountsContext.jsx";

const tempKey = () => `temp-${Date.now()}`;

export default function Accounts() {
  const { accounts, loading, error, refresh, setAccounts } = useAccounts();
  const [editing, setEditing] = useState(undefined); // undefined = closed, null = new, object = edit

  const handleSave = async (payload) => {
    if (editing && editing._id) {
      const id = editing._id;
      const snapshot = accounts;
      // Optimistic: apply the edit immediately.
      setAccounts((cur) => cur.map((a) => (a._id === id ? { ...a, ...payload } : a)));
      try {
        const saved = await api.patch(`/accounts/${id}`, payload);
        // Reconcile with the server's authoritative response.
        setAccounts((cur) => cur.map((a) => (a._id === id ? saved : a)));
      } catch (err) {
        setAccounts(snapshot);
        throw err;
      }
    } else {
      const snapshot = accounts;
      const tempId = tempKey();
      // Optimistic: show the new account while the request is in flight.
      setAccounts((cur) => [...cur, { _id: tempId, ...payload }]);
      try {
        const created = await api.post("/accounts", payload);
        // Swap the temp entry for the real one (keeps its position).
        setAccounts((cur) => cur.map((a) => (a._id === tempId ? created : a)));
      } catch (err) {
        setAccounts(snapshot);
        throw err;
      }
    }
  };

  const handleArchive = async (account) => {
    const snapshot = accounts;
    // Optimistic: hide the account immediately.
    setAccounts((cur) => cur.filter((a) => a._id !== account._id));
    setEditing(undefined);
    try {
      await api.delete(`/accounts/${account._id}`);
    } catch (err) {
      setAccounts(snapshot);
      throw err;
    }
  };

  return (
    <div className="page">
      <NavBar />
      <div className="page-header">
        <h1>Accounts</h1>
        <button onClick={() => setEditing(null)}>+ New account</button>
      </div>

      {loading && <p>Loading…</p>}
      {error && <p className="form-error">{error}</p>}

      {!loading && accounts.length === 0 && (
        <p className="page-hint">No accounts yet. Add one to get started.</p>
      )}

      {groupAccountsByType(accounts).map((group) => (
        <section key={group.type} className="account-group">
          <h2 className="account-group__title">{group.label}</h2>
          <div className="account-grid">
            {group.accounts.map((account) => (
              <AccountCard key={account._id} account={account} onClick={setEditing} />
            ))}
          </div>
        </section>
      ))}

      {editing !== undefined && (
        <AccountEditOverlay
          account={editing}
          onClose={() => setEditing(undefined)}
          onSave={handleSave}
          onArchive={handleArchive}
        />
      )}
    </div>
  );
}
