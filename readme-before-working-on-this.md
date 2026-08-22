# Expense Tracker — Build Reference

Purpose: single source of truth for building this app. Any agent (Claude or otherwise)
picking up this project should read this fully before writing code, and should update
it if a decision changes. Keep this current every session, not just on big decisions —
new pages, changed UX behavior (e.g. a redirect rule), and anything else a future
session would otherwise have to re-derive from the code.

## Tech Stack
- Node.js v20+
- Vite + React (frontend)
- Express (backend, REST API)
- MongoDB + Mongoose

## Core Concept
Personal expense tracker with three collections: Users, Accounts, Transactions.
Standard CRUD, session-cookie auth, three pages (Home, Accounts, Transactions).

---

## 1. Auth

### Schema: User
| Field | Type | Notes |
|---|---|---|
| _id | ObjectId | auto |
| name | String | required |
| username | String | required, unique, indexed |
| passwordHash | String | bcrypt hash, never store plaintext |
| categories | Array | `{ name: String, subCategories: [String] }[]` — restricts allowed transaction categories, see §1a |

### Signup
- Fields: name, username, password, confirmPassword
- Validate confirmPassword === password server-side (not just client-side)
- Hash password with bcrypt (cost factor ~10-12)
- Reject duplicate usernames with a clear error

### Login
- Fields: username, password only
- Compare via bcrypt.compare
- On success, create a session (see below) and set cookie
- On success, redirect to home page automatically

### Session / Cookie
- Store sessions server-side (e.g. `connect-mongo`) — not just signed cookies — so
  sessions survive server restarts and can be revoked.
- Cookie token format: `xxxxx-xxxx-xxxx-xx-xxxxx` (alphanumeric), generated with
  `crypto.randomBytes` / `crypto.randomUUID`-style secure randomness — **not** `Math.random`.
- Cookie flags: `httpOnly`, `secure`, `sameSite: 'strict'`.
- Expiry: 6 hours of **inactivity** (sliding window) — refresh/extend the session's
  expiry timestamp on every authenticated request, not just at login.
- Middleware: every protected route checks session validity before proceeding; expired
  or missing session → 401 → frontend redirects to login.

### Categories & Sub-Categories (§1a)
- Stored per-user on the User document: `categories: [{ name: String, subCategories: [String] }]`.
- These are the *only* category/subCategory values a transaction may reference —
  validated server-side on transaction create/update. Supersedes the original section
  3 note about free text for v1.
- New users get a default seed list on signup — **confirmed final**: Food, Transport,
  Bills & Utilities, Shopping, Health, Entertainment, Income, Correction, Other, each
  with a few starter subcategories. `Correction` (no subcategories) is required and
  used by automated balance-correction transactions, see §3a.
- Managed via the new Profile page (see section 4) — add/rename/remove categories and
  subcategories.
- **Deleting a category/subCategory still referenced by existing transactions**
  (confirmed): allowed, and cascades — any transaction currently using the deleted
  category clears its `category` field (and `subCategory` if that was the deleted
  part) back to `""`, rather than keeping orphaned text. Deleting a whole category
  clears both `category` and `subCategory` on affected transactions; deleting just a
  subcategory clears only `subCategory`, leaving `category` intact.

### Session persistence across app restarts
- Sessions are stored in a MongoDB collection (not in server process memory), keyed
  by a random token — this was already built to survive `server.js` restarts, as
  long as the MongoDB instance itself (`MONGO_URI`) keeps running and its data isn't
  wiped in the process. **Confirmed**: this matches the actual local setup (same
  Mongo instance stays up across app restarts), so no code change is needed here —
  the existing design already satisfies this.

---

## 2. Money Accounts

