import { getDb } from "@/db/client";
import type { Category, TransactionType } from "@/db/types";

export async function getAllCategories(): Promise<Category[]> {
  const db = await getDb();
  return db.getAllAsync<Category>(
    "SELECT * FROM categories ORDER BY name ASC;",
  );
}

export async function getCategoriesByType(
  type: TransactionType,
): Promise<Category[]> {
  const db = await getDb();
  return db.getAllAsync<Category>(
    "SELECT * FROM categories WHERE type = ? ORDER BY name ASC;",
    [type],
  );
}

export async function createCategory(input: {
  name: string;
  type: TransactionType;
  icon?: string;
  color?: string;
}): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(
    "INSERT INTO categories (name, type, icon, color) VALUES (?, ?, ?, ?);",
    [input.name, input.type, input.icon ?? null, input.color ?? null],
  );
  return result.lastInsertRowId;
}

export async function updateCategory(
  id: number,
  input: Partial<Pick<Category, "name" | "icon" | "color">>,
): Promise<void> {
  const db = await getDb();
  const existing = await db.getFirstAsync<Category>(
    "SELECT * FROM categories WHERE id = ?;",
    [id],
  );
  if (!existing) throw new Error(`Category ${id} not found`);
  const merged = { ...existing, ...input };
  await db.runAsync(
    "UPDATE categories SET name = ?, icon = ?, color = ? WHERE id = ?;",
    [merged.name, merged.icon, merged.color, id],
  );
}

export async function deleteCategory(id: number): Promise<void> {
  const db = await getDb();
  // ON DELETE RESTRICT on the transactions table means this will THROW
  // an error if any transaction still uses this category — catch it in
  // the UI and tell the user to reassign/delete those transactions first.
  await db.runAsync("DELETE FROM categories WHERE id = ?;", [id]);
}
