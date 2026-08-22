import Transaction from "../models/Transaction.js";
import User from "../models/User.js";
import { computeEffects, reverseEffects, applyEffects, loadOwnedAccountsMap } from "../lib/balanceEngine.js";

const TYPES = ["deposit", "expense", "transfer"];

// Validates a fully-merged transaction candidate (all fields present, defaults
// already applied). Used for both create and update so the rules never drift
// between the two paths. `userCategories` is the requesting user's configured
// categories list (§1a of the spec) - pass null to skip category membership
// checks (not used in practice, but keeps this testable standalone).
function validateCandidate(tx, userCategories = null) {
  if (!TYPES.includes(tx.type)) return `type must be one of: ${TYPES.join(", ")}`;
  if (!tx.primaryAccount) return "primaryAccount is required";
  if (typeof tx.primaryAmount !== "number" || !Number.isInteger(tx.primaryAmount) || tx.primaryAmount <= 0) {
    return "primaryAmount must be a positive integer (smallest currency unit)";
  }
  if (tx.type === "transfer") {
    if (!tx.secondaryAccount) return "secondaryAccount is required for transfer transactions";
    if (String(tx.secondaryAccount) === String(tx.primaryAccount)) {
      return "secondaryAccount must differ from primaryAccount";
    }
    if (typeof tx.secondaryAmount !== "number" || !Number.isInteger(tx.secondaryAmount) || tx.secondaryAmount <= 0) {
      return "secondaryAmount must be a positive integer (smallest currency unit)";
    }
  }
  // Split expense: secondaryAccount/secondaryAmount are optional on `expense`. If a
  // secondaryAccount is given but no amount, the caller defaults secondaryAmount to 0
  // (see createTransaction/updateTransaction) - i.e. an unspecified split is a no-op,
  // not an error. Only reject an explicit negative/non-integer value here.
  if (tx.type === "expense" && tx.secondaryAccount) {
    if (String(tx.secondaryAccount) === String(tx.primaryAccount)) {
      return "secondaryAccount must differ from primaryAccount";
    }
    if (typeof tx.secondaryAmount !== "number" || !Number.isInteger(tx.secondaryAmount) || tx.secondaryAmount < 0) {
      return "secondaryAmount (the split partner's share) must be a non-negative integer when splitting an expense";
    }
  }
  if (!tx.date || isNaN(new Date(tx.date).getTime())) return "date is invalid";
  if (typeof tx.category !== "string") return "category must be a string";
  if (typeof tx.subCategory !== "string") return "subCategory must be a string";
  if (userCategories && tx.category) {
    const match = userCategories.find((c) => c.name === tx.category);
    if (!match) return `category must be one of your configured categories (see Profile)`;
    if (tx.subCategory && !match.subCategories.includes(tx.subCategory)) {
      return `subCategory must be one of the configured subcategories for "${tx.category}"`;
    }
  } else if (userCategories && !tx.category && tx.subCategory) {
    return "subCategory requires a category";
  }
  return null;
}

export async function listTransactions(req, res) {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));

  // Optional ?month=YYYY-MM filter, matched against `date` (not createdAt).
  const query = { userId: req.userId };
  if (req.query.month && /^\d{4}-\d{2}$/.test(req.query.month)) {
    const [year, month] = req.query.month.split("-").map(Number);
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));
    query.date = { $gte: start, $lt: end };
  }

  const [items, total] = await Promise.all([
    Transaction.find(query)
      .sort({ date: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Transaction.countDocuments(query),
  ]);

  res.json({ items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) });
}

export async function getTransaction(req, res) {
  const transaction = await Transaction.findOne({ _id: req.params.id, userId: req.userId });
  if (!transaction) return res.status(404).json({ error: "Transaction not found" });
  res.json(transaction);
}

