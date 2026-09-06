import { randomUUID } from "node:crypto";
import TransactionTemplate from "../models/TransactionTemplate.js";
import { loadOwnedAccountsMap } from "../lib/balanceEngine.js";

const TYPES = ["deposit", "expense", "transfer"];

// Templates mirror a transaction's shape (minus date). They never touch
// balances, so validation is a lighter version of the transaction rules —
// it guarantees the fields can be dropped into a "new transaction" form.
function validateTemplate(template) {
  if (!TYPES.includes(template.type)) return `type must be one of: ${TYPES.join(", ")}`;
  if (!template.name || typeof template.name !== "string" || !template.name.trim()) {
    return "name is required";
  }
  if (!template.primaryAccount) return "primaryAccount is required";
  if (typeof template.primaryAmount !== "number" || !Number.isInteger(template.primaryAmount) || template.primaryAmount <= 0) {
    return "primaryAmount must be a positive integer (smallest currency unit)";
  }
  if (template.type === "transfer") {
    if (!template.secondaryAccount) return "secondaryAccount is required for transfer templates";
    if (String(template.secondaryAccount) === String(template.primaryAccount)) {
      return "secondaryAccount must differ from primaryAccount";
    }
    if (typeof template.secondaryAmount !== "number" || !Number.isInteger(template.secondaryAmount) || template.secondaryAmount <= 0) {
      return "secondaryAmount must be a positive integer (smallest currency unit)";
    }
  }
  if (template.type === "expense" && template.secondaryAccount) {
    if (String(template.secondaryAccount) === String(template.primaryAccount)) {
      return "secondaryAccount must differ from primaryAccount";
    }
    if (
      typeof template.secondaryAmount !== "number" ||
      !Number.isInteger(template.secondaryAmount) ||
      template.secondaryAmount < 0
    ) {
      return "secondaryAmount (the split partner's share) must be a non-negative integer when splitting";
    }
  }
  if (typeof template.category !== "string") return "category must be a string";
  if (typeof template.subCategory !== "string") return "subCategory must be a string";
  if (template.note !== undefined && typeof template.note !== "string") return "note must be a string";
  return null;
}

export async function listTemplates(req, res) {
  const templates = await TransactionTemplate.find({ userId: req.userId }).sort({ createdAt: 1 }).lean();
  res.json(templates);
}

export async function createTemplate(req, res) {
  const {
    name,
    type,
    category = "",
    subCategory = "",
    primaryAccount,
    primaryAmount,
    secondaryAccount,
    secondaryAmount,
    note = "",
  } = req.body;
  const idempotencyKey = req.headers["idempotency-key"];

  const candidate = {
    name: name ? String(name).trim() : "",
    type,
    category,
    subCategory,
    primaryAccount,
    primaryAmount,
    secondaryAccount: type === "transfer" ? secondaryAccount : type === "expense" ? secondaryAccount || null : null,
    secondaryAmount:
      type === "transfer"
        ? secondaryAmount ?? primaryAmount
        : type === "expense" && secondaryAccount
        ? secondaryAmount ?? 0
        : null,
    note,
  };

  const validationError = validateTemplate(candidate);
  if (validationError) return res.status(400).json({ error: validationError });

  // Only allow templates that reference the user's own accounts (an archived
  // or foreign account id must not sneak into a saved template).
  const accountsMap = await loadOwnedAccountsMap(req.userId, [candidate.primaryAccount, candidate.secondaryAccount]);
  if (!accountsMap.get(String(candidate.primaryAccount))) {
    return res.status(400).json({ error: "primaryAccount is not owned by you" });
  }
  if (candidate.secondaryAccount && !accountsMap.get(String(candidate.secondaryAccount))) {
    return res.status(400).json({ error: "secondaryAccount is not owned by you" });
  }

  // Replayed/retried POST? Same Idempotency-Key pattern as transactions/accounts.
  if (idempotencyKey) {
    const existing = await TransactionTemplate.findOne({ userId: req.userId, idempotencyKey });
    if (existing) return res.status(200).json(existing);
  }

  try {
    const template = await TransactionTemplate.create({
      userId: req.userId,
      ...candidate,
      // A key is ALWAYS stored: header key if present, otherwise a server
      // generated one. Never a null - a sparse-unique index would index an
      // explicit null and collide with a later one.
      idempotencyKey: idempotencyKey || randomUUID(),
    });
    return res.status(201).json(template);
  } catch (err) {
    if (idempotencyKey && err && err.code === 11000) {
      const existing = await TransactionTemplate.findOne({ userId: req.userId, idempotencyKey });
      if (existing) return res.status(200).json(existing);
    }
    throw err;
  }
}

export async function deleteTemplate(req, res) {
  const template = await TransactionTemplate.findOneAndDelete({ _id: req.params.id, userId: req.userId });
  if (!template) return res.status(404).json({ error: "Template not found" });
  res.status(204).end();
}