import { toDisplay } from "../lib/money.js";

export default function AccountCard({ account, onClick }) {
  const isCredit = account.type === "credit";
  return (
    <button className={`account-card account-card--${account.type}`} onClick={() => onClick?.(account)}>
      <div className="account-card__header">
        <span className="account-card__name">{account.name}</span>
        <span className="account-card__type">{account.type}</span>
      </div>
      <div className="account-card__balance">
        {toDisplay(account.balance)}
        {isCredit && account.limit != null && (
          <span className="account-card__limit"> / {toDisplay(account.limit)} limit</span>
        )}
      </div>
      {account.note && <div className="account-card__note">{account.note}</div>}
    </button>
  );
}
