import {
    getQueuedNotifications,
    removeQueuedNotification,
    type DhebuNotificationEvent,
} from "@/modules/dhebu-notifications";
import { handleNotificationEvent } from "@/tasks/notification-task";

type ProcessableNotification = DhebuNotificationEvent & {
  queueId?: string;
};

const MAX_COMPLETED_IDENTITIES = 500;

/*
 * One promise per native notification identity.
 *
 * If the live listener and a queue drain receive the same notification at
 * the same time, both callers await this one promise instead of parsing and
 * inserting the transaction twice.
 */
const processingByIdentity = new Map<string, Promise<boolean>>();

/*
 * Remember recently completed notifications for the lifetime of the current
 * JavaScript process. This closes the small gap between successful SQLite
 * processing and removal of the native queued copy.
 */
const completedIdentities = new Set<string>();

/*
 * Startup, AppState resume, and Home manual refresh can all request a queue
 * drain. They share this promise so only one full drain runs at a time.
 */
let activeDrain: Promise<void> | null = null;

function getNotificationText(event: ProcessableNotification): string {
  return event.bigText?.trim() || event.text?.trim() || "";
}

function getNotificationIdentity(event: ProcessableNotification): string {
  const postedAt =
    typeof event.postedAt === "number" ? String(event.postedAt) : "unknown";

  if (event.notificationKey) {
    return [event.app, event.notificationKey, postedAt].join("|");
  }

  if (event.queueId) {
    return `queue|${event.queueId}`;
  }

  return [
    event.app,
    postedAt,
    event.title ?? "",
    getNotificationText(event),
  ].join("|");
}

function rememberCompletedIdentity(identity: string): void {
  completedIdentities.add(identity);

  while (completedIdentities.size > MAX_COMPLETED_IDENTITIES) {
    const oldestIdentity = completedIdentities.values().next().value;

    if (typeof oldestIdentity !== "string") {
      break;
    }

    completedIdentities.delete(oldestIdentity);
  }
}

async function acknowledgeQueuedCopy(
  event: ProcessableNotification,
): Promise<void> {
  if (!event.queueId) {
    return;
  }

  const removed = await removeQueuedNotification(event.queueId);

  if (__DEV__) {
    console.log("DHEBU: native queue acknowledged", {
      queueId: event.queueId,
      removed,
    });
  }
}

async function runNotificationPipeline(
  event: ProcessableNotification,
): Promise<boolean> {
  if (__DEV__) {
    console.log("DHEBU: processing notification", {
      queueId: event.queueId,
      app: event.app,
      appLabel: event.appLabel,
      postedAt: event.postedAt,
      hasTitle: Boolean(event.title?.trim()),
      textLength: getNotificationText(event).length,
    });
  }

  return handleNotificationEvent({
    app: event.app,
    appLabel: event.appLabel,
    title: event.title ?? "",
    text: getNotificationText(event),
    postedAt: typeof event.postedAt === "number" ? event.postedAt : undefined,
  });
}

/**
 * The single entry point for both live native events and queued events.
 */
export async function processNativeNotification(
  event: ProcessableNotification,
): Promise<boolean> {
  const identity = getNotificationIdentity(event);

  if (completedIdentities.has(identity)) {
    if (__DEV__) {
      console.log("DHEBU: skipped already processed native notification", {
        identity,
        queueId: event.queueId,
      });
    }

    await acknowledgeQueuedCopy(event);
    return true;
  }

  let processing = processingByIdentity.get(identity);
  let ownsProcessingPromise = false;

  if (!processing) {
    processing = runNotificationPipeline(event);
    processingByIdentity.set(identity, processing);
    ownsProcessingPromise = true;
  } else if (__DEV__) {
    console.log("DHEBU: joined in-flight notification processing", {
      identity,
      queueId: event.queueId,
    });
  }

  try {
    const handled = await processing;

    if (handled) {
      rememberCompletedIdentity(identity);
      await acknowledgeQueuedCopy(event);
    }

    return handled;
  } finally {
    if (ownsProcessingPromise) {
      processingByIdentity.delete(identity);
    }
  }
}

async function runQueueDrain(): Promise<void> {
  const queuedNotifications = await getQueuedNotifications();

  if (__DEV__) {
    console.log("DHEBU: draining native queue", {
      count: queuedNotifications.length,
    });
  }

  for (const event of queuedNotifications) {
    try {
      await processNativeNotification(event);
    } catch (error) {
      /*
       * Leave this native queued item intact and continue with the others.
       * The failed item can be retried on the next startup/resume/refresh.
       */
      console.error("DHEBU: failed processing native queued notification", {
        queueId: event.queueId,
        error,
      });
    }
  }
}

/**
 * Shared queue drain used by startup, AppState resume, and Home refresh.
 */
export function drainNativeNotificationQueue(): Promise<void> {
  if (activeDrain) {
    if (__DEV__) {
      console.log("DHEBU: joined existing native queue drain");
    }

    return activeDrain;
  }

  activeDrain = runQueueDrain().finally(() => {
    activeDrain = null;
  });

  return activeDrain;
}