### Schema: Account
| Field | Type | Notes |
|---|---|---|
| _id | ObjectId | auto |
| userId | ObjectId | ref to User, indexed |
| name | String | required |
| type | String | enum: `credit`, `savings`, `investment`, `iou`, `loan` |
| balance | Integer | **store in smallest currency unit (paise/cents)**, not float. Only settable directly at account creation — editing an *existing* account's balance no longer writes this field directly, see §3a |
| limit | Integer | optional, only meaningful for `credit` and `loan` types. Automatically reset to `null` if `type` changes away from both in the same edit and the request doesn't explicitly set `limit` |
| note | String | optional |
| archived | Boolean | default false — soft-delete instead of hard delete |

### Balance semantics (write this down, don't wing it later)
- **Savings account**: deposit → balance increases. Expense → balance decreases.
- **Credit account**: expense → balance increases (debt owed). Deposit (payment) →
  balance decreases. Balance should not exceed `limit` (enforce or at least warn).
- **Investment account** (new): same sign logic as savings — deposit increases
  balance, expense decreases it. `limit` is not used for this type.
- **IOU account** (new): same sign logic as savings — deposit increases balance,
  expense decreases it. Represents money someone owes you (positive balance) or, if
  it goes negative, money you owe them. `limit` is not used for this type (same as
  savings).
- **Loan account** (new): same sign logic as credit — expense (borrowing more /
  interest accruing) increases balance, deposit (a repayment) decreases it. Represents
  a debt you owe (e.g. a car loan, student loan). **Confirmed**: `limit` applies to
  `loan`, same as `credit`. **Implemented** via a shared `LIMIT_TYPES` constant in
  `account.controller.js`.
- **Display convention for IOU (frontend only, no schema change)**: shown in account
  pickers/dropdowns as `[IOU] <name>` — e.g. `[IOU] Nathan Drake` — to stand out from
  ordinary savings/credit accounts at a glance. The `name` field itself just holds the
  person's name (`"Nathan Drake"`); the `[IOU]` prefix is added at render time, not
  stored.
- These are opposite directions for the same transaction type depending on account
  type — this is the #1 source of sign-flip bugs. Centralize this logic in **one**
  function (e.g. `applyTransactionEffect(account, type, amount)`), don't duplicate the
  if/else across routes.

### Concurrency
- Never do read-balance → mutate in JS → save(). Use atomic Mongo `$inc` updates.
- For `transfer` transactions (two accounts touched at once), wrap in a Mongo
  transaction (requires replica set) or otherwise ensure both updates succeed/fail
  together.

### Deletion
- Soft-delete only (`archived: true`). Archived accounts are hidden from the "add
  transaction" picker but still show historical transactions correctly.

---

## 3. Transactions

### Schema: Transaction
| Field | Type | Notes |
|---|---|---|
| _id | ObjectId | auto |
| userId | ObjectId | ref to User, indexed |
| type | String | enum: `deposit`, `expense`, `transfer` |
| date | Date | user-editable transaction date (can backdate) |
| createdAt | Date | auto, audit trail — separate from `date` |
| category | String | |
| subCategory | String | |
| primaryAccount | ObjectId | ref to Account, required |
| primaryAmount | Integer | amount affecting primary account |
| secondaryAccount | ObjectId | ref to Account; required for `transfer`; optional for `expense` when recording a split (see Rules) |
| secondaryAmount | Integer | optional. Transfer: defaults to `primaryAmount` if omitted. Split-expense: defaults to `0` if omitted (see Rules — this means an omitted amount effectively ignores the split, not "split unspecified") |
| note | String | optional, free text — same field/behavior as `Account.note` |

