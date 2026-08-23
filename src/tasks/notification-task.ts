import { getDb } from "@/db/client";
import { getAllCategories } from "@/repositories/categories.repo";
import { createPendingTransaction } from "@/repositories/pending-transactions.repo";
import { parseNotification } from "@/utils/notification-parser";

interface RawNotificationEvent {
  app: string;
  appLabel?: string;
  title: string;
  text: string;
  postedAt?: number;
}

/**
 * Prevent invalid notification titles such as
 * "https", "http", URLs, or empty values from
 * appearing as the transaction title.
 */
function sanitizeNotificationTitle(
  title: string | undefined,
  appLabel: string | undefined,
): string {
  const originalTitle = typeof title === "string" ? title : "";

  const cleanedTitle = originalTitle
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\b(?:https?|www)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  const invalidTitles = new Set([
    "",
    "http",
    "https",
    "http:",
    "https:",
    "www",
    "www.",
  ]);

  if (
    cleanedTitle.length >= 2 &&
    !invalidTitles.has(cleanedTitle.toLowerCase())
  ) {
    return cleanedTitle;
  }

  const cleanedAppLabel =
    typeof appLabel === "string" ? appLabel.replace(/\s+/g, " ").trim() : "";

  /*
   * Use the readable application name when available.
   * For example: "Gmail transaction".
   *
   * Package names such as com.google.android.gm are
   * intentionally rejected as user-facing titles.
   */
  if (
    cleanedAppLabel &&
    !cleanedAppLabel.includes(".") &&
    !invalidTitles.has(cleanedAppLabel.toLowerCase())
  ) {
    return `${cleanedAppLabel} transaction`;
  }

  return "Email transaction";
}

async function isApprovedSource(
  packageName: string,
  appLabel: string,
): Promise<boolean> {
  if (!packageName) {
    if (__DEV__) {
      console.log("DHEBU PIPELINE: empty package name");
    }

    return false;
  }

  const db = await getDb();

  if (__DEV__) {
    console.log("DHEBU PIPELINE: checking source", {
      packageName,
      appLabel,
    });
  }

  const existing = await db.getFirstAsync<{
    enabled: number;
    app_label: string;
  }>(
    `
      SELECT
        enabled,
        app_label
      FROM notification_apps
      WHERE package_name = ?;
    `,
    [packageName],
  );

  if (__DEV__) {
    console.log("DHEBU PIPELINE: source database result", existing);
  }

  if (existing) {
    if (
      appLabel &&
      appLabel !== packageName &&
      appLabel !== existing.app_label
    ) {
      await db.runAsync(
        `
          UPDATE notification_apps
          SET app_label = ?
          WHERE package_name = ?;
        `,
        [appLabel, packageName],
      );
    }

    return existing.enabled === 1;
  }

  /*
   * This should normally not happen now because
   * Profile synchronizes selected apps into SQLite.
   *
   * Keep the fallback for safety.
   */
  await db.runAsync(
    `
      INSERT INTO notification_apps (
        package_name,
        app_label,
        enabled
      )
      VALUES (?, ?, 0);
    `,
    [packageName, appLabel || packageName],
  );

  if (__DEV__) {
    console.log(
      "DHEBU PIPELINE: source missing from SQLite, registered disabled",
      {
        packageName,
        appLabel,
      },
    );
  }

  return false;
}

export async function handleNotificationEvent(
  event: RawNotificationEvent,
): Promise<boolean> {
  if (__DEV__) {
    console.log("DHEBU PIPELINE: handleNotificationEvent started", event);
  }

  try {
    /*
     * Invalid notification.
     *
     * There is nothing useful to retry,
     * so consider it handled.
     */
    if (!event.app || typeof event.app !== "string") {
      if (__DEV__) {
        console.log("DHEBU PIPELINE: invalid app package");
      }

      return true;
    }

    /*
     * Check whether this notification source
     * has been enabled by the user.
     */
    const approved = await isApprovedSource(
      event.app,
      event.appLabel ?? event.app,
    );

    if (__DEV__) {
      console.log("DHEBU PIPELINE: source approved?", approved);
    }

    /*
     * If deliberately not approved, there is
     * no reason to keep retrying this notification.
     */
    if (!approved) {
      if (__DEV__) {
        console.log("DHEBU PIPELINE: ignored because source is not approved", {
          app: event.app,
          appLabel: event.appLabel,
        });
      }

      return true;
    }

    /*
     * Load categories.
     */
    const categories = await getAllCategories();

    if (__DEV__) {
      console.log("DHEBU PIPELINE: categories loaded", categories.length);
    }

    /*
     * Parse the notification content.
     */
    const parsed = parseNotification(
      event.title ?? "",
      event.text ?? "",
      categories,
    );

    if (__DEV__) {
      console.log("DHEBU: parsed notification", {
        app: event.app,
        appLabel: event.appLabel,
        title: event.title,
        text: event.text,
        postedAt: event.postedAt,
        parsed,
      });
    }

    /*
     * No amount means this notification is not
     * treated as a financial transaction.
     *
     * It is still considered successfully processed,
     * so it can be removed from the native queue.
     */
    if (parsed.amount === null) {
      if (__DEV__) {
        console.log(
          "DHEBU PIPELINE: no amount detected, ignoring notification",
        );
      }

      return true;
    }

    /*
     * Clean the title before saving it.
     *
     * This prevents "https", URLs, or other link
     * fragments from appearing in the review screen.
     */
    const safeTitle = sanitizeNotificationTitle(event.title, event.appLabel);

    if (__DEV__) {
      console.log("DHEBU: sanitized notification title", {
        originalTitle: event.title,
        safeTitle,
        appLabel: event.appLabel,
        source: event.app,
      });
    }

    /*
     * Save the detected transaction for review.
     */
    const created = await createPendingTransaction({
      raw_title: safeTitle,

      raw_text: event.text ?? "",

      source_package: event.app,

      detected_amount: parsed.amount,

      detected_type: parsed.type,

      detected_category_id: parsed.categoryId,

      remarks: parsed.remarks,

      notification_posted_at:
        typeof event.postedAt === "number" ? event.postedAt : null,
    });

    if (__DEV__) {
      console.log("DHEBU: pending transaction created", {
        result: created,
        originalTitle: event.title,
        savedTitle: safeTitle,
        amount: parsed.amount,
        type: parsed.type,
        categoryId: parsed.categoryId,
        remarks: parsed.remarks,
        source: event.app,
        postedAt: event.postedAt,
      });
    }

    /*
     * Everything completed successfully.
     */
    return true;
  } catch (error) {
    console.error("DHEBU PIPELINE ERROR:", error);

    /*
     * Keep the native queued copy.
     *
     * It will be retried when Dhebu opens
     * or resumes.
     */
    return false;
  }
}
