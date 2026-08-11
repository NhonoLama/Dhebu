import { Ionicons } from "@expo/vector-icons";
import type { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import { useEffect, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  ColorScheme,
  createShadows,
  Fonts,
  Radii,
  Spacing,
} from "@/constants/theme";
import { useTheme } from "@/theme/theme-context";

type BottomTabBarProps = ComponentProps<typeof Tabs>["tabBar"] extends
  | ((props: infer P) => any)
  | undefined
  ? P
  : never;

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  index: "home",
  transactions: "list",
  add: "add",
  profile: "person",
  calendar: "calendar",
  settings: "settings",
};

const LABELS: Record<string, string> = {
  index: "Home",
  transactions: "History",
  add: "Add",
  profile: "Profile",
  calendar: "Calendar",
  settings: "Settings",
};

const RAISED_ROUTE = "add";

export function FloatingTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { colors, shadows } = useTheme();
  const styles = useMemo(
    () => createStyles(colors, shadows),
    [colors, shadows],
  );

  return (
    <View
      style={[styles.wrapper, { paddingBottom: insets.bottom || Spacing.two }]}
    >
      <View style={[styles.bar]}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const iconName = ICONS[route.name] ?? "ellipse";
          const label = LABELS[route.name] ?? route.name;

          function handlePress() {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          }

          if (route.name === RAISED_ROUTE) {
            return (
              <View key={route.key} style={styles.raisedSlot}>
                <RaisedButton
                  onPress={handlePress}
                  iconName={iconName}
                  styles={styles}
                />
              </View>
            );
          }

          return (
            <Pressable key={route.key} onPress={handlePress} style={styles.tab}>
              <Ionicons
                name={iconName}
                size={20}
                color={isFocused ? colors.primary : colors.muted}
              />
              <Text
                style={[styles.label, isFocused && styles.labelActive]}
                numberOfLines={1}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function RaisedButton({
  onPress,
  iconName,
  styles,
}: {
  onPress: () => void;
  iconName: keyof typeof Ionicons.glyphMap;
  styles: ReturnType<typeof createStyles>;
}) {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 12, stiffness: 220 });
  }, [scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.9, { damping: 12, stiffness: 220 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 12, stiffness: 220 });
      }}
    >
      <Animated.View
        style={[styles.raisedButton, styles.raisedShadow, animatedStyle]}
      >
        <Ionicons
          name={iconName}
          size={26}
          color={styles.raisedIconColor.color}
        />
      </Animated.View>
    </Pressable>
  );
}

function createStyles(
  colors: ColorScheme,
  shadows: ReturnType<typeof createShadows>,
) {
  return StyleSheet.create({
    wrapper: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: "center",
      paddingHorizontal: Spacing.four,
    },
    bar: {
      flexDirection: "row",
      width: "100%",
      backgroundColor: colors.surface,
      borderRadius: Radii.pill,
      paddingTop: Spacing.two,
      paddingBottom: Spacing.two,
      paddingHorizontal: Spacing.two,
      justifyContent: "space-between",
      alignItems: "center",
      ...shadows.soft,
    },
    tab: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 2,
      paddingVertical: Spacing.one,
    },
    label: {
      fontFamily: Fonts.medium,
      fontSize: 10,
      color: colors.muted,
    },
    labelActive: {
      color: colors.primary,
      fontFamily: Fonts.semiBold,
    },
    raisedSlot: {
      flex: 1,
      alignItems: "center",
      justifyContent: "flex-start",
    },
    raisedButton: {
      width: 56,
      height: 56,
      borderRadius: Radii.pill,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      marginTop: -28, // pulls it up so it visually pops above the bar
      borderWidth: 4,
      borderColor: colors.background, // creates the "cut-out" ring effect around it
    },
    raisedShadow: { ...shadows.soft },
    raisedIconColor: { color: colors.white },
  });
}
