import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import NavBar from "../components/NavBar.jsx";
import { api } from "../api/client.js";

const COMMON_CURRENCIES = ["INR", "USD", "EUR", "GBP"];

const ACCENT_OPTIONS = [
  { id: "default", label: "Default", color: "#2f6f4f" },
  { id: "ocean", label: "Ocean", color: "#2f5f8f" },
  { id: "forest", label: "Forest", color: "#1f7a4c" },
  { id: "ember", label: "Ember", color: "#c83f33" },
  { id: "magenta", label: "Magenta", color: "#d63384" },
  { id: "lavender", label: "Lavender", color: "#7660c4" },
  { id: "twilight", label: "Twilight", color: "#cd6922" },
  { id: "hazel", label: "Hazel", color: "#7a5230" },
  { id: "bw", label: "Monochrome", color: "#4b5563" },
];

const MODE_OPTIONS = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

export default function Profile() {
  const { user, updateCategories, updateCurrency, updateTheme } = useAuth();
  const categories = user?.categories ?? [];
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newSubCategory, setNewSubCategory] = useState({}); // { [categoryName]: draft text }
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [currencyError, setCurrencyError] = useState("");
  const [savingCurrency, setSavingCurrency] = useState(false);
  const [themeError, setThemeError] = useState("");
  const [savingTheme, setSavingTheme] = useState(false);
  const [dragIndex, setDragIndex] = useState(null); // drag-and-drop reorder of categories
  // Only one section is visible at a time (tabs above the content).
  const [activeTab, setActiveTab] = useState("preferences");
  // Transaction templates (saved from the transaction form, managed here)
  const [templates, setTemplates] = useState([]);
  const [templatesError, setTemplatesError] = useState("");
  const [templateDeleting, setTemplateDeleting] = useState(""); // id being deleted

  useEffect(() => {
    let active = true;
    api
      .get("/templates")
      .then((list) => {
        if (active) setTemplates(list);
      })
      .catch((err) => {
        if (active) setTemplatesError(err.message);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleDeleteTemplate = async (template) => {
    const snapshot = templates;
    setTemplateDeleting(template._id);
    setTemplatesError("");
    // Optimistic: hide the template immediately; restore on failure.
    setTemplates((cur) => cur.filter((t) => t._id !== template._id));
    try {
      await api.delete(`/templates/${template._id}`);
    } catch (err) {
      setTemplates(snapshot);
      setTemplatesError(err.message);
    } finally {
      setTemplateDeleting("");
    }
  };

  const handleAccentChange = async (accent) => {
    setThemeError("");
    setSavingTheme(true);
    try {
      await updateTheme({ accent });
    } catch (err) {
      setThemeError(err.message);
    } finally {
      setSavingTheme(false);
    }
  };

  const handleModeChange = async (mode) => {
    setThemeError("");
    setSavingTheme(true);
    try {
      await updateTheme({ mode });
    } catch (err) {
      setThemeError(err.message);
    } finally {
      setSavingTheme(false);
    }
  };

  const handleCurrencyChange = async (e) => {
    const value = e.target.value;
    setCurrencyError("");
    setSavingCurrency(true);
    try {
      await updateCurrency(value);
    } catch (err) {
      setCurrencyError(err.message);
    } finally {
      setSavingCurrency(false);
    }
  };

  const persist = async (next) => {
    setError("");
    setSaving(true);
    try {
      await updateCategories(next);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const addCategory = () => {
    const name = newCategoryName.trim();
    if (!name || categories.some((c) => c.name === name)) return;
    persist([...categories, { name, subCategories: [] }]);
    setNewCategoryName("");
  };

  const removeCategory = (name) => {
    persist(categories.filter((c) => c.name !== name));
  };

  const addSubCategory = (categoryName) => {
    const text = (newSubCategory[categoryName] || "").trim();
    if (!text) return;
    persist(
      categories.map((c) =>
        c.name === categoryName && !c.subCategories.includes(text)
          ? { ...c, subCategories: [...c.subCategories, text] }
          : c
      )
    );
    setNewSubCategory((s) => ({ ...s, [categoryName]: "" }));
  };

  const removeSubCategory = (categoryName, sub) => {
    persist(
      categories.map((c) =>
        c.name === categoryName ? { ...c, subCategories: c.subCategories.filter((s) => s !== sub) } : c
      )
    );
  };

  // Drag-and-drop reorder (HTML5 DnD, no library). State and DB are updated only
  // on DROP (mouse release), not on every dragover — so dragging is lag-free and
  // the item can move more than one position. `dragIndex` = source while dragging;
  // `toIndex` = the drop target computed once on release.
  const reorderCategories = (fromIndex, toIndex) => {
    if (fromIndex === toIndex) return;
    const next = [...categories];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    persist(next);
    setDragIndex(null);
  };

  const sortedSubs = (subs) => [...subs].sort((a, b) => a.localeCompare(b));

  const TABS = [
    { id: "preferences", label: "Preferences" },
    { id: "categories", label: "Categories" },
    { id: "templates", label: "Templates" },
  ];

  return (
    <div className="page">
      <NavBar />
      <h1>Profile</h1>

      <nav className="profile-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`profile-tab${activeTab === t.id ? " profile-tab--active" : ""}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {activeTab === "preferences" && (
        <div className="profile-section">
          <div className="category-manager__group">
            <div className="category-manager__group-header">
              <strong>Currency</strong>
            </div>
            <p className="page-hint">One fixed currency for all amounts across the app.</p>
            <select value={user?.currency || "INR"} onChange={handleCurrencyChange} disabled={savingCurrency}>
              {COMMON_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            {currencyError && <p className="form-error">{currencyError}</p>}
          </div>

          <div className="category-manager__group">
            <div className="category-manager__group-header">
              <strong>Colour theme</strong>
            </div>
            <p className="page-hint">Pick an accent colour and a light/dark mode — applies to every page.</p>
            <div className="theme-accent-row">
              {ACCENT_OPTIONS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={`theme-swatch${user?.themeAccent === a.id ? " theme-swatch--active" : ""}`}
                  onClick={() => handleAccentChange(a.id)}
                  disabled={savingTheme}
                  title={a.label}
                  aria-label={a.label}
                >
                  <span className="theme-swatch__dot" style={{ backgroundColor: a.color }} />
                  {a.label}
                </button>
              ))}
            </div>
            <div className="theme-mode-row">
              {MODE_OPTIONS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`theme-mode${user?.themeMode === m.id ? " theme-mode--active" : ""}`}
                  onClick={() => handleModeChange(m.id)}
                  disabled={savingTheme}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {themeError && <p className="form-error">{themeError}</p>}
          </div>
        </div>
      )}

      {activeTab === "categories" && (
        <div className="profile-section">
          <p className="page-hint">
            Manage the categories and sub-categories available when recording transactions. Removing a
            category here does not change any past transactions already using it.
          </p>
          {error && <p className="form-error">{error}</p>}

          <div className="category-manager">
            {categories.map((c, index) => (
              <div
                key={c.name}
                className={`category-manager__group${dragIndex === index ? " category-manager__group--dragging" : ""}`}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(e) => {
                  // Required so a valid drop target registers; no reorder here (too laggy).
                  e.preventDefault();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragIndex !== null && dragIndex !== index) reorderCategories(dragIndex, index);
                  else setDragIndex(null);
                }}
                onDragEnd={() => setDragIndex(null)}
              >
                <div className="category-manager__group-header">
                  <strong>⠿ {c.name}</strong>
                  <button type="button" className="button-danger" onClick={() => removeCategory(c.name)} disabled={saving}>
                    Remove
                  </button>
                </div>

                <ul className="category-manager__subs">
                  {sortedSubs(c.subCategories).map((s) => (
                    <li key={s}>
                      {s}
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => removeSubCategory(c.name, s)}
                        disabled={saving}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                  {c.subCategories.length === 0 && <li className="category-manager__empty">No sub-categories yet</li>}
                </ul>

                <div className="category-manager__add-sub">
                  <input
                    value={newSubCategory[c.name] || ""}
                    onChange={(e) => setNewSubCategory((s) => ({ ...s, [c.name]: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && addSubCategory(c.name)}
                    placeholder="New sub-category"
                  />
                  <button type="button" className="button-secondary" onClick={() => addSubCategory(c.name)} disabled={saving}>
                    Add
                  </button>
                </div>
              </div>
            ))}

            {categories.length === 0 && <p className="page-hint">No categories yet — add one below.</p>}

            <div className="category-manager__add-category">
              <input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCategory()}
                placeholder="New category name"
              />
              <button type="button" onClick={addCategory} disabled={saving}>
                + Add category
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === "templates" && (
        <div className="profile-section">
          <div className="category-manager__group">
            <div className="category-manager__group-header">
              <strong>Transaction templates</strong>
            </div>
            <p className="page-hint">
              Saved from the transaction form ("Save as template"). Start a new transaction from one via the
              "Start from a template" dropdown.
            </p>
            {templatesError && <p className="form-error">{templatesError}</p>}
            {templates.length === 0 ? (
              <p className="page-hint">No templates yet — open a new transaction and hit "Save as template".</p>
            ) : (
              <ul className="template-manage-list">
                {templates.map((t) => (
                  <li key={t._id}>
                    <span className="template-manage-list__name">{t.name}</span>
                    <span className="template-manage-list__details">
                      {t.type} · {t.category || "uncategorized"}
                      {t.subCategory ? ` / ${t.subCategory}` : ""}
                      {t.note ? ` — ${t.note}` : ""}
                    </span>
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => handleDeleteTemplate(t)}
                      disabled={templateDeleting === t._id}
                    >
                      {templateDeleting === t._id ? "…" : "Delete"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
