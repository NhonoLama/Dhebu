import { getDb } from "@/db/client";

export interface LeaveSettings {
  id: number;
  days_per_month: number;
  start_date: string; // ISO date — accrual starts counting from here
  created_at: string;
}

export interface LeaveDay {
  id: number;
  date: string;
  created_at: string;
}

export async function getLeaveSettings(): Promise<LeaveSettings | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<LeaveSettings>(
    "SELECT * FROM leave_settings WHERE id = 1;",
  );
  return row ?? null;
}

/**
 * Creates or updates the single leave-rate setting. If a rate already
 * exists, this only updates days_per_month — it does NOT reset start_date,
 * since that would wipe out already-accrued history.
 */
export async function setLeaveRate(daysPerMonth: number): Promise<void> {
  const db = await getDb();
  const existing = await getLeaveSettings();
  if (existing) {
    await db.runAsync(
      "UPDATE leave_settings SET days_per_month = ? WHERE id = 1;",
      [daysPerMonth],
    );
  } else {
    const now = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO leave_settings (id, days_per_month, start_date, created_at)
       VALUES (1, ?, ?, ?);`,
      [daysPerMonth, now, now],
    );
  }
}

export async function getAllLeaveDays(): Promise<LeaveDay[]> {
  const db = await getDb();
  return db.getAllAsync<LeaveDay>(
    "SELECT * FROM leave_days ORDER BY date DESC;",
  );
}

export async function isLeaveDay(date: string): Promise<boolean> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ id: number }>(
    "SELECT id FROM leave_days WHERE date = ?;",
    [date],
  );
  return row !== null;
}

/** Marks a date as leave taken. Throws if that date is already marked. */
export async function markLeaveDay(date: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "INSERT INTO leave_days (date, created_at) VALUES (?, ?);",
    [date, new Date().toISOString()],
  );
}

/** Unmarks a date (undo). Safe to call even if it wasn't marked. */
export async function unmarkLeaveDay(date: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM leave_days WHERE date = ?;", [date]);
}

export async function countLeaveDaysTaken(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM leave_days;",
  );
  return row?.count ?? 0;
}

/**
 * Sets (or updates) the accrual start date independently of the rate.
 * If no settings row exists yet, creates one with a placeholder rate of 0 —
 * the user is expected to also set a rate via setLeaveRate.
 */
export async function setLeaveStartDate(startDate: string): Promise<void> {
  const db = await getDb();
  const existing = await getLeaveSettings();
  if (existing) {
    await db.runAsync(
      "UPDATE leave_settings SET start_date = ? WHERE id = 1;",
      [startDate],
    );
  } else {
    const now = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO leave_settings (id, days_per_month, start_date, created_at)
       VALUES (1, 0, ?, ?);`,
      [startDate, now],
    );
  }
}
