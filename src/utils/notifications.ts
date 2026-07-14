import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";

/**
 * True when running inside the generic Expo Go app (not a custom dev/prod build).
 * expo-notifications crashes on import in Expo Go on Android since SDK 53 —
 * we check this BEFORE ever touching that module.
 */
export const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export async function ensureNotificationPermission(): Promise<boolean> {
  if (isExpoGo) return false;

  const Notifications = await import("expo-notifications");
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export async function scheduleReminder(
  title: string,
  body: string,
  fireDate: Date,
): Promise<string | null> {
  if (isExpoGo) return null;

  const Notifications = await import("expo-notifications");

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("reminders", {
      name: "Reminders",
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  return Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: fireDate,
    },
  });
}

export async function cancelReminder(notificationId: string): Promise<void> {
  if (isExpoGo) return;
  const Notifications = await import("expo-notifications");
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}
