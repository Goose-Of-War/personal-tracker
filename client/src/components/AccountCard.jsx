import { formatMoney } from "../lib/money.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function AccountCard({ account, onClick }) {
  const { user } = useAuth();
  const currency = user?.currency || "INR";
  const isCredit = account.type === "credit";
  return (
    <button className={`account-card account-card--${account.type}`} onClick={() => onClick?.(account)}>
      <div className="account-card__header">
        <span className="account-card__name">{account.name}</span>
        <span className="account-card__type">{account.type}</span>
      </div>
      <div className="account-card__balance">
        {formatMoney(account.balance, currency)}
        {isCredit && account.limit != null && (
          <span className="account-card__limit"> / {formatMoney(account.limit, currency)} limit</span>
        )}
      </div>
      {account.note && <div className="account-card__note">{account.note}</div>}
    </button>
  );
}
