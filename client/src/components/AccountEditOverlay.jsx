import { useState } from "react";
import { toDisplay, toSmallestUnit } from "../lib/money.js";
import { ACCOUNT_TYPES } from "../lib/accountTypes.js";

// account = null means "create new account"
export default function AccountEditOverlay({ account, onClose, onSave, onArchive }) {
  const isNew = !account;
  const [form, setForm] = useState({
    name: account?.name ?? "",
    type: account?.type ?? "savings",
    balance: account ? toDisplay(account.balance) : "0.00",
    limit: account?.limit != null ? toDisplay(account.limit) : "",
    note: account?.note ?? "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await onSave({
        name: form.name,
        type: form.type,
        balance: toSmallestUnit(form.balance || "0"),
        limit: form.type === "credit" && form.limit !== "" ? toSmallestUnit(form.limit) : null,
        note: form.note,
      });
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <form className="overlay-card" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2>{isNew ? "New account" : "Edit account"}</h2>

        <label>
          Name
          <input
            value={form.name}
            onChange={update("name")}
            placeholder={form.type === "iou" ? "e.g. Nathan Drake" : undefined}
            required
          />
        </label>

        <label>
          Type
          <select value={form.type} onChange={update("type")}>
            {ACCOUNT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Balance
          <input type="number" step="0.01" value={form.balance} onChange={update("balance")} required />
        </label>

        {form.type === "credit" && (
          <label>
            Limit
            <input type="number" step="0.01" value={form.limit} onChange={update("limit")} />
          </label>
        )}

        <label>
          Note
          <textarea value={form.note} onChange={update("note")} rows={2} />
        </label>

        {error && <p className="form-error">{error}</p>}

        <div className="overlay-actions">
          <button type="button" className="button-secondary" onClick={onClose}>
            Cancel
          </button>
          {!isNew && (
            <button type="button" className="button-danger" onClick={() => onArchive(account)}>
              Archive
            </button>
          )}
          <button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
