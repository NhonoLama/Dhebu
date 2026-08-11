import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from "@expo-google-fonts/poppins";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { router } from "expo-router";

import { Colors } from "@/constants/theme";
import { getUserProfile } from "@/repositories/user-profile.repo";
import { useLedgerStore } from "@/stores/useLedgerStore";
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
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" />
      </Stack>
    </ThemeProvider>
  );
}
