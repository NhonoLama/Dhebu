import { getDb } from "@/db/client";

export interface UserProfile {
  id: number;
  name: string;
  currency: string;
  avatar_id: string;
  created_at: string;
}

export async function getUserProfile(): Promise<UserProfile | null> {
  const db = await getDb();

  const row = await db.getFirstAsync<UserProfile>(
    `
      SELECT
        id,
        name,
        currency,
        avatar_id,
        created_at
      FROM user_profile
      WHERE id = 1;
    `,
  );

  return row ?? null;
}

export async function createUserProfile(input: {
  name: string;
  currency: string;
  avatarId?: string;
}): Promise<void> {
  const db = await getDb();

  await db.runAsync(
    `
      INSERT INTO user_profile (
        id,
        name,
        currency,
        avatar_id,
        created_at
      )
      VALUES (
        1,
        ?,
        ?,
        ?,
        ?
      );
    `,
    [
      input.name,
      input.currency,
      input.avatarId ?? "avatar_01",
      new Date().toISOString(),
    ],
  );
}

export async function updateUserProfile(input: {
  name?: string;
  currency?: string;
  avatarId?: string;
}): Promise<void> {
  const db = await getDb();

  const existing = await getUserProfile();

  if (!existing) {
    throw new Error("No profile exists to update");
  }

  const merged = {
    name: input.name ?? existing.name,
    currency: input.currency ?? existing.currency,
    avatarId: input.avatarId ?? existing.avatar_id ?? "avatar_01",
  };

  await db.runAsync(
    `
      UPDATE user_profile
      SET
        name = ?,
        currency = ?,
        avatar_id = ?
      WHERE id = 1;
    `,
    [merged.name, merged.currency, merged.avatarId],
  );
}