### Rules
- `deposit`: only `primaryAccount` + `primaryAmount` used. secondary fields null.
- `expense`: `primaryAccount` + `primaryAmount` required as before. `secondaryAccount`
  + `secondaryAmount` are now optionally allowed on this type too — used to record a
  **split expense** in one entry instead of two separate transactions (e.g. paying for
  dinner on a card where a friend owes part of it). When present: `primaryAccount`
  takes the full expense effect as normal; `secondaryAccount` (typically a `savings`
  or `iou` account) takes a **deposit-direction** effect for `secondaryAmount` — i.e.
  its balance increases, representing the split partner's share becoming an amount
  owed to you. Same `directedDelta` sign logic as any other deposit-direction effect
  for that account's type — no new branch needed in `balanceEngine.js`.
  **Confirmed default**: unlike `transfer`, there is no "assume the full amount"
  default here — if `secondaryAmount` is omitted (and a `secondaryAccount` was given),
  it defaults to `0`, which means `computeEffects` still produces a secondary effect
  entry but with a zero delta, and `applyEffects` already skips zero-delta writes (see
  `balanceEngine.js`) — net result: the split is silently a no-op, functionally
  identical to not having set a `secondaryAccount` at all. This is intentional: you
  must type the split partner's actual share to have it take effect. **Implemented**
  — `validateCandidate` now accepts `secondaryAmount = 0`, and both
  `createTransaction`/`updateTransaction` default an omitted amount to `0`.
- `transfer`: both accounts required. If `secondaryAmount` not given, assume it equals
  `primaryAmount` (per original spec — supports same-currency 1:1 transfers; leaves
  room for a future "converted amount" use case).
- **Editing or deleting a transaction must reverse the old balance effect before
  applying the new one.** Safest pattern: recompute affected account balance(s) from
  scratch rather than patching deltas, or store enough info to cleanly reverse.
- Category/subCategory: now validated server-side against the user's `categories`
  list (see §1a) instead of free text — supersedes the original v1-free-text plan.
- Index `{ userId, primaryAccount, date }` and `{ userId, date }` for fast queries.
- Paginate transaction list endpoint from day one (don't return full history in one call).
- Transaction list endpoint accepts an optional `month` filter (e.g. `?month=2026-08`,
  matched against `date`, not `createdAt`) so the frontend can request one month at a
  time instead of always paging through full history.

### Balance corrections (§3a)
- Editing an **existing** account's `balance` field (via the Accounts page edit
  overlay / account PATCH endpoint) does not write the field directly. Instead it's
  translated into an automatically-created transaction — category `Correction`,
  dated now — that goes through the normal `computeEffects`/`applyEffects` pipeline
  like any other transaction. This keeps `balanceEngine.js` the single place that
  ever changes a balance, and means correction transactions show up in the
  Transactions list and can be edited/deleted exactly like any other transaction
  (reverse-then-reapply works correctly since it's a first-class transaction, not a
  special case).
- This does NOT apply to the initial `balance` set when *creating* a new account —
  that's still just the account's starting point, not a correction, and is written
  directly with no transaction generated.
- Mapping the requested balance change to a `deposit`/`expense` + amount uses the
  same sign logic as everything else — computed once (e.g. a small
  `correctionEffect(accountType, delta)` helper in `balanceEngine.js`, not
  duplicated in the account controller):
  - `delta = newBalance - oldBalance`. If `delta === 0`, no transaction is created.
  - For `savings`/`investment`/`iou`: `delta > 0` → `deposit` of `delta`;
    `delta < 0` → `expense` of `-delta`.
  - For `credit`/`loan`: `delta > 0` → `expense` of `delta`; `delta < 0` → `deposit`
    of `-delta`.
  (These are exactly the inverse of `directedDelta`'s existing sign logic per
  account type — reuse it rather than re-deriving it.)
- `Correction` is one of the categories seeded into every new user's `categories`
  list (§1a) — see below. If an existing user's list doesn't have it yet (accounts
  created before this feature existed), it's added automatically the first time a
  correction transaction is generated for them, so the category-membership
  validation in §3's Rules never rejects it.

---

## 4. Pages / Frontend

1. **Login / Signup page**
   - Toggle between login and signup forms.
   - On successful auth → redirect to Home.
   - If a valid session cookie already exists (i.e. `/auth/me` resolves to a
     user), redirect straight to Home instead of showing the form — no
     reason to make an already-logged-in visitor log in again.
   - Links to the Legal page (Privacy Policy & Terms of Use), framed as
     "using this app means you agree to it."

