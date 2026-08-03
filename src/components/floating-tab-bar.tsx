import { Ionicons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors, Fonts, Radii, Shadows, Spacing } from "@/constants/theme";

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  index: "bar-chart",
  transactions: "list",
  add: "add-circle",
  reports: "pie-chart",
  calendar: "calendar",
  settings: "settings",
};

export function FloatingTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrapper, { bottom: insets.bottom + Spacing.two }]}>
      <View style={[styles.bar, Shadows.soft]}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;
          const iconName = ICONS[route.name] ?? "ellipse";

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

          return (
            <Pressable key={route.key} onPress={handlePress} style={styles.tab}>
              <AnimatedIconWrap isFocused={isFocused} iconName={iconName} />
              {isFocused && (
                <Text style={styles.label} numberOfLines={1}>
                  {String(options.title ?? route.name)}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function AnimatedIconWrap({
  isFocused,
  iconName,
}: {
  isFocused: boolean;
  iconName: keyof typeof Ionicons.glyphMap;
}) {
  const scale = useSharedValue(isFocused ? 1 : 0.9);

  useEffect(() => {
    scale.value = withSpring(isFocused ? 1.1 : 0.9, {
      damping: 10,
      stiffness: 200,
    });
  }, [isFocused, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.iconWrap,
        isFocused && styles.iconWrapActive,
        animatedStyle,
      ]}
    >
      <Ionicons
        name={iconName}
        size={20}
        color={isFocused ? Colors.white : Colors.muted}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: Spacing.four,
    right: Spacing.four,
  },
  bar: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderRadius: Radii.pill,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    justifyContent: "space-between",
    alignItems: "center",
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.one,
    paddingVertical: Spacing.one,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: Radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapActive: {
    backgroundColor: Colors.primary,
  },
  label: {
    fontFamily: Fonts.semiBold,
    fontSize: 12,
    color: Colors.primary,
  },
});
