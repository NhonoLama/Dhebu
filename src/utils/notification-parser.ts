import type { Category, TransactionType } from "@/db/types";

export interface ParsedNotification {
  amount: number | null;
  type: TransactionType | null;
  remarks: string;
  categoryId: number | null;
}

// Keywords indicating money left your account. Word-boundary matched so
// "Dr" doesn't accidentally match inside unrelated words.
const EXPENSE_KEYWORDS = [
  /\bdr\b/i,
  /\bdebited\b/i,
  /\bwithdrawn\b/i,
  /\bspent\b/i,
  /\bpaid\b/i,
  /\bpurchase\b/i,
  /\bdeducted\b/i,
];

// Keywords indicating money entered your account.
const INCOME_KEYWORDS = [
  /\bcr\b/i,
  /\bcredited\b/i,
  /\bdeposited\b/i,
  /\breceived\b/i,
  /\brefund\b/i,
  /\bcashback\b/i,
];

// Currency amount patterns: "Rs. 1,234.50", "NPR 500", "₹250", "INR 1000"
const AMOUNT_PATTERN = /(?:rs\.?|npr|inr|₹)\s?([\d,]+(?:\.\d{1,2})?)/i;

// Merchant/remarks patterns, tried in order — matched against real bank
// SMS formats:
//   "Rmk: Load eSewa,UPI-192128507,"        (Prabhu Bank style)
//   "... 09:43:29 - 14047889dqhs,petroll"   (short-code style, after " - ")
//   "at KFC" / "to John" / "from Jane"      (generic fallback)
const REMARKS_PATTERNS = [
  /rmk:?\s*([^\n]+)/i,
  /\d{2}:\d{2}:\d{2}\s*-\s*([^\n]+)/i,
  /\bat\s+([A-Za-z0-9&.,'\- ]{2,40})/i,
  /\bto\s+([A-Za-z0-9&.,'\- ]{2,40})/i,
  /\bfrom\s+([A-Za-z0-9&.,'\- ]{2,40})/i,
];

function detectType(text: string): TransactionType | null {
  if (EXPENSE_KEYWORDS.some((pattern) => pattern.test(text))) return "expense";
  if (INCOME_KEYWORDS.some((pattern) => pattern.test(text))) return "income";
  return null;
}

function detectAmount(text: string): number | null {
  const match = text.match(AMOUNT_PATTERN);
  if (!match) return null;
  const cleaned = match[1].replace(/,/g, "");
  const value = Number(cleaned);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function detectRemarks(text: string): string {
  for (const pattern of REMARKS_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      // Strip trailing commas/whitespace/"Thank You" boilerplate some
      // banks append on the same line as the remark.
      return match[1]
        .replace(/thank you.*$/i, "")
        .trim()
        .replace(/[,\s]+$/, "");
    }
  }
  // Fallback: no pattern matched — use the whole text, trimmed short.
  return text.length > 60 ? `${text.slice(0, 60)}…` : text;
}

/**
 * Matches remarks text against the user's EXISTING categories first —
 * this is the primary matching strategy, per Dhebu's design: always
 * check category by the remarks value, not a hardcoded merchant list.
 */
function matchCategory(
  remarks: string,
  type: TransactionType | null,
  categories: Category[],
): number | null {
  const lowerRemarks = remarks.toLowerCase();
  const candidates = type
    ? categories.filter((c) => c.type === type)
    : categories;

  // Direct substring match: does the category's own name appear in the remarks?
  const directMatch = candidates.find((c) =>
    lowerRemarks.includes(c.name.toLowerCase()),
  );
  if (directMatch) return directMatch.id;

  return null; // No match — user will pick manually when confirming.
}

export function parseNotification(
  title: string,
  text: string,
  categories: Category[],
): ParsedNotification {
  const fullText = `${title} ${text}`;
  const type = detectType(fullText);
  const amount = detectAmount(fullText);
  const remarks = detectRemarks(fullText);
  const categoryId = matchCategory(remarks, type, categories);

  return { amount, type, remarks, categoryId };
}
