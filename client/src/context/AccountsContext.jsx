import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { api } from "../api/client.js";
import { useAuth } from "./AuthContext.jsx";

const AccountsContext = createContext(null);

// Accounts don't change often (a handful of edits per session at most) but
// were being re-fetched from scratch on every visit to Home, Accounts, and
// Transactions. This caches the list for the lifetime of the logged-in
// session: fetched once, reused across pages, and only re-fetched when a
// mutation (create/edit/archive) explicitly calls refresh().
export function AccountsProvider({ children }) {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const fetchedForUser = useRef(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get("/accounts");
      setAccounts(data);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      // Logged out - drop the cache so a future login doesn't flash the
      // previous user's accounts before the fresh fetch lands.
      setAccounts([]);
      fetchedForUser.current = null;
      setLoading(true);
      return;
    }
    if (fetchedForUser.current !== user._id) {
      fetchedForUser.current = user._id;
      refresh();
    }
  }, [user, refresh]);

  return (
    <AccountsContext.Provider value={{ accounts, loading, error, refresh }}>
      {children}
    </AccountsContext.Provider>
  );
}

export function useAccounts() {
  const ctx = useContext(AccountsContext);
  if (!ctx) throw new Error("useAccounts must be used within AccountsProvider");
  return ctx;
}
