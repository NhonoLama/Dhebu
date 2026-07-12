/**
 * Formats a number as currency. Uses Intl.NumberFormat, which is built
 * into JavaScript — same API you'd use in a web app.
 */
export function formatCurrency(
  amount: number,
  currency = "NPR",
  locale = "en-IN",
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function parseAmountInput(text: string): number | null {
  const cleaned = text.replace(/[^0-9.]/g, "");
  if (cleaned === "") return null;
  const value = Number(cleaned);
  return Number.isFinite(value) && value > 0 ? value : null;
}
