import { useState } from "react";
import { toDisplay, toSmallestUnit, accountDisplayName } from "../lib/money.js";

const TYPES = [
  { value: "expense", label: "Expense" },
  { value: "deposit", label: "Deposit" },
  { value: "transfer", label: "Transfer" },
];

function toDateInputValue(date) {
  const d = date ? new Date(date) : new Date();
  return d.toISOString().slice(0, 10);
}

// transaction = null means "create new". categories = the user's configured
// categories list (§1a): [{ name, subCategories: [] }].
export default function TransactionForm({ transaction, accounts, categories = [], onClose, onSave, onDelete }) {
  const isNew = !transaction;
  const [form, setForm] = useState({
    type: transaction?.type ?? "expense",
    date: toDateInputValue(transaction?.date),
    category: transaction?.category ?? "",
    subCategory: transaction?.subCategory ?? "",
    primaryAccount: transaction?.primaryAccount ?? accounts[0]?._id ?? "",
    primaryAmount: transaction ? toDisplay(transaction.primaryAmount) : "",
    split: transaction?.type === "expense" && !!transaction?.secondaryAccount,
    secondaryAccount: transaction?.secondaryAccount ?? "",
    secondaryAmount: transaction?.secondaryAmount != null ? toDisplay(transaction.secondaryAmount) : "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const selectedCategory = categories.find((c) => c.name === form.category);
  const showSecondary = form.type === "transfer" || (form.type === "expense" && form.split);

  const handleTypeChange = (e) => {
    const type = e.target.value;
    // "split" only applies to expense - drop it if switching away.
    setForm((f) => ({ ...f, type, split: type === "expense" ? f.split : false }));
  };

  const handleCategoryChange = (e) => {
    setForm((f) => ({ ...f, category: e.target.value, subCategory: "" }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const payload = {
        type: form.type,
        date: form.date,
        category: form.category,
        subCategory: form.subCategory,
        primaryAccount: form.primaryAccount,
        primaryAmount: toSmallestUnit(form.primaryAmount || "0"),
      };
      if (form.type === "transfer") {
        payload.secondaryAccount = form.secondaryAccount;
        // Left blank -> backend defaults secondaryAmount to primaryAmount.
        payload.secondaryAmount = form.secondaryAmount !== "" ? toSmallestUnit(form.secondaryAmount) : undefined;
      } else if (form.type === "expense" && form.split) {
        // Split expense: unlike transfer, there's no sensible default for a partial
        // share, so secondaryAmount is required whenever split is on.
        payload.secondaryAccount = form.secondaryAccount;
        payload.secondaryAmount = toSmallestUnit(form.secondaryAmount || "0");
      }
      await onSave(payload);
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
        <h2>{isNew ? "New transaction" : "Edit transaction"}</h2>

        <label>
          Type
          <select value={form.type} onChange={handleTypeChange}>
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Date
          <input type="date" value={form.date} onChange={update("date")} required />
        </label>

        <label>
          Category
          <select value={form.category} onChange={handleCategoryChange}>
            <option value="">Uncategorized</option>
            {categories.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        {selectedCategory && selectedCategory.subCategories.length > 0 && (
          <label>
            Sub-category
            <select value={form.subCategory} onChange={update("subCategory")}>
              <option value="">None</option>
              {selectedCategory.subCategories.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        )}

        <label>
          {form.type === "transfer" ? "From account" : "Account"}
          <select value={form.primaryAccount} onChange={update("primaryAccount")} required>
            {accounts.map((a) => (
              <option key={a._id} value={a._id}>
                {accountDisplayName(a)}
              </option>
            ))}
          </select>
        </label>

        <label>
          Amount
          <input type="number" step="0.01" min="0.01" value={form.primaryAmount} onChange={update("primaryAmount")} required />
        </label>

        {form.type === "expense" && (
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={form.split}
              onChange={(e) => setForm((f) => ({ ...f, split: e.target.checked }))}
            />
            Split this expense with another account
          </label>
        )}

        {showSecondary && (
          <>
            <label>
              {form.type === "transfer" ? "To account" : "Split with account"}
              <select value={form.secondaryAccount} onChange={update("secondaryAccount")} required>
                <option value="" disabled>
                  Select an account
                </option>
                {accounts
                  .filter((a) => a._id !== form.primaryAccount)
                  .map((a) => (
                    <option key={a._id} value={a._id}>
                      {accountDisplayName(a)}
                    </option>
                  ))}
              </select>
            </label>

            <label>
              {form.type === "transfer" ? "Amount received (optional — defaults to the amount above)" : "Their share"}
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={form.secondaryAmount}
                onChange={update("secondaryAmount")}
                required={form.type === "expense"}
              />
            </label>
          </>
        )}

        {error && <p className="form-error">{error}</p>}

        <div className="overlay-actions">
          <button type="button" className="button-secondary" onClick={onClose}>
            Cancel
          </button>
          {!isNew && (
            <button type="button" className="button-danger" onClick={() => onDelete(transaction)}>
              Delete
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
