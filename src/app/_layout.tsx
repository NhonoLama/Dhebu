import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from "@expo-google-fonts/poppins";

import {
  addNotificationListener,
  getQueuedNotifications,
  removeQueuedNotification,
  type DhebuNotificationEvent,
  type DhebuQueuedNotification,
} from "@/modules/dhebu-notifications";

import { useFonts } from "expo-font";
import { router, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, View } from "react-native";

import { Colors } from "@/constants/theme";

import { handleNotificationEvent } from "@/tasks/notification-task";

import { getUserProfile } from "@/repositories/user-profile.repo";
import { useLedgerStore } from "@/stores/useLedgerStore";
import { ThemeProvider } from "@/theme/theme-context";
import { currentMonthRange } from "@/utils/date";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);

  const init = useLedgerStore((s) => s.init);
  const refresh = useLedgerStore((s) => s.refresh);

  const recentNotificationKeysRef = useRef<Map<string, number>>(new Map());

  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  async function processNotification(
    event: DhebuNotificationEvent | DhebuQueuedNotification,
  ) {
    const now = Date.now();

    const dedupeKey = [
      event.app,
      event.title,
      event.text,
      event.bigText,
      event.subText,
    ]
      .map((value) => value?.trim().toLowerCase() ?? "")
      .join("|");

    const previousTime = recentNotificationKeysRef.current.get(dedupeKey);

    if (previousTime !== undefined && now - previousTime < 1500) {
      console.log("DHEBU: duplicate notification ignored", {
        app: event.app,
        title: event.title,
        dedupeKey,
      });

      if (event.queueId) {
        await removeQueuedNotification(event.queueId);
      }

      return;
    }

    recentNotificationKeysRef.current.set(dedupeKey, now);

    for (const [key, timestamp] of recentNotificationKeysRef.current) {
      if (now - timestamp > 30000) {
        recentNotificationKeysRef.current.delete(key);
      }
    }

    const bestText = event.bigText?.trim() || event.text?.trim() || "";

    console.log("DHEBU: processing notification", {
      queueId: event.queueId,
      app: event.app,
      appLabel: event.appLabel,
      title: event.title,
      text: bestText,
    });

    const handled = await handleNotificationEvent({
      app: event.app,
      appLabel: event.appLabel,
      title: event.title ?? "",
      text: bestText,
    });

    if (handled && event.queueId) {
      const removed = await removeQueuedNotification(event.queueId);

      console.log("DHEBU: native queue acknowledged", {
        queueId: event.queueId,
        removed,
      });
    }

    if (!handled) {
      console.log("DHEBU: notification kept in native queue for retry", {
        queueId: event.queueId,
      });
    }
  }

  async function drainNativeNotificationQueue() {
    try {
      const queued = await getQueuedNotifications();

      console.log("DHEBU: draining native queue", {
        count: queued.length,
      });

      for (const event of queued) {
        await processNotification(event);
      }
    } catch (error) {
      console.error("DHEBU: failed draining native notification queue", error);
    }
  }

  /*
   * Native Android notification pipeline.
   *
   * - receives notifications from Kotlin
   * - removes duplicate Android callbacks
   * - forwards unique notifications to the transaction detector
   */
  useEffect(() => {
    console.log("DHEBU: registering notification listener");

    /*
     * Process notifications that Android may have
     * saved before the JavaScript runtime became ready.
     */
    void drainNativeNotificationQueue();

    /*
     * Receive new live notifications while JS is active.
     */
    const subscription = addNotificationListener(
      (event: DhebuNotificationEvent) => {
        void processNotification(event);
      },
    );

    return () => {
      console.log("DHEBU: removing notification listener");

      subscription.remove();
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        console.log(
          "DHEBU: app became active, checking native notification queue",
        );

        void drainNativeNotificationQueue();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  /*
   * Initialize database + application data.
   */
  useEffect(() => {
    (async () => {
      try {
        await init();

        const { start, end } = currentMonthRange();

        await refresh(start, end);

        const profile = await getUserProfile();

        if (!profile) {
          router.replace("/onboarding" as any);
        }
      } finally {
        setDbReady(true);
      }
    })();
  }, [init, refresh]);

  /*
   * Hide splash screen once both
   * DB and fonts are ready.
   */
  useEffect(() => {
    if (dbReady && fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [dbReady, fontsLoaded]);

  if (!dbReady || !fontsLoaded) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: Colors.background,
        }}
      >
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  return (
    <ThemeProvider>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="(tabs)" />

        <Stack.Screen name="onboarding" />
      </Stack>
    </ThemeProvider>
  );
}
