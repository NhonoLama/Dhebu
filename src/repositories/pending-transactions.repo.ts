import { getDb } from "@/db/client";
import type { NewTransactionInput, TransactionType } from "@/db/types";

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
  notification_posted_at: number | null;
  created_at: string;
}

export interface NewPendingTransactionInput {
  raw_title: string | null;
  raw_text: string;
  source_package: string;
  detected_amount: number | null;
  detected_type: TransactionType | null;
  detected_category_id: number | null;
  notification_posted_at: number | null;
  remarks: string;
}

export interface ConfirmPendingTransactionInput extends NewTransactionInput {
  pendingId: number;
}

/*
 * =========================================================
 * CREATE PENDING TRANSACTION
 * =========================================================
 */

export async function createPendingTransaction(
  input: NewPendingTransactionInput,
): Promise<number> {
  const db = await getDb();

  const result = await db.runAsync(
    `
      INSERT INTO pending_transactions (
        raw_title,
        raw_text,
        source_package,
        detected_amount,
        detected_type,
        detected_category_id,
        remarks,
        notification_posted_at,
        status,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?);
    `,
    [
      input.raw_title,
      input.raw_text,
      input.source_package,
      input.detected_amount,
      input.detected_type,
      input.detected_category_id,
      input.remarks,
      input.notification_posted_at,
      new Date().toISOString(),
    ],
  );

  return result.lastInsertRowId;
}

/*
 * =========================================================
 * GET PENDING TRANSACTIONS
 * =========================================================
 */

export async function getPendingTransactions(): Promise<PendingTransaction[]> {
  const db = await getDb();

  return db.getAllAsync<PendingTransaction>(
    `
      SELECT *
      FROM pending_transactions
      WHERE status = 'pending'
      ORDER BY created_at DESC;
    `,
  );
}

/*
 * =========================================================
 * GET PENDING COUNT
 * =========================================================
 */

export async function getPendingCount(): Promise<number> {
  const db = await getDb();

  const row = await db.getFirstAsync<{
    count: number;
  }>(
    `
      SELECT COUNT(*) AS count
      FROM pending_transactions
      WHERE status = 'pending';
    `,
  );

  return row?.count ?? 0;
}

/*
 * =========================================================
 * ATOMIC CONFIRM
 * =========================================================
 *
 * This is the important production-safe operation.
 *
 * Either:
 *
 *   final transaction is created
 *   AND pending item becomes confirmed
 *
 * or:
 *
 *   neither change is saved
 *
 * It also checks that the pending item is still actually
 * pending before creating another transaction.
 */

export async function confirmPendingTransaction(
  input: ConfirmPendingTransactionInput,
): Promise<number | null> {
  const db = await getDb();

  let createdTransactionId: number | null = null;

  await db.withExclusiveTransactionAsync(async (txn) => {
    /*
     * First make sure this pending item still exists
     * and hasn't already been confirmed/dismissed.
     */
    const pending = await txn.getFirstAsync<{
      id: number;
      status: string;
    }>(
      `
        SELECT id, status
        FROM pending_transactions
        WHERE id = ?;
      `,
      [input.pendingId],
    );

    if (!pending) {
      return;
    }

    if (pending.status !== "pending") {
      return;
    }

    /*
     * Create the real ledger transaction.
     */
    const result = await txn.runAsync(
      `
        INSERT INTO transactions (
          account_id,
          category_id,
          type,
          amount,
          note,
          date,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?);
      `,
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

    /*
     * Mark the source pending transaction as confirmed.
     *
     * The extra:
     *
     *   AND status = 'pending'
     *
     * is another safety check.
     */
    const updateResult = await txn.runAsync(
      `
        UPDATE pending_transactions
        SET status = 'confirmed'
        WHERE id = ?
          AND status = 'pending';
      `,
      [input.pendingId],
    );

    /*
     * This should normally always change exactly one row.
     *
     * Throwing here causes the whole DB transaction
     * to roll back — including the transactions INSERT.
     */
    if (updateResult.changes !== 1) {
      throw new Error(
        `Failed to confirm pending transaction ${input.pendingId}`,
      );
    }

    createdTransactionId = result.lastInsertRowId;
  });

  return createdTransactionId;
}

/*
 * =========================================================
 * DISMISS
 * =========================================================
 */

export async function markPendingDismissed(id: number): Promise<void> {
  const db = await getDb();

  await db.runAsync(
    `
      UPDATE pending_transactions
      SET status = 'dismissed'
      WHERE id = ?
        AND status = 'pending';
    `,
    [id],
  );
}
