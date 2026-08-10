import { getDb } from "@/db/client";
import type { TransactionType } from "@/db/types";

export interface PendingTransaction {
  id: number;
  raw_title: string | null;
  raw_text: string;
  source_package: string;
  detected_amount: number | null;
  detected_type: TransactionType | null;
  detected_category_id: number | null;
  remarks: string | null;
  status: "pending" | "confirmed" | "dismissed";
  created_at: string;
}

export interface NewPendingTransactionInput {
  raw_title: string | null;
  raw_text: string;
  source_package: string;
  detected_amount: number | null;
  detected_type: TransactionType | null;
  detected_category_id: number | null;
  remarks: string;
}

export async function createPendingTransaction(
  input: NewPendingTransactionInput,
): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO pending_transactions
       (raw_title, raw_text, source_package, detected_amount, detected_type,
        detected_category_id, remarks, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?);`,
    [
      input.raw_title,
      input.raw_text,
      input.source_package,
      input.detected_amount,
      input.detected_type,
      input.detected_category_id,
      input.remarks,
      new Date().toISOString(),
    ],
  );
  return result.lastInsertRowId;
}

export async function getPendingTransactions(): Promise<PendingTransaction[]> {
  const db = await getDb();
  return db.getAllAsync<PendingTransaction>(
    `SELECT * FROM pending_transactions WHERE status = 'pending' ORDER BY created_at DESC;`,
  );
}

export async function getPendingCount(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM pending_transactions WHERE status = 'pending';`,
  );
  return row?.count ?? 0;
}

export async function markPendingConfirmed(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE pending_transactions SET status = 'confirmed' WHERE id = ?;`,
    [id],
  );
}

export async function markPendingDismissed(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE pending_transactions SET status = 'dismissed' WHERE id = ?;`,
    [id],
  );
}