2. **Home page**
   - Summary section shows separate category totals rather than one combined net
     worth figure (a large loan balance made a single net figure swing painfully
     negative): **Amount in savings**, **Amount in investments**, **Credit due**,
     **Loan due**, and **Owed to you** (sum of IOU balances — can itself be negative
     if you owe more than you're owed across IOU accounts, following the existing
     per-account IOU sign convention). Each is a simple sum of that type's account
     balances, no cross-type netting.
   - Below the summary, full account list grouped by type (Savings, Investment,
     Credit, Loan, IOU) — each type its own section, not one flat mixed list (per
     the existing account-grouping requirement below).

3. **Accounts page**
   - List all accounts (including edit affordance per row), grouped by type (Savings,
     Investment, Credit, Loan, IOU) — each type displayed as its own labeled section,
     not mixed/unsorted together.
   - Click an account → overlay/modal to edit name, note, balance, limit. Editing
     `balance` generates an automatic `Correction` transaction instead of writing
     the field directly — see §3a.
   - Archive (soft-delete) action instead of hard delete.

4. **Transactions page**
   - List of transactions (paginated), filterable by month (defaults to the current
     month; a control lets you step to a different month) — see §3's `month` filter.
   - Within the current view, transactions are grouped under a heading per date (day)
     they occurred on, rather than one flat list mixing all dates together.
   - Add new transaction (modal/form): type, date, category, sub-category, primary
     account + amount, secondary account + amount (conditional on `transfer`, or on an
     optional "split" toggle when type is `expense`), and an optional note (free text,
     same as accounts).
   - Category/subCategory selects are populated from the user's `categories` list
     (§1a), not free text.
   - Edit existing transaction — must correctly reverse/reapply balance effects.
   - Balances update promptly after add/edit/delete (via API response or refetch).

5. **Profile page** (new)
   - Manage the user's `categories` list: add/rename/remove categories and their
     subcategories.
   - Exact route/endpoint for updating categories not yet fixed (e.g. `PATCH
     /api/auth/categories` or a small standalone user-routes file) — implementer's
     choice, doesn't change the data shape.
   - The "new category" and "new sub-category" inputs submit on Enter, not just
     via their Add buttons.

6. **Legal page** (new)
   - Static Privacy Policy & Terms of Use content. Public route, reachable
     without logging in. Linked from the Login/Signup page and from the
     navbar for logged-in users.

---

## 5. Project Scaffolding

Monorepo-style, two top-level folders, no shared package manager workspace needed for v1.

```
expense-tracker/
├── server/
│   ├── src/
│   │   ├── models/
│   │   │   ├── User.js
│   │   │   ├── Account.js
│   │   │   └── Transaction.js
│   │   ├── routes/
│   │   │   ├── auth.routes.js
│   │   │   ├── account.routes.js
│   │   │   └── transaction.routes.js
│   │   ├── controllers/
│   │   │   ├── auth.controller.js
│   │   │   ├── account.controller.js
│   │   │   └── transaction.controller.js
│   │   ├── middleware/
│   │   │   ├── requireAuth.js       # session check + sliding expiry refresh
│   │   │   └── errorHandler.js
│   │   ├── lib/
│   │   │   ├── balanceEngine.js     # single source of truth for balance math
│   │   │   └── session.js           # token generation, session CRUD
│   │   ├── config/
│   │   │   └── db.js
│   │   ├── app.js                   # express app, middleware wiring
│   │   └── server.js                # entrypoint, listens on PORT
│   ├── .env.example
│   └── package.json
├── client/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── LoginSignup.jsx
│   │   │   ├── Home.jsx
│   │   │   ├── Accounts.jsx
│   │   │   ├── Transactions.jsx
│   │   │   └── Profile.jsx
│   │   ├── components/
│   │   │   ├── AccountCard.jsx
│   │   │   ├── AccountEditOverlay.jsx
│   │   │   ├── TransactionList.jsx
│   │   │   ├── TransactionForm.jsx
│   │   │   └── ProtectedRoute.jsx
│   │   ├── api/
│   │   │   └── client.js            # fetch wrapper, base URL, credentials: 'include'
│   │   ├── context/
│   │   │   └── AuthContext.jsx      # current user/session state
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── vite.config.js
│   └── package.json
└── readme-before-working-on-this.md
```

