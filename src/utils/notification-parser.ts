import type { Category, TransactionType } from "@/db/types";

export interface ParsedNotification {
  amount: number | null;
  type: TransactionType | null;
  remarks: string;
  categoryId: number | null;
}

/*
 * Keywords indicating money left the account.
 *
 * Word boundaries prevent short keywords such as
 * "Dr" from matching inside unrelated words.
 */
const EXPENSE_KEYWORDS = [
  /\bdr\b/i,
  /\bdebited\b/i,
  /\bwithdrawn\b/i,
  /\bspent\b/i,
  /\bpaid\b/i,
  /\bpurchase\b/i,
  /\bdeducted\b/i,
];

/*
 * Keywords indicating money entered the account.
 */
const INCOME_KEYWORDS = [
  /\bcr\b/i,
  /\bcredited\b/i,
  /\bdeposited\b/i,
  /\breceived\b/i,
  /\brefund\b/i,
  /\bcashback\b/i,
];

/*
 * Supported examples:
 *
 * Rs. 1,234.50
 * Rs 500
 * NPR 500
 * INR 1,000
 * ₹250
 */
const AMOUNT_PATTERN = /(?:rs\.?|npr|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i;

/*
 * Remarks patterns are ordered from the most
 * transaction-specific to the most generic.
 */
const REMARKS_PATTERNS = [
  /*
   * Email examples:
   *
   * The transaction detail is CIPSNepal QR Payable AC#abc.
   * Transaction details: POS PURCHASE KFC
   */
  /\btransaction\s+details?\s*(?:is|are|:|-)\s*([^\n\r]+)/i,

  /*
   * Bank notification examples:
   *
   * Rmk: Load eSewa,UPI-192128507
   * Remarks: QR Payment
   */
  /\b(?:rmk|remarks?)\s*:?\s*([^\n\r]+)/i,

  /*
   * Example:
   *
   * 09:43:29 - 14047889dqhs,petrol
   */
  /\d{2}:\d{2}:\d{2}\s*-\s*([^\n\r]+)/i,

  /*
   * Generic fallbacks:
   *
   * paid at KFC
   * transferred to John
   * received from Jane
   */
  /\bat\s+([A-Za-z0-9&.,'#/_()\- ]{2,80})/i,
  /\bto\s+([A-Za-z0-9&.,'#/_()\- ]{2,80})/i,
  /\bfrom\s+([A-Za-z0-9&.,'#/_()\- ]{2,80})/i,
];

const INVALID_REMARKS = new Set([
  "",
  "http",
  "https",
  "http:",
  "https:",
  "www",
  "www.",
  "link",
  "website",
  "app",
  "bank",
]);

function detectType(text: string): TransactionType | null {
  if (EXPENSE_KEYWORDS.some((pattern) => pattern.test(text))) {
    return "expense";
  }

  if (INCOME_KEYWORDS.some((pattern) => pattern.test(text))) {
    return "income";
  }

  return null;
}

function detectAmount(text: string): number | null {
  const match = text.match(AMOUNT_PATTERN);

  if (!match) {
    return null;
  }

  const cleaned = match[1].replace(/,/g, "");
  const value = Number(cleaned);

  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Cleans and validates a possible transaction remark.
 */
function cleanRemarkCandidate(candidate: string): string | null {
  let cleaned = candidate
    /*
     * Remove complete URLs.
     */
    .replace(/https?:\/\/\S+/gi, " ")

    /*
     * Remove www links.
     */
    .replace(/www\.\S+/gi, " ")

    /*
     * Remove email addresses.
     */
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, " ")

    /*
     * Remove common boilerplate accidentally
     * captured on the same line.
     */
    .replace(/\bthank\s+you\b.*$/i, "")
    .replace(/\bavailable\s+balance\b.*$/i, "")
    .replace(/\bthis\s+is\s+(?:a\s+)?system.*$/i, "")
    .replace(/\bfor\s+further\s+inquiries\b.*$/i, "")

    /*
     * Normalize whitespace.
     */
    .replace(/\s+/g, " ")
    .trim()

    /*
     * Remove trailing separators and punctuation.
     */
    .replace(/[.,;:\s]+$/, "")
    .trim();

  /*
   * Keep review-screen remarks reasonably short.
   */
  if (cleaned.length > 120) {
    cleaned = `${cleaned.slice(0, 120).trim()}…`;
  }

  const normalized = cleaned
    .toLowerCase()
    .replace(/[.,;:\s]+$/g, "")
    .trim();

  if (cleaned.length < 2 || INVALID_REMARKS.has(normalized)) {
    return null;
  }

  /*
   * Reject remaining URL/protocol fragments.
   */
  if (
    /^https?\b/i.test(cleaned) ||
    /^www\b/i.test(cleaned) ||
    /^[a-z0-9-]+\.(?:com|org|net|io|np)\b/i.test(cleaned)
  ) {
    return null;
  }

  return cleaned;
}

function detectRemarks(title: string, text: string): string {
  /*
   * Use the notification body for structured
   * transaction-detail extraction.
   *
   * This avoids the sender/title accidentally
   * interfering with remarks patterns.
   */
  for (const pattern of REMARKS_PATTERNS) {
    const match = text.match(pattern);

    if (!match?.[1]) {
      continue;
    }

    const cleaned = cleanRemarkCandidate(match[1]);

    /*
     * If a generic pattern captured something invalid
     * such as "https", continue trying other patterns.
     */
    if (cleaned) {
      return cleaned;
    }
  }

  /*
   * Prefer the notification sender/title as a safe
   * fallback instead of copying the entire email body.
   */
  const cleanedTitle = cleanRemarkCandidate(title);

  if (cleanedTitle) {
    return cleanedTitle;
  }

  return "Transaction";
}

/**
 * Match the detected remarks against the user's
 * existing categories.
 *
 * No hardcoded merchant-to-category mapping is used.
 */
function matchCategory(
  remarks: string,
  type: TransactionType | null,
  categories: Category[],
): number | null {
  const lowerRemarks = remarks.toLowerCase();

  const candidates = type
    ? categories.filter((category) => category.type === type)
    : categories;

  const directMatch = candidates.find((category) =>
    lowerRemarks.includes(category.name.toLowerCase()),
  );

  return directMatch?.id ?? null;
}

export function parseNotification(
  title: string,
  text: string,
  categories: Category[],
): ParsedNotification {
  const safeTitle = typeof title === "string" ? title : "";

  const safeText = typeof text === "string" ? text : "";

  const fullText = `${safeTitle}\n${safeText}`;

  const type = detectType(fullText);
  const amount = detectAmount(fullText);

  const remarks = detectRemarks(safeTitle, safeText);

  const categoryId = matchCategory(remarks, type, categories);

  return {
    amount,
    type,
    remarks,
    categoryId,
  };
}
