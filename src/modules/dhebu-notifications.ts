import { requireNativeModule } from "expo-modules-core";

export interface DhebuNotificationEvent {
  app: string;
  appLabel: string;
  title: string;
  text: string;
  bigText: string;
  subText: string;
  postedAt: number;
  notificationKey: string;
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

  addListener(
    eventName: "onNotificationReceived",
    listener: (event: DhebuNotificationEvent) => void,
  ): NotificationSubscription;
};

const DhebuNotifications =
  requireNativeModule<DhebuNotificationsNativeModule>("DhebuNotifications");

/**
 * Check whether Android Notification Access
 * is enabled for Dhebu.
 */
export async function isNotificationAccessGranted(): Promise<boolean> {
  return DhebuNotifications.isNotificationAccessGrantedAsync();
}

/**
 * Open the Android Notification Access settings page.
 */
export async function openNotificationAccessSettings(): Promise<boolean> {
  return DhebuNotifications.openNotificationAccessSettingsAsync();
}

/**
 * Get launchable apps installed on the device.
 *
 * These are used by the Profile screen so the user
 * can choose which apps Dhebu is allowed to process.
 */
export async function getInstalledApps(): Promise<DhebuInstalledApp[]> {
  return DhebuNotifications.getInstalledAppsAsync();
}

/**
 * Get package names currently approved for
 * notification processing.
 *
 * Example:
 *
 * [
 *   "com.google.android.apps.messaging"
 * ]
 */
export async function getAllowedNotificationApps(): Promise<string[]> {
  return DhebuNotifications.getAllowedNotificationAppsAsync();
}

/**
 * Replace the complete allowed notification-app list.
 *
 * Example:
 *
 * await setAllowedNotificationApps([
 *   "com.google.android.apps.messaging",
 * ]);
 */
export async function setAllowedNotificationApps(
  packages: string[],
): Promise<boolean> {
  return DhebuNotifications.setAllowedNotificationAppsAsync(packages);
}

/**
 * Subscribe to notifications that have already passed
 * the native Kotlin package filter.
 */
export function addNotificationListener(
  listener: (event: DhebuNotificationEvent) => void,
): NotificationSubscription {
  return DhebuNotifications.addListener("onNotificationReceived", listener);
}
