import Account from "../models/Account.js";
import Transaction from "../models/Transaction.js";
import User from "../models/User.js";
import { correctionEffect, computeEffects, applyEffects } from "../lib/balanceEngine.js";

const TYPES = ["credit", "savings", "investment", "iou", "loan"];

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
  const accounts = await Account.find({ userId: req.userId, archived: false }).sort({ createdAt: 1 });
  res.json(accounts);
}

export async function createAccount(req, res) {
  const error = validateAccountInput(req.body);
  if (error) return res.status(400).json({ error });

  const { name, type, balance = 0, limit = null, note = "" } = req.body;
  const account = await Account.create({
    userId: req.userId,
    name: name.trim(),
    type,
    balance,
    limit: type === "credit" ? limit : null,
    note,
  });
  res.status(201).json(account);
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
  if (limit !== undefined) account.limit = (type ?? account.type) === "credit" ? limit : null;
  if (note !== undefined) account.note = note;

  await account.save();

  // Editing balance on an EXISTING account is recorded as a Correction transaction
  // (§3a) rather than a direct field write, so balanceEngine.js stays the only place
  // that ever changes a balance and the edit shows up as a normal, editable
  // transaction. Initial balance at account creation is unaffected (see createAccount).
  const delta = balance !== undefined ? balance - account.balance : 0;
  if (delta !== 0) {
    const user = await User.findById(req.userId).select("categories");
    if (!user.categories.some((c) => c.name === "Correction")) {
      user.categories.push({ name: "Correction", subCategories: [] });
      await user.save();
    }

    const { type: txType, amount } = correctionEffect(account.type, delta);
    const transaction = await Transaction.create({
      userId: req.userId,
      type: txType,
      date: new Date(),
      category: "Correction",
      subCategory: "",
      primaryAccount: account._id,
      primaryAmount: amount,
    });
    const effects = computeEffects(transaction, new Map([[String(account._id), account]]));
    await applyEffects(effects);
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
