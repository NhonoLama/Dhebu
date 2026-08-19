import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from "@expo-google-fonts/poppins";

import {
  addNotificationListener,
  getInstalledApps,
  type DhebuNotificationEvent,
} from "@/modules/dhebu-notifications";

import { useFonts } from "expo-font";
import { router, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";

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

  /*
   * Native Android notification pipeline.
   *
   * - receives notifications from Kotlin
   * - removes duplicate Android callbacks
   * - forwards unique notifications to the transaction detector
   */
  useEffect(() => {
    console.log("DHEBU: registering notification listener");

    const subscription = addNotificationListener(
      (event: DhebuNotificationEvent) => {
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

        if (previousTime !== undefined && now - previousTime < 5000) {
          console.log("DHEBU: duplicate notification ignored", {
            app: event.app,
            title: event.title,
            dedupeKey,
          });

          return;
        }

        recentNotificationKeysRef.current.set(dedupeKey, now);

        for (const [key, timestamp] of recentNotificationKeysRef.current) {
          if (now - timestamp > 30000) {
            recentNotificationKeysRef.current.delete(key);
          }
        }

        console.log("DHEBU UNIQUE NOTIFICATION:", event);

        const bestText = event.bigText?.trim() || event.text?.trim() || "";

        console.log(
          "DHEBU: forwarding unique notification to transaction pipeline",
          {
            app: event.app,
            appLabel: event.appLabel,
            title: event.title,
            text: bestText,
          },
        );

        void handleNotificationEvent({
          app: event.app,
          appLabel: event.appLabel,
          title: event.title ?? "",
          text: bestText,
        });
      },
    );

    return () => {
      console.log("DHEBU: removing notification listener");
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const apps = await getInstalledApps();

        console.log("DHEBU INSTALLED APPS:", apps);
      } catch (error) {
        console.error("DHEBU: failed to load installed apps", error);
      }
    })();
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
