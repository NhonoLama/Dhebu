import { Pressable, ScrollView, StyleSheet, Text } from "react-native";

import { ColorScheme, Radii, Spacing } from "@/constants/theme";
import { useTheme } from "@/theme/theme-context";

// A curated set — enough variety without an overwhelming full emoji keyboard.
const EMOJI_OPTIONS = [
  "🙂",
  "😎",
  "🤓",
  "🥳",
  "😇",
  "🤠",
  "🧑‍💼",
  "🧑‍🎓",
  "🦊",
  "🐱",
  "🐶",
  "🐼",
  "🦁",
  "🐯",
  "🐨",
  "🐸",
  "🌟",
  "🔥",
  "⚡",
  "🌈",
  "🍀",
  "🌸",
  "🎯",
  "💎",
];

interface EmojiPickerProps {
  value: string;
  onChange: (emoji: string) => void;
}

export function EmojiPicker({ value, onChange }: EmojiPickerProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {EMOJI_OPTIONS.map((emoji) => {
        const isSelected = emoji === value;
        return (
          <Pressable
            key={emoji}
            onPress={() => onChange(emoji)}
            style={[styles.chip, isSelected && styles.chipSelected]}
          >
            <Text style={styles.emoji}>{emoji}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      gap: Spacing.two,
      paddingVertical: Spacing.two,
    },
    chip: {
      width: 48,
      height: 48,
      borderRadius: Radii.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    emoji: { fontSize: 22 },
  });
}