### Notes on scaffolding decisions
- **Separate `client/` and `server/`** rather than a single Express app serving React —
  cleaner dev experience with Vite's dev server + proxy; deploy separately or serve
  `client/dist` as static files from Express in production.
- **`balanceEngine.js`** is the one place that knows credit-vs-savings sign logic and
  transfer logic — controllers call into it, never duplicate the math.
- **`requireAuth.js`** middleware both validates the session cookie and refreshes its
  expiry (sliding 6-hour window) — applied to all account/transaction routes.
- Vite dev server proxies `/api/*` to the Express server (configure in `vite.config.js`)
  to avoid CORS friction during development.
- `.env.example` in `server/` should list: `MONGO_URI`, `SESSION_SECRET`, `PORT`,
  `CLIENT_ORIGIN`, `COOKIE_SECURE` (false in dev, true in prod).

## 6. Cross-cutting concerns
- Server-side validation on every endpoint (e.g. zod or express-validator) — never
  trust client-side checks alone (e.g. confirmPassword match).
- All monetary values: integers in smallest currency unit throughout backend + DB;
  convert to display format only in the frontend.
- Centralize balance-mutation logic in one module, reused by create/edit/delete
  transaction handlers — do not reimplement the credit-vs-savings sign logic in
  multiple places.
- Environment variables for: Mongo URI, session secret, cookie settings, port.
- Basic error handling middleware in Express; consistent JSON error shape.
- Overlay/modal forms (account edit, transaction add/edit): capped to a max height with
  internal scrolling (`overflow-y: auto`) rather than growing past the viewport — applies
  to `.overlay-card` generally, so it covers both existing overlays and any added later.

## 7. Deployment (Vercel) — IMPLEMENTED (not yet deployed/tested live)

**Architecture (confirmed):** single Vercel project — client and API served
from the same domain, so there's no cross-origin cookie/CORS complication to
deal with.

### Structural changes needed
- New root-level `api/index.js` — thin wrapper exporting the existing
  `server/src/app.js` Express app as a Vercel serverless function.
  `server/src/server.js` (the `app.listen()` entrypoint) is untouched and
  stays local-dev-only.
- `server/src/config/db.js` — needs a serverless-safe Mongoose connection
  cache (reuse the connection across warm invocations instead of
  reconnecting on every request; a cold start still connects once). No
  schema/model changes.
- New root-level `vercel.json`:
  - Builds `client/` as a static site (`vite build`, output `client/dist`).
  - Routes `/api/*` to the `api/index.js` serverless function.
  - Rewrites all other non-asset routes to `client/dist/index.html` (SPA
    fallback so React Router's client-side routes work on refresh/direct
    link).
- `client/src/api/client.js` — no change expected: it already calls relative
  `/api/...` paths (used via Vite's dev proxy locally); same-origin
  production deployment means those keep working unmodified.

### Environment / infra
- MongoDB must move to Atlas (or another reachable cloud cluster) — Vercel
  serverless functions can't reach a local/localhost MongoDB. `MONGO_URI` in
  Vercel's project env vars will point at the Atlas connection string.
- `COOKIE_SECURE=true` in the Vercel environment (was `false` for local dev)
  — required for `secure` cookies over HTTPS.
- `sameSite: 'strict'` (existing setting) stays as-is, since client + API
  share a domain in production too.
- `SESSION_SECRET` and `MONGO_URI` set as Vercel project environment
  variables (never committed).
- `CLIENT_ORIGIN` / CORS: same-origin in production means CORS is a
  non-issue there; the existing CORS middleware is kept only for local dev
  (client on :5173, server on :4000).
- `PORT` becomes irrelevant in production — Vercel functions don't use
  `app.listen()`.

### One addition beyond the original plan
- New root-level `package.json` (`"type": "module"`, `engines.node: "20.x"`),
  listing the same runtime dependencies as `server/package.json`
  (express, cors, cookie-parser, mongoose, bcrypt, dotenv). Vercel's function
  bundler resolves `api/index.js`'s imports from a root `node_modules`, which
  only exists if there's a root `package.json` — `server/`'s own
  `package.json`/`node_modules` aren't visible to it. This is Vercel-only
  plumbing; local dev still runs off `client/`'s and `server/`'s own
  package.json/scripts, unchanged. **Keep this in sync manually** if
  `server/package.json`'s dependencies change — nothing enforces that
  automatically.

### Not yet decided (flag before implementing)
- Which Atlas tier/region — your call, not guessing this.
- Keeping the existing Mongo-backed Session model/TTL index as the session
  store — **planned to leave unchanged**, since it's already DB-backed (not
  in-process memory) and should be serverless-safe as-is; flagging in case
  you'd rather swap it for something else before deploying.

