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
 * Prevent invalid titles such as "https", URLs, or empty values from being
 * displayed as transaction titles.
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
    console.log("DHEBU PIPELINE: source database result", {
      found: Boolean(existing),
      enabled: existing?.enabled === 1,
    });
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
   * Profile normally synchronizes selected applications into SQLite. Keep a
   * disabled fallback record if a previously unknown source reaches the task.
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
    console.log("DHEBU PIPELINE: handleNotificationEvent started", {
      app: event.app,
      appLabel: event.appLabel,
      postedAt: event.postedAt,
      hasTitle: Boolean(event.title?.trim()),
      textLength: event.text?.length ?? 0,
    });
  }

  try {
    /*
     * Invalid notifications contain nothing useful to retry, so they are
     * considered handled and can be removed from the native queue.
     */
    if (!event.app || typeof event.app !== "string") {
      if (__DEV__) {
        console.log("DHEBU PIPELINE: invalid app package");
      }

      return true;
    }

    const approved = await isApprovedSource(
      event.app,
      event.appLabel ?? event.app,
    );

    if (__DEV__) {
      console.log("DHEBU PIPELINE: source approved?", approved);
    }

    if (!approved) {
      if (__DEV__) {
        console.log("DHEBU PIPELINE: source is not approved", {
          app: event.app,
          appLabel: event.appLabel,
        });
      }

      return true;
    }

    const categories = await getAllCategories();

    if (__DEV__) {
      console.log("DHEBU PIPELINE: categories loaded", categories.length);
    }

    const parsed = parseNotification(
      event.title ?? "",
      event.text ?? "",
      categories,
    );

    if (__DEV__) {
      console.log("DHEBU: notification parsed", {
        app: event.app,
        postedAt: event.postedAt,
        amountDetected: parsed.amount !== null,
        type: parsed.type,
        categoryId: parsed.categoryId,
        hasRemarks: Boolean(parsed.remarks?.trim()),
      });
    }

    if (parsed.amount === null) {
      if (__DEV__) {
        console.log(
          "DHEBU PIPELINE: no amount detected, ignoring notification",
        );
      }

      return true;
    }

    const safeTitle = sanitizeNotificationTitle(event.title, event.appLabel);

    if (__DEV__) {
      console.log("DHEBU: notification title sanitized", {
        changed: safeTitle !== event.title,
        usedAppFallback: safeTitle.endsWith(" transaction"),
      });
    }

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
        type: parsed.type,
        categoryId: parsed.categoryId,
        source: event.app,
        postedAt: event.postedAt,
      });
    }

    return true;
  } catch (error) {
    /*
     * Keep the native queued copy so it can be retried when Dhebu opens or
     * resumes. Real failures remain visible in production logs.
     */
    console.error("DHEBU PIPELINE ERROR:", error);
    return false;
  }
}
