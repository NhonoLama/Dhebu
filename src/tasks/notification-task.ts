import { getDb } from "@/db/client";
import { getAllCategories } from "@/repositories/categories.repo";
import { createPendingTransaction } from "@/repositories/pending-transactions.repo";
import { parseNotification } from "@/utils/notification-parser";

interface RawNotificationEvent {
  app: string;
  appLabel?: string;
  title: string;
  text: string;
}

async function isApprovedSource(
  packageName: string,
  appLabel: string,
): Promise<boolean> {
  if (!packageName) {
    console.log("DHEBU PIPELINE: empty package name");

    return false;
  }

  const db = await getDb();

  console.log("DHEBU PIPELINE: checking source", {
    packageName,
    appLabel,
  });

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

  console.log("DHEBU PIPELINE: source database result", existing);

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

  console.log(
    "DHEBU PIPELINE: source missing from SQLite, registered disabled",
    {
      packageName,
      appLabel,
    },
  );

  return false;
}

export async function handleNotificationEvent(
  event: RawNotificationEvent,
): Promise<boolean> {
  console.log("DHEBU PIPELINE: handleNotificationEvent started", event);

  try {
    /*
     * Invalid notification.
     *
     * There is nothing useful to retry,
     * so consider it handled.
     */
    if (!event.app || typeof event.app !== "string") {
      console.log("DHEBU PIPELINE: invalid app package");

      return true;
    }

    /*
     * Check app approval.
     */
    const approved = await isApprovedSource(
      event.app,
      event.appLabel ?? event.app,
    );

    console.log("DHEBU PIPELINE: source approved?", approved);

    /*
     * If deliberately not approved, there is
     * no reason to keep retrying this notification.
     */
    if (!approved) {
      console.log("DHEBU PIPELINE: ignored because source is not approved", {
        app: event.app,
        appLabel: event.appLabel,
      });

      return true;
    }

    /*
     * Load categories.
     */
    const categories = await getAllCategories();

    console.log("DHEBU PIPELINE: categories loaded", categories.length);

    /*
     * Parse notification.
     */
    const parsed = parseNotification(
      event.title ?? "",
      event.text ?? "",
      categories,
    );

    console.log("DHEBU: parsed notification", {
      app: event.app,
      appLabel: event.appLabel,
      title: event.title,
      text: event.text,
      parsed,
    });

    /*
     * No amount means it isn't a transaction.
     *
     * That is still a successful processing result,
     * so remove it from the native queue.
     */
    if (parsed.amount === null) {
      console.log("DHEBU PIPELINE: no amount detected, ignoring notification");

      return true;
    }

    /*
     * Save pending transaction.
     */
    const created = await createPendingTransaction({
      raw_title: event.title ?? null,

      raw_text: event.text ?? "",

      source_package: event.app,

      detected_amount: parsed.amount,

      detected_type: parsed.type,

      detected_category_id: parsed.categoryId,

      remarks: parsed.remarks,
    });

    console.log("DHEBU: pending transaction created", {
      result: created,
      amount: parsed.amount,
      type: parsed.type,
      categoryId: parsed.categoryId,
      remarks: parsed.remarks,
      source: event.app,
    });

    /*
     * Everything completed successfully.
     */
    return true;
  } catch (error) {
    console.error("DHEBU PIPELINE ERROR:", error);

    /*
     * Keep the native queued copy.
     *
     * We'll retry it when Dhebu opens/resumes.
     */
    return false;
  }
}
