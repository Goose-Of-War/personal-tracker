// Backend stores amounts as integers in the smallest currency unit (paise/cents).
// These helpers convert to/from the decimal value shown in the UI.

export function toDisplay(smallestUnit) {
  return (smallestUnit / 100).toFixed(2);
}

export function toSmallestUnit(displayValue) {
  return Math.round(parseFloat(displayValue) * 100);
}

const CURRENCY_SYMBOLS = { INR: "₹", USD: "$", EUR: "€", GBP: "£" };

// Display-only (adds the currency symbol) - do NOT use this to seed editable
// amount inputs, those need the plain toDisplay() value. Falls back to
// "<code> " for a currency without a known symbol (e.g. "AUD 12.34").
export function formatMoney(smallestUnit, currency = "INR") {
  const symbol = CURRENCY_SYMBOLS[currency] || `${currency} `;
  return `${symbol}${toDisplay(smallestUnit)}`;
}

// IOU accounts are shown prefixed in pickers/dropdowns so they stand out from
// ordinary savings/credit accounts at a glance (display-only, not stored).
export function accountDisplayName(account) {
  return account.type === "iou" ? `[IOU] ${account.name}` : account.name;
}
