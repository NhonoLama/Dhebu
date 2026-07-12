import { getDb } from "@/db/client";
import type { Account, AccountType } from "@/db/types";

export async function getAllAccounts(): Promise<Account[]> {
  const db = await getDb();
  return db.getAllAsync<Account>("SELECT * FROM accounts ORDER BY id ASC;");
}

export async function createAccount(input: {
  name: string;
  type: AccountType;
  initial_balance?: number;
  currency?: string;
}): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO accounts (name, type, initial_balance, currency, created_at)
     VALUES (?, ?, ?, ?, ?);`,
    [
      input.name,
      input.type,
      input.initial_balance ?? 0,
      input.currency ?? "NPR",
      new Date().toISOString(),
    ],
  );
  return result.lastInsertRowId;
}

export async function updateAccount(
  id: number,
  input: Partial<Pick<Account, "name" | "type" | "currency">>,
): Promise<void> {
  const db = await getDb();
  const existing = await db.getFirstAsync<Account>(
    "SELECT * FROM accounts WHERE id = ?;",
    [id],
  );
  if (!existing) throw new Error(`Account ${id} not found`);
  const merged = { ...existing, ...input };
  await db.runAsync(
    "UPDATE accounts SET name = ?, type = ?, currency = ? WHERE id = ?;",
    [merged.name, merged.type, merged.currency, id],
  );
}

export async function deleteAccount(id: number): Promise<void> {
  const db = await getDb();
  // ON DELETE CASCADE (set in the table schema) means any transactions
  // on this account get deleted too — that's intentional here.
  await db.runAsync("DELETE FROM accounts WHERE id = ?;", [id]);
}
