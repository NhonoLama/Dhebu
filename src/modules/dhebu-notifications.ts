import { requireNativeModule } from "expo-modules-core";

export interface DhebuNotificationEvent {
  queueId: string;

  app: string;
  appLabel: string;

  title: string;
  text: string;
  bigText: string;
  subText: string;

  postedAt: number;

  notificationKey: string;
}

export interface DhebuQueuedNotification extends DhebuNotificationEvent {
  queuedAt: number;
}

export interface DhebuInstalledApp {
  packageName: string;
  appLabel: string;
}

type NotificationSubscription = {
  remove: () => void;
};

type DhebuNotificationsNativeModule = {
  isNotificationAccessGrantedAsync(): Promise<boolean>;

  openNotificationAccessSettingsAsync(): Promise<boolean>;

  getInstalledAppsAsync(): Promise<DhebuInstalledApp[]>;

  getAllowedNotificationAppsAsync(): Promise<string[]>;

  setAllowedNotificationAppsAsync(packages: string[]): Promise<boolean>;

  /*
   * Persistent native notification queue.
   */
  getQueuedNotificationsAsync(): Promise<DhebuQueuedNotification[]>;

  removeQueuedNotificationAsync(queueId: string): Promise<boolean>;

  addListener(
    eventName: "onNotificationReceived",
    listener: (event: DhebuNotificationEvent) => void,
  ): NotificationSubscription;
};

const DhebuNotifications =
  requireNativeModule<DhebuNotificationsNativeModule>("DhebuNotifications");

export async function isNotificationAccessGranted(): Promise<boolean> {
  return DhebuNotifications.isNotificationAccessGrantedAsync();
}

export async function openNotificationAccessSettings(): Promise<boolean> {
  return DhebuNotifications.openNotificationAccessSettingsAsync();
}

export async function getInstalledApps(): Promise<DhebuInstalledApp[]> {
  return DhebuNotifications.getInstalledAppsAsync();
}

export async function getAllowedNotificationApps(): Promise<string[]> {
  return DhebuNotifications.getAllowedNotificationAppsAsync();
}

export async function setAllowedNotificationApps(
  packages: string[],
): Promise<boolean> {
  return DhebuNotifications.setAllowedNotificationAppsAsync(packages);
}

/*
 * Read notifications that Android saved while
 * JavaScript was unavailable, or that have not
 * yet been acknowledged by JavaScript.
 */
export async function getQueuedNotifications(): Promise<
  DhebuQueuedNotification[]
> {
  return DhebuNotifications.getQueuedNotificationsAsync();
}

/*
 * Acknowledge a native notification after JS
 * has successfully dealt with it.
 */
export async function removeQueuedNotification(
  queueId: string,
): Promise<boolean> {
  return DhebuNotifications.removeQueuedNotificationAsync(queueId);
}

export function addNotificationListener(
  listener: (event: DhebuNotificationEvent) => void,
): NotificationSubscription {
  return DhebuNotifications.addListener("onNotificationReceived", listener);
}
