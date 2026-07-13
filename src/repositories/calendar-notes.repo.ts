import { getDb } from "@/db/client";
import type { CalendarNote, NewCalendarNoteInput } from "@/db/types";

// SQLite has no boolean type — rows come back with remind as 0/1.
function toCalendarNote(row: any): CalendarNote {
  return { ...row, remind: !!row.remind };
}

export async function getNotesForMonth(
  startDate: string,
  endDate: string,
): Promise<CalendarNote[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    "SELECT * FROM calendar_notes WHERE date BETWEEN ? AND ? ORDER BY date ASC;",
    [startDate, endDate],
  );
  return rows.map(toCalendarNote);
}

export async function getNotesForDate(date: string): Promise<CalendarNote[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    "SELECT * FROM calendar_notes WHERE date = ? ORDER BY created_at ASC;",
    [date],
  );
  return rows.map(toCalendarNote);
}

export async function createNote(input: NewCalendarNoteInput): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO calendar_notes (date, note, remind, remind_time, notification_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?);`,
    [
      input.date,
      input.note,
      input.remind ? 1 : 0,
      input.remind_time ?? null,
      null,
      new Date().toISOString(),
    ],
  );
  return result.lastInsertRowId;
}

export async function attachNotificationId(
  noteId: number,
  notificationId: string,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "UPDATE calendar_notes SET notification_id = ? WHERE id = ?;",
    [notificationId, noteId],
  );
}

export async function deleteNote(id: number): Promise<CalendarNote | null> {
  const db = await getDb();
  const existing = await db.getFirstAsync<any>(
    "SELECT * FROM calendar_notes WHERE id = ?;",
    [id],
  );
  await db.runAsync("DELETE FROM calendar_notes WHERE id = ?;", [id]);
  return existing ? toCalendarNote(existing) : null;
}
