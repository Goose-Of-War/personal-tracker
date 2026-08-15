import Account from "../models/Account.js";

// Computes the balance delta for one account given the direction money flows
// relative to it, respecting credit/loan-vs-savings/investment/iou semantics:
//   - savings / investment / iou: balance is "money I have (or am owed)" ->
//     inflow (+), outflow (-)
//   - credit / loan: balance is "money I owe" -> inflow/payment (-),
//     outflow/spend-or-borrow (+)
// This is the ONLY place that should encode this sign logic.
function directedDelta(accountType, direction, amount) {
  if (accountType === "credit" || accountType === "loan") {
    return direction === "in" ? -amount : amount;
  }
  // savings, investment & iou all share the same sign logic
  return direction === "in" ? amount : -amount;
}

// Given a transaction-like object and a Map of accountId(string) -> Account doc,
// returns the list of { accountId, delta } balance changes it causes.
// Pure function - does not touch the database.
export function computeEffects(transaction, accountsMap) {
  const primary = accountsMap.get(String(transaction.primaryAccount));
  if (!primary) {
    throw Object.assign(new Error("Primary account not found"), { status: 400 });
  }

  switch (transaction.type) {
    case "deposit":
      return [
        { accountId: transaction.primaryAccount, delta: directedDelta(primary.type, "in", transaction.primaryAmount) },
      ];

    case "expense": {
      const effects = [
        { accountId: transaction.primaryAccount, delta: directedDelta(primary.type, "out", transaction.primaryAmount) },
      ];
      // Split expense (optional): secondaryAccount gets a deposit-direction effect for
      // secondaryAmount, representing the split partner's share becoming an amount
      // owed to you. Reuses the same directedDelta sign logic - no new branch needed.
      if (transaction.secondaryAccount) {
        const secondary = accountsMap.get(String(transaction.secondaryAccount));
        if (!secondary) {
          throw Object.assign(new Error("Secondary account not found"), { status: 400 });
        }
        effects.push({
          accountId: transaction.secondaryAccount,
          delta: directedDelta(secondary.type, "in", transaction.secondaryAmount),
        });
      }
      return effects;
    }

    case "transfer": {
      const secondary = accountsMap.get(String(transaction.secondaryAccount));
      if (!secondary) {
        throw Object.assign(new Error("Secondary account not found"), { status: 400 });
      }
      // Default: if secondaryAmount isn't given, the transfer is the full primaryAmount.
      const secondaryAmount = transaction.secondaryAmount ?? transaction.primaryAmount;
      return [
        { accountId: transaction.primaryAccount, delta: directedDelta(primary.type, "out", transaction.primaryAmount) },
        { accountId: transaction.secondaryAccount, delta: directedDelta(secondary.type, "in", secondaryAmount) },
      ];
    }

    default:
      throw Object.assign(new Error(`Unknown transaction type: ${transaction.type}`), { status: 400 });
  }
}

export function reverseEffects(effects) {
  return effects.map((e) => ({ accountId: e.accountId, delta: -e.delta }));
}

// Applies a list of { accountId, delta } via atomic $inc. If any update fails partway
// through, compensating writes roll back everything already applied in this call.
// This gives us safety without requiring a MongoDB replica set (needed for real
// multi-document transactions) - a reasonable default for a single-node dev/local
// MongoDB setup. Flagged in claude-records.log for revisiting if this ever needs
// to run against concurrent high-volume writes.
export async function applyEffects(effects) {
  const applied = [];
  try {
    for (const { accountId, delta } of effects) {
      if (!delta) continue;
      const updated = await Account.findByIdAndUpdate(accountId, { $inc: { balance: delta } }, { new: true });
      if (!updated) throw Object.assign(new Error("Account not found during balance update"), { status: 400 });
      applied.push({ accountId, delta });
    }
  } catch (err) {
    for (const { accountId, delta } of applied.reverse()) {
      await Account.findByIdAndUpdate(accountId, { $inc: { balance: -delta } }).catch(() => {});
    }
    throw err;
  }
}

// Loads accounts by id, scoped to the given user, and returns a Map keyed by
// string id. Throws if any requested id doesn't resolve to an owned account.
export async function loadOwnedAccountsMap(userId, ids) {
  const uniqueIds = [...new Set(ids.filter(Boolean).map(String))];
  if (uniqueIds.length === 0) return new Map();
  const accounts = await Account.find({ _id: { $in: uniqueIds }, userId });
  if (accounts.length !== uniqueIds.length) {
    throw Object.assign(new Error("One or more accounts not found"), { status: 400 });
  }
  return new Map(accounts.map((a) => [String(a._id), a]));
}
