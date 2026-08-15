// Backend stores amounts as integers in the smallest currency unit (paise/cents).
// These helpers convert to/from the decimal value shown in the UI.

export function toDisplay(smallestUnit) {
  return (smallestUnit / 100).toFixed(2);
}

export function toSmallestUnit(displayValue) {
  return Math.round(parseFloat(displayValue) * 100);
}

// IOU accounts are shown prefixed in pickers/dropdowns so they stand out from
// ordinary savings/credit accounts at a glance (display-only, not stored).
export function accountDisplayName(account) {
  return account.type === "iou" ? `[IOU] ${account.name}` : account.name;
}
