import { useState } from "react";
import { api } from "../api/client.js";
import AccountCard from "../components/AccountCard.jsx";
import AccountEditOverlay from "../components/AccountEditOverlay.jsx";
import NavBar from "../components/NavBar.jsx";
import { groupAccountsByType } from "../lib/accountTypes.js";
import { useAccounts } from "../context/AccountsContext.jsx";

export default function Accounts() {
  const { accounts, loading, error, refresh } = useAccounts();
  const [editing, setEditing] = useState(undefined); // undefined = closed, null = new, object = edit

  const handleSave = async (payload) => {
    if (editing && editing._id) {
      await api.patch(`/accounts/${editing._id}`, payload);
    } else {
      await api.post("/accounts", payload);
    }
    await refresh();
  };

  const handleArchive = async (account) => {
    await api.delete(`/accounts/${account._id}`);
    setEditing(undefined);
    await refresh();
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
