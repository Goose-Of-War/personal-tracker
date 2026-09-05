const BASE = "/api";

const RETRY_ATTEMPTS = 5;
const RETRY_DELAY_MS = 300;
const ERROR_LOG_KEY = "diagnostics.errors";
const ERROR_LOG_CAP = 50;

function genKey() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function readErrorLog() {
  try {
    const raw = localStorage.getItem(ERROR_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Mutations only: record the failed request to the localStorage diagnostics log
// and tell the user, then the caller rolls back its optimistic update.
function recordError({ path, method, body, error, status }) {
  const entry = {
    id: genKey(),
    path,
    method,
    body: body || null,
    status: status ?? null,
    error: error?.message || String(error),
    at: new Date().toISOString(),
  };
  const log = readErrorLog();
  log.push(entry);
  localStorage.setItem(ERROR_LOG_KEY, JSON.stringify(log.slice(-ERROR_LOG_CAP)));
  window.alert(
    `A request failed after ${RETRY_ATTEMPTS} attempt(s): ${entry.method} ${entry.path}\n${entry.error}\n\nThe failure has been logged — see /diagnostics/errors.`
  );
  return entry;
}

// request() with retry, idempotency-keyed POSTs, and failure logging for MUTATIONS
// (non-GET). GETs keep the old behaviour: no retry, no log, no alert.
async function request(path, options = {}) {
  const method = options.method || "GET";
  const isMutation = method !== "GET";
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  // Idempotency key: one per logical create, reused across every retry, so a
  // retried POST can never double-write server-side.
  if (isMutation && method === "POST" && !headers["Idempotency-Key"]) {
    headers["Idempotency-Key"] = genKey();
  }
  const init = {
    credentials: "include",
    headers,
    method,
    ...(options.body ? { body: options.body } : {}),
  };

  let response = null;
  let lastError = null;

  if (isMutation) {
    for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
      try {
        response = await fetch(`${BASE}${path}`, init);
      } catch (err) {
        lastError = err;
        response = null;
      }
      // 5xx are transient - keep retrying. 4xx are not (they cannot succeed).
      if (response && response.status >= 500) {
        lastError = new Error(`Request failed (${response.status})`);
        response = null;
      }
      if (response) break;
      if (attempt < RETRY_ATTEMPTS) await sleep(RETRY_DELAY_MS * attempt);
    }
    if (!response) {
      const err = lastError instanceof Error ? lastError : new Error(lastError || "Request failed");
      recordError({ path, method, body: options.body, error: err, status: null });
      throw err;
    }
  } else {
    response = await fetch(`${BASE}${path}`, init);
  }

  if (response.status === 204) return null;
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const err = new Error(data?.error || `Request failed (${response.status})`);
    if (isMutation) {
      recordError({ path, method, body: options.body, error: err, status: response.status });
    }
    throw err;
  }
  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: "POST", body: JSON.stringify(body) }),
  patch: (path, body) => request(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: (path) => request(path, { method: "DELETE" }),
};