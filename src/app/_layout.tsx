import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from "@expo-google-fonts/poppins";

import { addNotificationListener } from "@/modules/dhebu-notifications";

import { useFonts } from "expo-font";
import { router, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { ActivityIndicator, AppState, View } from "react-native";

import { Colors } from "@/constants/theme";
import { getUserProfile } from "@/repositories/user-profile.repo";
import { useLedgerStore } from "@/stores/useLedgerStore";
import {
  drainNativeNotificationQueue,
  processNativeNotification,
} from "@/tasks/notification-queue";
import { ThemeProvider } from "@/theme/theme-context";
import { currentMonthRange } from "@/utils/date";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);

  const init = useLedgerStore((s) => s.init);
  const refresh = useLedgerStore((s) => s.refresh);

  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

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
   * Centralized native Android notification pipeline.
   *
   * Startup queue recovery, live notifications, app resume,
   * and Home manual refresh all use the same processor from
   * notification-queue.ts.
   *
   * This effect waits for SQLite initialization before
   * processing notifications.
   */
  useEffect(() => {
    if (!dbReady) {
      return;
    }

    if (__DEV__) {
      console.log("DHEBU: registering centralized notification listener");
    }

    /*
     * Receive new live notifications while
     * JavaScript is active.
     */
    const notificationSubscription = addNotificationListener((event) => {
      void processNativeNotification(event).catch((error) => {
        console.error("DHEBU: live notification processing failed", error);
      });
    });

    /*
     * Recover native notifications that arrived before
     * JavaScript and SQLite became ready.
     */
    void drainNativeNotificationQueue().catch((error) => {
      console.error("DHEBU: startup native queue drain failed", error);
    });

    /*
     * Check the persistent native queue whenever
     * the app returns to the foreground.
     */
    const appStateSubscription = AppState.addEventListener(
      "change",
      (state) => {
        if (state !== "active") {
          return;
        }

        if (__DEV__) {
          console.log(
            "DHEBU: app became active, checking native notification queue",
          );
        }

        void drainNativeNotificationQueue().catch((error) => {
          console.error("DHEBU: resume native queue drain failed", error);
        });
      },
    );

    return () => {
      if (__DEV__) {
        console.log("DHEBU: removing centralized notification listener");
      }

      notificationSubscription.remove();
      appStateSubscription.remove();
    };
  }, [dbReady]);

  /*
   * Hide splash screen once both the
   * database and fonts are ready.
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
