import {
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "date-fns";

/** ISO date (yyyy-MM-dd) for use as a SQLite date column value. */
export function toIsoDate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function currentMonthRange(): { start: string; end: string } {
  const now = new Date();
  return {
    start: toIsoDate(startOfMonth(now)),
    end: toIsoDate(endOfMonth(now)),
  };
}

export function currentWeekRange(): { start: string; end: string } {
  const now = new Date();
  return {
    start: toIsoDate(startOfWeek(now, { weekStartsOn: 1 })),
    end: toIsoDate(endOfWeek(now, { weekStartsOn: 1 })),
  };
}

export function currentYearRange(): { start: string; end: string } {
  const now = new Date();
  return {
    start: toIsoDate(startOfYear(now)),
    end: toIsoDate(endOfYear(now)),
  };
}

export function formatDisplayDate(isoDate: string): string {
  return format(new Date(isoDate), "MMM d, yyyy");
}
