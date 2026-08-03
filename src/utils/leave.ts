/**
 * Counts full accrual periods from startDate up to (and including) the
 * month asOfDate falls in. The starting month itself counts as one
 * accrued period — see the design note where this is used.
 */
export function monthsElapsed(startDate: string, asOfDate: Date): number {
  const start = new Date(startDate);
  const months =
    (asOfDate.getFullYear() - start.getFullYear()) * 12 +
    (asOfDate.getMonth() - start.getMonth()) +
    1;
  return Math.max(months, 1);
}

export function calculateAccruedDays(
  startDate: string,
  daysPerMonth: number,
  asOfDate: Date = new Date(),
): number {
  return monthsElapsed(startDate, asOfDate) * daysPerMonth;
}

export function calculateBalance(
  startDate: string,
  daysPerMonth: number,
  totalDaysTaken: number, // sum of amounts (0.5/1 per day), not a row count
  asOfDate: Date = new Date(),
): number {
  const accrued = calculateAccruedDays(startDate, daysPerMonth, asOfDate);
  return accrued - totalDaysTaken;
}
