// Single source of truth for account types: their select-option labels and the
// order they're grouped/displayed in on the Accounts and Home pages.
export const ACCOUNT_TYPES = [
  { value: "savings", label: "Savings" },
  { value: "investment", label: "Investment" },
  { value: "credit", label: "Credit" },
  { value: "loan", label: "Loan" },
  { value: "iou", label: "IOU" },
];

// Groups a flat account list into { type, label, accounts }[] following the
// canonical order above, omitting types with no accounts.
export function groupAccountsByType(accounts) {
  return ACCOUNT_TYPES.map(({ value, label }) => ({
    type: value,
    label,
    accounts: accounts.filter((a) => a.type === value),
  })).filter((group) => group.accounts.length > 0);
}
