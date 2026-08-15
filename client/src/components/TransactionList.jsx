import { toDisplay, accountDisplayName } from "../lib/money.js";

function accountName(accountsById, id) {
  const account = accountsById.get(id);
  return account ? accountDisplayName(account) : "Unknown account";
}

// Groups an already date-sorted transaction list under a heading per day.
function groupByDate(transactions) {
  const groups = [];
  let current = null;
  for (const t of transactions) {
    const key = new Date(t.date).toDateString();
    if (!current || current.key !== key) {
      current = { key, label: new Date(t.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }), items: [] };
      groups.push(current);
    }
    current.items.push(t);
  }
  return groups;
}

export default function TransactionList({ transactions, accountsById, onSelect }) {
  if (transactions.length === 0) {
    return <p>No transactions yet. Add one to get started.</p>;
  }

  return (
    <>
      {groupByDate(transactions).map((group) => (
        <div key={group.key} className="transaction-date-group">
          <h3 className="transaction-date-group__heading">{group.label}</h3>
          <ul className="transaction-list">
            {group.items.map((t) => (
              <li key={t._id} className={`transaction-row transaction-row--${t.type}`} onClick={() => onSelect(t)}>
                <div className="transaction-row__main">
                  <span className="transaction-row__category">{t.category || t.type}</span>
                  {t.subCategory && <span className="transaction-row__subcategory">{t.subCategory}</span>}
                  <span className="transaction-row__accounts">
                    {t.type === "transfer"
                      ? `${accountName(accountsById, t.primaryAccount)} → ${accountName(accountsById, t.secondaryAccount)}`
                      : t.type === "expense" && t.secondaryAccount
                      ? `${accountName(accountsById, t.primaryAccount)} (split w/ ${accountName(accountsById, t.secondaryAccount)})`
                      : accountName(accountsById, t.primaryAccount)}
                  </span>
                  {t.note && <span className="transaction-row__note">{t.note}</span>}
                </div>
                <div className="transaction-row__side">
                  <span className="transaction-row__amount">{toDisplay(t.primaryAmount)}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}
