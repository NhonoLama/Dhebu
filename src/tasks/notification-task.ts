import { getDb } from "@/db/client";
import { getAllCategories } from "@/repositories/categories.repo";
import { createPendingTransaction } from "@/repositories/pending-transactions.repo";
import { parseNotification } from "@/utils/notification-parser";

interface RawNotificationEvent {
  app: string; // package name, e.g. "com.prabhubank.mobile"
  title: string;
  text: string;
}

/**
 * Checks whether this app's package is one the user has approved as a
 * "financial" notification source. Unknown apps get auto-registered as
 * disabled, so they show up in Settings for the user to opt in later —
 * we never parse from an app the user hasn't explicitly approved.
 */
async function isApprovedSource(
  packageName: string,
  appLabel: string,
): Promise<boolean> {
  const db = await getDb();
  const existing = await db.getFirstAsync<{ enabled: number }>(
    "SELECT enabled FROM notification_apps WHERE package_name = ?;",
    [packageName],
  );

  if (existing) {
    return existing.enabled === 1;
  }

  // First time seeing this app — register it as disabled by default.
  await db.runAsync(
    "INSERT INTO notification_apps (package_name, app_label, enabled) VALUES (?, ?, 0);",
    [packageName, appLabel],
  );
  return false;
}

/**
 * The actual headless task function. Runs with no UI, no React tree —
 * just does its work and returns. MUST return a Promise (the native side
 * awaits it before letting Android know the task finished).
 */
export async function handleNotificationEvent(
  event: RawNotificationEvent,
): Promise<void> {
  try {
    const approved = await isApprovedSource(event.app, event.app);
    if (!approved) return; // Not an approved financial app — ignore silently.

    const categories = await getAllCategories();
    const parsed = parseNotification(
      event.title ?? "",
      event.text ?? "",
      categories,
    );

    // Skip notifications where we couldn't even find an amount —
    // almost certainly not a transaction (e.g. a promo/marketing push).
    if (parsed.amount === null) return;

    await createPendingTransaction({
      raw_title: event.title ?? null,
      raw_text: event.text ?? "",
      source_package: event.app,
      detected_amount: parsed.amount,
      detected_type: parsed.type,
      detected_category_id: parsed.categoryId,
      remarks: parsed.remarks,
    });
  } catch (error) {
    // Headless tasks fail silently to the user by design — but we still
    // don't want one bad notification to crash the listener service.
    console.error("notification-task error:", error);
  }
}
