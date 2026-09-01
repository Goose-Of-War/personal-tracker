import mongoose from "mongoose";
import Transaction from "../models/Transaction.js";

// Date ranges for the current and previous UTC months, relative to "now".
function monthRanges() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1; // 1-12

  const curStart = new Date(Date.UTC(year, month - 1, 1));
  const curEnd = new Date(Date.UTC(year, month, 1));

  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevStart = new Date(Date.UTC(prevYear, prevMonth - 1, 1));
  const prevEnd = new Date(Date.UTC(prevYear, prevMonth, 1));

  return { current: { start: curStart, end: curEnd }, previous: { start: prevStart, end: prevEnd } };
}

// Number of distinct calendar days (UTC) in [start, end) that have at least one
// transaction — of ANY type (expense, income/deposit, transfer…). Averaging over
// "days with activity" rather than calendar days is the user's chosen definition.
async function daysWithTransactions(userId, start, end) {
  const rows = await Transaction.aggregate([
    { $match: { userId, date: { $gte: start, $lt: end } } },
    { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } } } },
    { $count: "days" },
  ]);
  return rows.length > 0 ? rows[0].days : 0;
}

// Sum expenses by category for one month range, ordered by total desc.
async function expenseByCategory(userId, start, end) {
  const rows = await Transaction.aggregate([
    { $match: { userId, type: "expense", date: { $gte: start, $lt: end } } },
    {
      $group: {
        _id: { $ifNull: ["$category", ""] },
        total: { $sum: "$primaryAmount" },
      },
    },
    { $sort: { total: -1 } },
  ]);
  return rows.map((r) => ({ category: r._id || "Uncategorized", total: r.total }));
}

// Keep the top `n` categories, lump the rest into a single "Other" bucket.
function topCategoriesWithOther(breakdown, n) {
  const top = breakdown.slice(0, n);
  const rest = breakdown.slice(n);
  const othersTotal = rest.reduce((sum, r) => sum + r.total, 0);
  if (othersTotal > 0) {
    top.push({ category: "Other", total: othersTotal });
  }
  return top;
}

export async function getHomeStats(req, res) {
  const userId = new mongoose.Types.ObjectId(req.userId);
  const { current, previous } = monthRanges();

  const [curBreakdown, prevBreakdown, curDays, prevDays] = await Promise.all([
    expenseByCategory(userId, current.start, current.end),
    expenseByCategory(userId, previous.start, previous.end),
    daysWithTransactions(userId, current.start, current.end),
    daysWithTransactions(userId, previous.start, previous.end),
  ]);

  const curTotal = curBreakdown.reduce((s, r) => s + r.total, 0);
  const prevTotal = prevBreakdown.reduce((s, r) => s + r.total, 0);

  const curDailyAvg = curDays > 0 ? curTotal / curDays : 0;
  const prevDailyAvg = prevDays > 0 ? prevTotal / prevDays : 0;

  let dailyAvgDelta = null;
  if (prevTotal > 0 && prevDailyAvg > 0) {
    dailyAvgDelta = ((curDailyAvg - prevDailyAvg) / prevDailyAvg) * 100;
  }

  res.json({
    month: `${current.start.getUTCFullYear()}-${String(current.start.getUTCMonth() + 1).padStart(2, "0")}`,
    previousMonth: `${previous.start.getUTCFullYear()}-${String(previous.start.getUTCMonth() + 1).padStart(2, "0")}`,
    currentMonth: {
      total: curTotal,
      dailyAvg: curDailyAvg,
      activeDays: curDays,
      breakdown: topCategoriesWithOther(curBreakdown, 3),
    },
    previousMonth: {
      total: prevTotal,
      dailyAvg: prevDailyAvg,
      activeDays: prevDays,
    },
    previousMonthTotal: prevTotal,
    previousDailyAvg: prevDailyAvg,
    dailyAvgDelta, // percentage, null when previous month had no expenses
  });
}
