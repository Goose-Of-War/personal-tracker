import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import NavBar from "../components/NavBar.jsx";

export default function Profile() {
  const { user, updateCategories } = useAuth();
  const categories = user?.categories ?? [];
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newSubCategory, setNewSubCategory] = useState({}); // { [categoryName]: draft text }
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

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

  return (
    <div className="page">
      <NavBar />
      <h1>Profile</h1>
      <p className="page-hint">
        Manage the categories and sub-categories available when recording transactions. Removing a
        category here does not change any past transactions already using it.
      </p>

      {error && <p className="form-error">{error}</p>}

      <div className="category-manager">
        {categories.map((c) => (
          <div key={c.name} className="category-manager__group">
            <div className="category-manager__group-header">
              <strong>{c.name}</strong>
              <button type="button" className="button-danger" onClick={() => removeCategory(c.name)} disabled={saving}>
                Remove
              </button>
            </div>

            <ul className="category-manager__subs">
              {c.subCategories.map((s) => (
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
            placeholder="New category name"
          />
          <button type="button" onClick={addCategory} disabled={saving}>
            + Add category
          </button>
        </div>
      </div>
    </div>
  );
}