---

## 8. Performance / Caching

Added after "site slow on load, especially data fetch" was reported.

- **Shared accounts cache (client)** — `client/src/context/AccountsContext.jsx`.
  Home, Accounts, and Transactions all need the same accounts list; before this
  each page independently re-fetched `GET /api/accounts` on every mount, so
  navigating Home → Transactions → Accounts → Home did 4 redundant round
  trips for data that hadn't changed. Now fetched once per login and shared;
  any mutation that changes account balances (account create/edit/archive,
  and transaction create/edit/delete, since transactions mutate balances via
  `balanceEngine`) calls the context's `refresh()` to keep it correct. The
  paginated/filtered transactions list itself is intentionally NOT cached
  this way — it's page/month-scoped, low reuse across navigation, not worth
  the complexity yet.
- **`.lean()` on read-only list queries** (`account.controller.js`
  `listAccounts`, `transaction.controller.js` `listTransactions`) — skips
  Mongoose document hydration on data that's only ever `res.json()`'d, never
  mutated after fetching. Minor, safe, no behavior change.

### Suspected bigger factor — not fixed here, needs your input
The above reduces redundant requests and per-request overhead, but the
likely dominant cause of "slow, especially data fetch" is infrastructure,
not app code: Vercel serverless cold starts plus MongoDB Atlas round-trip
latency, which gets worse if the Atlas cluster's region is far from
wherever Vercel is running the function. Worth checking:
- Which AWS/GCP region the Atlas cluster is in vs. Vercel's function region
  (Vercel project settings → Functions → Region) — mismatched regions can
  add real latency on every cold request.
- Atlas M0 (free tier) is also just slower than paid tiers; if this remains
  slow after region-matching, that's the next thing to look at.
Not changed here since it's an infra/account setting, not something to
guess at from code.

## Open decisions / flagged for later (not blocking v1)
- Whether credit balance should hard-cap at `limit` or just warn.
- Any multi-currency support (currently assumes single currency, 1:1 transfers).

## Implemented (previously pending, now done)
All three items confirmed in chat have been implemented:
1. **Split-expense `secondaryAmount` default** — `validateCandidate` now accepts
   `secondaryAmount = 0` for split-expense (was: required positive integer); both
   `createTransaction` and `updateTransaction` default an omitted amount to `0`.
2. **`loan` accounts support `limit`** — `account.controller.js` now uses a shared
   `LIMIT_TYPES = ["credit", "loan"]` constant everywhere the credit-only check used
   to be hardcoded.
3. **Category/subCategory deletion cascade** — `updateCategories` now diffs the old
   vs. new category list and clears `category`/`subCategory` (via
   `Transaction.updateMany`) on any transaction referencing a removed category or
   subcategory.
Not yet run against a live MongoDB (see claude-records.log) — syntax-checked only.

## Explicitly out of scope for v1
- Password reset / email verification.
- Multi-user shared accounts.
- Recurring transactions / budgets / reports (can layer on top of this schema later).
