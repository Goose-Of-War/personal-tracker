import { useState } from "react";
import NavBar from "../components/NavBar.jsx";

// Same localStorage key + entry shape used by client/src/api/client.js.
const ERROR_LOG_KEY = "diagnostics.errors";

function readErrorLog() {
  try {
    const raw = localStorage.getItem(ERROR_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function formatBody(body) {
  if (body == null) return "—";
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return String(body);
  }
}

export default function Diagnostics() {
  const [entries, setEntries] = useState(readErrorLog);

  const clearLog = () => {
    localStorage.removeItem(ERROR_LOG_KEY);
    setEntries([]);
  };

  return (
    <div className="page">
      <NavBar />
      <div className="page-header">
        <h1>Diagnostics</h1>
        {entries.length > 0 && (
          <button type="button" className="button-danger" onClick={clearLog}>
            Clear log
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="page-hint">
          No failed requests logged. Errors from optimistic mutations (after retries) land here
          automatically.
        </p>
      ) : (
        <table className="dashboard-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Method</th>
              <th>Path</th>
              <th>Status</th>
              <th>Error</th>
              <th>Body</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td>{new Date(e.at).toLocaleString()}</td>
                <td>{e.method}</td>
                <td>{e.path}</td>
                <td>{e.status ?? "—"}</td>
                <td>{e.error}</td>
                <td>
                  <pre className="diagnostics-body">{formatBody(e.body)}</pre>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}