export async function createTransaction(req, res) {
  const { type, date, category = "", subCategory = "", primaryAccount, primaryAmount, secondaryAccount, secondaryAmount, note = "" } = req.body;

  const candidate = {
    type,
    date: date ? new Date(date) : new Date(),
    category,
    subCategory,
    primaryAccount,
    primaryAmount,
    note,
    secondaryAccount:
      type === "transfer" ? secondaryAccount : type === "expense" ? secondaryAccount || null : null,
    secondaryAmount:
      type === "transfer"
        ? secondaryAmount ?? primaryAmount
        : type === "expense" && secondaryAccount
        ? secondaryAmount ?? 0
        : null,
  };

  const user = await User.findById(req.userId).select("categories");
  const validationError = validateCandidate(candidate, user.categories);
  if (validationError) return res.status(400).json({ error: validationError });

  const accountsMap = await loadOwnedAccountsMap(req.userId, [candidate.primaryAccount, candidate.secondaryAccount]);

  const transaction = await Transaction.create({ userId: req.userId, ...candidate });
  try {
    const effects = computeEffects(transaction, accountsMap);
    await applyEffects(effects);
  } catch (err) {
    // Roll back the transaction record itself if applying its balance effects failed,
    // so we never end up with a transaction that has no matching balance change.
    await Transaction.deleteOne({ _id: transaction._id });
    throw err;
  }

  res.status(201).json(transaction);
}

export async function updateTransaction(req, res) {
  const existing = await Transaction.findOne({ _id: req.params.id, userId: req.userId });
  if (!existing) return res.status(404).json({ error: "Transaction not found" });

  const body = req.body;
  const mergedType = body.type ?? existing.type;

  // Only carry the old secondaryAccount/Amount forward when the transaction was
  // already the same "shape" (transfer or split-expense) before this edit - e.g.
  // switching type away from transfer/split-expense must not drag stale fields along.
  const mergedSecondaryAccount =
    mergedType === "transfer"
      ? body.secondaryAccount ?? existing.secondaryAccount
      : mergedType === "expense"
      ? body.secondaryAccount !== undefined
        ? body.secondaryAccount || null
        : existing.type === "expense"
        ? existing.secondaryAccount
        : null
      : null;
  const mergedSecondaryAmount =
    mergedType === "transfer"
      ? body.secondaryAmount ?? (body.primaryAmount ?? existing.primaryAmount)
      : mergedType === "expense" && mergedSecondaryAccount
      ? body.secondaryAmount !== undefined
        ? body.secondaryAmount
        : existing.type === "expense" && existing.secondaryAmount != null
        ? existing.secondaryAmount
        : 0
      : null;

  const merged = {
    type: mergedType,
    date: body.date !== undefined ? new Date(body.date) : existing.date,
    category: body.category ?? existing.category,
    subCategory: body.subCategory ?? existing.subCategory,
    note: body.note ?? existing.note,
    primaryAccount: body.primaryAccount ?? existing.primaryAccount,
    primaryAmount: body.primaryAmount ?? existing.primaryAmount,
    secondaryAccount: mergedSecondaryAccount,
    secondaryAmount: mergedSecondaryAmount,
  };

  const user = await User.findById(req.userId).select("categories");
  const validationError = validateCandidate(merged, user.categories);
  if (validationError) return res.status(400).json({ error: validationError });

  // Need both the old and new accounts loaded, since either side might have changed.
  const idsNeeded = [existing.primaryAccount, existing.secondaryAccount, merged.primaryAccount, merged.secondaryAccount];
  const accountsMap = await loadOwnedAccountsMap(req.userId, idsNeeded);

  const oldEffects = computeEffects(existing, accountsMap);
  const reversal = reverseEffects(oldEffects);
  const newEffects = computeEffects(merged, accountsMap);

  // Reverse the old effect and apply the new one as a single sequence, so a failure
  // partway through rolls everything in this call back to the pre-update state.
  await applyEffects([...reversal, ...newEffects]);

  Object.assign(existing, merged);
  await existing.save();
  res.json(existing);
}

export async function deleteTransaction(req, res) {
  const existing = await Transaction.findOne({ _id: req.params.id, userId: req.userId });
  if (!existing) return res.status(404).json({ error: "Transaction not found" });

  const idsNeeded = [existing.primaryAccount, existing.secondaryAccount];
  const accountsMap = await loadOwnedAccountsMap(req.userId, idsNeeded);

  const reversal = reverseEffects(computeEffects(existing, accountsMap));
  await applyEffects(reversal);

  await Transaction.deleteOne({ _id: existing._id });
  res.status(204).end();
}
