import { useState, useEffect } from "react";
import { toDisplay, toSmallestUnit, accountDisplayName } from "../lib/money.js";
import { ACCOUNT_TYPES } from "../lib/accountTypes.js";
import { api } from "../api/client.js";

const TYPE_ORDER = ACCOUNT_TYPES.map((t) => t.value);

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
// isDuplicate: pre-fill the form from `transaction` but treat it as a NEW record
// (saving POSTs a fresh transaction) — for recurring entries.
export default function TransactionForm({ transaction, accounts, categories = [], isDuplicate = false, onClose, onSave, onDelete }) {
  const isNew = !transaction || isDuplicate;
  const sortedAccounts = [...accounts].sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type));
  const [form, setForm] = useState({
    type: transaction?.type ?? "expense",
    date: toDateInputValue(isDuplicate ? undefined : transaction?.date),
    category: transaction?.category ?? "",
    subCategory: transaction?.subCategory ?? "",
    primaryAccount: transaction?.primaryAccount ?? sortedAccounts[0]?._id ?? "",
    primaryAmount: transaction ? toDisplay(transaction.primaryAmount) : "",
    split: transaction?.type === "expense" && !!transaction?.secondaryAccount,
    secondaryAccount: transaction?.secondaryAccount ?? "",
    secondaryAmount: transaction?.secondaryAmount != null ? toDisplay(transaction.secondaryAmount) : "",
    note: transaction?.note ?? "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Templates (only relevant when starting a new transaction)
  const [templates, setTemplates] = useState([]);
  const [templateId, setTemplateId] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateBusy, setTemplateBusy] = useState(false);
  const [templateSaved, setTemplateSaved] = useState(false);

  useEffect(() => {
    if (!isNew) return;
    let active = true;
    api
      .get("/templates")
      .then((list) => {
        if (active) setTemplates(list);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isNew]);

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

  // Picking a template pre-fills every field except the date (always today).
  const handleTemplateSelect = (e) => {
    const value = e.target.value;
    setTemplateId(value);
    const t = templates.find((x) => x._id === value);
    if (!t) return;
    setForm((f) => ({
      ...f,
      type: t.type,
      category: t.category ?? "",
      subCategory: t.subCategory ?? "",
      primaryAccount: sortedAccounts.some((a) => a._id === t.primaryAccount) ? t.primaryAccount : "",
      primaryAmount: toDisplay(t.primaryAmount),
      split: t.type === "expense" && !!t.secondaryAccount,
      secondaryAccount: t.secondaryAccount ?? "",
      secondaryAmount: t.secondaryAmount != null ? toDisplay(t.secondaryAmount) : "",
      note: t.note ?? "",
    }));
  };

  const buildPayload = () => {
    const payload = {
      type: form.type,
      date: form.date,
      category: form.category,
      subCategory: form.subCategory,
      primaryAccount: form.primaryAccount,
      primaryAmount: toSmallestUnit(form.primaryAmount || "0"),
      note: form.note,
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
    return payload;
  };

  const suggestedTemplateName = `${form.type} · ${form.category || "uncategorized"}`;

  const saveAsTemplate = async () => {
    setError("");
    setTemplateBusy(true);
    try {
      const payload = buildPayload();
      delete payload.date; // templates have no fixed date
      await api.post("/templates", { ...payload, name: templateName.trim() || suggestedTemplateName });
      setTemplates(await api.get("/templates"));
      setSavingTemplate(false);
      setTemplateName("");
      setTemplateSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setTemplateBusy(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await onSave(buildPayload());
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
        <h2>{isNew ? (isDuplicate ? "Duplicate transaction" : "New transaction") : "Edit transaction"}</h2>

        {isNew && templates.length > 0 && (
          <label>
            Start from a template
            <select value={templateId || ""} onChange={handleTemplateSelect}>
              <option value="">Blank transaction</option>
              {templates.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        )}

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
              {[...selectedCategory.subCategories].sort((a, b) => a.localeCompare(b)).map((s) => (
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
            {sortedAccounts.map((a) => (
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
                {sortedAccounts
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

        <label>
          Note
          <input value={form.note} onChange={update("note")} placeholder="Optional" />
        </label>

        {savingTemplate && (
          <div className="template-save-name">
            <label>
              Template name
              <input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder={`Default: ${suggestedTemplateName}`}
                autoFocus
              />
            </label>
            <button type="button" onClick={saveAsTemplate} disabled={templateBusy}>
              {templateBusy ? "Saving…" : "Save template"}
            </button>
          </div>
        )}
        {templateSaved && <p className="page-hint">Template saved.</p>}

        {error && <p className="form-error">{error}</p>}

        <div className="overlay-actions">
          <button type="button" className="button-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="button-secondary" onClick={() => setSavingTemplate((s) => !s)}>
            {savingTemplate ? "Cancel template" : "Save as template"}
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