import { getDb } from "@/db/client";
import type {
  CategoryBreakdown,
  NewTransactionInput,
  PeriodSummary,
  TransactionWithRelations,
} from "@/db/types";

const JOIN_SELECT = `
  SELECT
    t.*,
    c.name AS category_name,
    c.icon AS category_icon,
    c.color AS category_color,
    a.name AS account_name
  FROM transactions t
  JOIN categories c ON c.id = t.category_id
  JOIN accounts a ON a.id = t.account_id
`;

export async function createTransaction(
  input: NewTransactionInput,
): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO transactions (account_id, category_id, type, amount, note, date, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?);`,
    [
      input.account_id,
      input.category_id,
      input.type,
      input.amount,
      input.note ?? null,
      input.date,
      new Date().toISOString(),
    ],
  );
  return result.lastInsertRowId;
}

export async function deleteTransaction(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM transactions WHERE id = ?;", [id]);
}

/** Recent transactions, newest first, optionally limited. */
export async function getRecentTransactions(
  limit = 20,
): Promise<TransactionWithRelations[]> {
  const db = await getDb();
  return db.getAllAsync<TransactionWithRelations>(
    `${JOIN_SELECT} ORDER BY t.date DESC, t.id DESC LIMIT ?;`,
    [limit],
  );
}

/** All transactions within an inclusive date range (ISO date strings). */
export async function getTransactionsByDateRange(
  startDate: string,
  endDate: string,
): Promise<TransactionWithRelations[]> {
  const db = await getDb();
  return db.getAllAsync<TransactionWithRelations>(
    `${JOIN_SELECT} WHERE t.date BETWEEN ? AND ? ORDER BY t.date DESC, t.id DESC;`,
    [startDate, endDate],
  );
}

export interface AllTimeSummary extends PeriodSummary {
  transactionCount: number;
  earliestDate: string | null;
}

/**
 * Income, expense, and net balance across ALL recorded transactions —
 * no date filter. This never resets, unlike getPeriodSummary's ranges.
 */
export async function getAllTimeSummary(): Promise<AllTimeSummary> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ type: string; total: number }>(
    `SELECT type, COALESCE(SUM(amount), 0) as total
     FROM transactions
     GROUP BY type;`,
  );
  const income = rows.find((r) => r.type === "income")?.total ?? 0;
  const expense = rows.find((r) => r.type === "expense")?.total ?? 0;

  const countRow = await db.getFirstAsync<{
    count: number;
    earliest: string | null;
  }>(`SELECT COUNT(*) as count, MIN(date) as earliest FROM transactions;`);

  return {
    income,
    expense,
    balance: income - expense,
    transactionCount: countRow?.count ?? 0,
    earliestDate: countRow?.earliest ?? null,
  };
}

/** Income, expense, and net balance for a date range. */
export async function getPeriodSummary(
  startDate: string,
  endDate: string,
): Promise<PeriodSummary> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ type: string; total: number }>(
    `SELECT type, COALESCE(SUM(amount), 0) as total
     FROM transactions
     WHERE date BETWEEN ? AND ?
     GROUP BY type;`,
    [startDate, endDate],
  );
  const income = rows.find((r) => r.type === "income")?.total ?? 0;
  const expense = rows.find((r) => r.type === "expense")?.total ?? 0;
  return { income, expense, balance: income - expense };
}

/** Spend/income grouped by category for a date range — used for report charts. */
export async function getCategoryBreakdown(
  startDate: string,
  endDate: string,
  type: "income" | "expense",
): Promise<CategoryBreakdown[]> {
  const db = await getDb();
  return db.getAllAsync<CategoryBreakdown>(
    `SELECT
       c.id as category_id,
       c.name as category_name,
       c.color as category_color,
       COALESCE(SUM(t.amount), 0) as total
     FROM categories c
     LEFT JOIN transactions t
       ON t.category_id = c.id AND t.date BETWEEN ? AND ?
     WHERE c.type = ?
     GROUP BY c.id
     HAVING total > 0
     ORDER BY total DESC;`,
    [startDate, endDate, type],
  );
}
