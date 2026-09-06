import mongoose from "mongoose";
import Transaction from "../models/Transaction.js";

// Same ?month=YYYY-MM convention as transaction.controller.js's listTransactions,
// except month is effectively required here (defaults to the current UTC month
// if omitted/invalid, since a dashboard always needs a timeframe to show).
function monthRange(monthParam) {
  let year, month;
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    [year, month] = monthParam.split("-").map(Number);
  } else {
    const now = new Date();
    year = now.getUTCFullYear();
    month = now.getUTCMonth() + 1;
  }
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  const label = `${year}-${String(month).padStart(2, "0")}`;
  return { start, end, label };
}

// One aggregation pass (via $facet) computing everything the dashboard needs
// for the month, instead of pulling every transaction to the browser and
// summing in JS - consistent with the .lean()/server-side-math approach
// already used elsewhere (§8).
export async function getDashboard(req, res) {
  const { start, end, label } = monthRange(req.query.month);
  const userId = new mongoose.Types.ObjectId(req.userId);

  const [result] = await Transaction.aggregate([
    { $match: { userId, date: { $gte: start, $lt: end } } },
    {
      $facet: {
        // Corrections are excluded from every facet: they're balance
        // adjustments, not spending/income, so they mustn't skew the summary,
        // category breakdowns, or daily-expense trend.
        totalsByType: [
          { $match: { category: { $ne: "Correction" } } },
          { $group: { _id: "$type", total: { $sum: "$primaryAmount" } } },
        ],
        expensesByCategory: [
          { $match: { type: "expense", category: { $ne: "Correction" } } },
          { $group: { _id: { $ifNull: ["$category", ""] }, total: { $sum: "$primaryAmount" } } },
          { $sort: { total: -1 } },
        ],
        depositsByCategory: [
          { $match: { type: "deposit", category: { $ne: "Correction" } } },
          { $group: { _id: { $ifNull: ["$category", ""] }, total: { $sum: "$primaryAmount" } } },
          { $sort: { total: -1 } },
        ],
        dailyExpenses: [
          { $match: { type: "expense", category: { $ne: "Correction" } } },
          { $group: { _id: { $dayOfMonth: { date: "$date", timezone: "UTC" } }, total: { $sum: "$primaryAmount" } } },
          { $sort: { _id: 1 } },
        ],
      },
    },
  ]);

  const totalsByType = Object.fromEntries((result?.totalsByType ?? []).map((t) => [t._id, t.total]));
  const totalExpenses = totalsByType.expense || 0;
  const totalDeposits = totalsByType.deposit || 0;
  const totalTransfers = totalsByType.transfer || 0;

  const mapCategory = (c) => ({ category: c._id || "Uncategorized", total: c.total });

  res.json({
    month: label,
    summary: {
      totalExpenses,
      totalDeposits,
      totalTransfers,
      net: totalDeposits - totalExpenses,
    },
    categoryBreakdown: {
      expenses: (result?.expensesByCategory ?? []).map(mapCategory),
      deposits: (result?.depositsByCategory ?? []).map(mapCategory),
    },
    dailyTrend: (result?.dailyExpenses ?? []).map((d) => ({ day: d._id, total: d.total })),
  });
}
