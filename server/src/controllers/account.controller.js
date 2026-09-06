import Account from "../models/Account.js";
import Transaction from "../models/Transaction.js";
import User from "../models/User.js";
import { correctionEffect, computeEffects, applyEffects, assertWithinCreditLimits } from "../lib/balanceEngine.js";

const TYPES = ["credit", "savings", "investment", "iou", "loan"];
// `limit` is only meaningful for these two account types (§2 of the spec).
const LIMIT_TYPES = ["credit", "loan"];

function validateAccountInput(body, { partial = false } = {}) {
  const { name, type, balance, limit, note } = body;

  if (!partial || name !== undefined) {
    if (!name || typeof name !== "string" || !name.trim()) {
      return "name is required";
    }
  }
  if (!partial || type !== undefined) {
    if (!TYPES.includes(type)) {
      return `type must be one of: ${TYPES.join(", ")}`;
    }
  }
  if (balance !== undefined && (typeof balance !== "number" || !Number.isInteger(balance))) {
    return "balance must be an integer (smallest currency unit)";
  }
  if (limit !== undefined && limit !== null && (typeof limit !== "number" || !Number.isInteger(limit))) {
    return "limit must be an integer or null";
  }
  if (note !== undefined && typeof note !== "string") {
    return "note must be a string";
  }
  return null;
}

export async function listAccounts(req, res) {
  const accounts = await Account.find({ userId: req.userId, archived: false })
    .sort({ createdAt: 1 })
    .lean();
  res.json(accounts);
}

export async function createAccount(req, res) {
  const error = validateAccountInput(req.body);
  if (error) return res.status(400).json({ error });

  const { name, type, balance = 0, limit = null, note = "" } = req.body;
  const idempotencyKey = req.headers["idempotency-key"];

  // Replayed/retried POST? The client reuses its Idempotency-Key across retries,
  // so a network hiccup after a successful create must not create a duplicate.
  if (idempotencyKey) {
    const existing = await Account.findOne({ userId: req.userId, idempotencyKey });
    if (existing) return res.status(200).json(existing);
  }

  try {
    const account = await Account.create({
      userId: req.userId,
      name: name.trim(),
      type,
      balance,
      limit: LIMIT_TYPES.includes(type) ? limit : null,
      note,
      ...(idempotencyKey ? { idempotencyKey } : {}),
    });
    // Keyless creates must NOT persist an explicit null so the unique
    // idempotency index never collides on later keyless documents.
    if (!idempotencyKey) {
      await Account.updateOne({ _id: account._id }, { $unset: { idempotencyKey: 1 } });
    }
    return res.status(201).json(account);
  } catch (err) {
    // Unlikely concurrent duplicate on the same key: treat as an idempotent success.
    if (idempotencyKey && err && err.code === 11000) {
      const existing = await Account.findOne({ userId: req.userId, idempotencyKey });
      if (existing) return res.status(200).json(existing);
    }
    throw err;
  }
}

export async function getAccount(req, res) {
  const account = await Account.findOne({ _id: req.params.id, userId: req.userId, archived: false });
  if (!account) return res.status(404).json({ error: "Account not found" });
  res.json(account);
}

export async function updateAccount(req, res) {
  const error = validateAccountInput(req.body, { partial: true });
  if (error) return res.status(400).json({ error });

  const account = await Account.findOne({ _id: req.params.id, userId: req.userId, archived: false });
  if (!account) return res.status(404).json({ error: "Account not found" });

  const { name, type, balance, limit, note } = req.body;
  if (name !== undefined) account.name = name.trim();
  if (type !== undefined) account.type = type;
  // Keep `limit` consistent with the account's current type even when this
  // PATCH doesn't explicitly touch `limit` itself - e.g. switching a credit/loan
  // account to savings must clear a leftover limit, and vice versa a request
  // can still explicitly set one for a newly credit/loan account.
  if (limit !== undefined) {
    account.limit = LIMIT_TYPES.includes(account.type) ? limit : null;
  } else if (type !== undefined && !LIMIT_TYPES.includes(account.type)) {
    account.limit = null;
  }
  if (note !== undefined) account.note = note;

  await account.save();

  // Editing balance on an EXISTING account: by default this is recorded as a Correction
  // transaction (§3a) so balanceEngine.js stays the only place that ever changes a balance
  // and the edit shows up as a normal, editable transaction. When `logCorrection` is
  // explicitly false, the balance is written directly (the "legacy" way, no transaction).
  // Initial balance at account creation is unaffected (see createAccount).
  const delta = balance !== undefined ? balance - account.balance : 0;
  const logCorrection = req.body.logCorrection; // true/undefined => Correction transaction; false => legacy direct write
  if (delta !== 0 && logCorrection !== false) {
    // Balance corrections are logged under the mandatory `Correction` category's
    // `Discrepancy` subcategory. Seed the subcategory if it's missing so the
    // transaction always has a valid (category, subCategory) pair.
    const user = await User.findById(req.userId).select("categories");
    const correction = user.categories.find((c) => c.name === "Correction");
    if (!correction) {
      user.categories.push({ name: "Correction", subCategories: ["Discrepancy"] });
      await user.save();
    } else if (!correction.subCategories.includes("Discrepancy")) {
      correction.subCategories.push("Discrepancy");
      user.markModified("categories");
      await user.save();
    }

    const { type: txType, amount } = correctionEffect(account.type, delta);
    const transaction = await Transaction.create({
      userId: req.userId,
      type: txType,
      date: new Date(),
      category: "Correction",
      subCategory: "Discrepancy",
      primaryAccount: account._id,
      primaryAmount: amount,
    });
    // This create is keyless SERVER-generated: drop the persisted null so the
    // unique idempotency index can't collide with the NEXT correction (sparse
    // indexes a stored null; only an absent field is skipped).
    await Transaction.updateOne({ _id: transaction._id }, { $unset: { idempotencyKey: 1 } });
    try {
      const accountsMap = new Map([[String(account._id), account]]);
      const effects = computeEffects(transaction, accountsMap);
      assertWithinCreditLimits(effects, accountsMap);
      await applyEffects(effects);
    } catch (err) {
      await Transaction.deleteOne({ _id: transaction._id });
      throw err;
    }
  } else if (delta !== 0 && logCorrection === false) {
    // Legacy direct-write correction (checkbox unchecked): no transaction is
    // generated, the balance is just set on the account directly.
    account.balance = balance;
    await account.save();
  }

  const fresh = await Account.findById(account._id);
  res.json(fresh);
}

// Soft-delete only, per spec: archived accounts are hidden but transaction history
// referencing them remains intact.
export async function archiveAccount(req, res) {
  const account = await Account.findOne({ _id: req.params.id, userId: req.userId, archived: false });
  if (!account) return res.status(404).json({ error: "Account not found" });

  account.archived = true;
  await account.save();
  res.status(204).end();
}
