import { AppRegistry } from "react-native";
import { RNAndroidNotificationListenerHeadlessJsName } from "react-native-android-notification-listener";

import { handleNotificationEvent } from "./src/tasks/notification-task";

AppRegistry.registerHeadlessTask(
  RNAndroidNotificationListenerHeadlessJsName,
  () => handleNotificationEvent,
);

// Hand off to Expo Router's normal app startup.
import "expo-router/entry";
