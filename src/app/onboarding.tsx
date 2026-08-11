import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmojiPicker } from "@/components/emoji-picker";
import { ColorScheme, Fonts, Radii, Spacing } from "@/constants/theme";
import { createUserProfile } from "@/repositories/user-profile.repo";
import { useTheme } from "@/theme/theme-context";

const CURRENCY_OPTIONS = ["NPR", "INR", "USD", "EUR", "GBP"];

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("NPR");
  const [avatarEmoji, setAvatarEmoji] = useState("🙂");
  const [submitting, setSubmitting] = useState(false);

  async function handleGetStarted() {
    if (!name.trim()) {
      Alert.alert("Name required", "Enter your name to continue.");
      return;
    }
    setSubmitting(true);
    try {
      await createUserProfile({ name: name.trim(), currency, avatarEmoji });
      router.replace("/(tabs)");
    } catch {
      Alert.alert("Error", "Could not save your profile. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.heading}>Welcome to Dhebu</Text>
        <Text style={styles.subheading}>
          Let's set up your profile — this stays on your device.
        </Text>

        <Text style={styles.label}>Your Avatar</Text>
        <View style={styles.avatarPreview}>
          <Text style={styles.avatarPreviewEmoji}>{avatarEmoji}</Text>
        </View>
        <EmojiPicker value={avatarEmoji} onChange={setAvatarEmoji} />

        <Text style={styles.label}>Your Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Dawa"
          placeholderTextColor={colors.muted}
          autoFocus
        />

        <Text style={styles.label}>Preferred Currency</Text>
        <View style={styles.currencyRow}>
          {CURRENCY_OPTIONS.map((c) => {
            const isSelected = c === currency;
            return (
              <Pressable
                key={c}
                onPress={() => setCurrency(c)}
                style={[
                  styles.currencyChip,
                  isSelected && styles.currencyChipSelected,
                ]}
              >
                <Text
                  style={
                    isSelected
                      ? { color: colors.white, fontFamily: Fonts.semiBold }
                      : { color: colors.ink }
                  }
                >
                  {c}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          style={[styles.submitButton, submitting && { opacity: 0.6 }]}
          onPress={handleGetStarted}
          disabled={submitting}
        >
          <Text style={styles.submitText}>
            {submitting ? "Setting up…" : "Get Started"}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: {
      paddingHorizontal: Spacing.four,
      paddingTop: Spacing.six,
      paddingBottom: Spacing.six,
    },
    heading: { fontFamily: Fonts.bold, fontSize: 26, color: colors.ink },
    subheading: {
      fontFamily: Fonts.regular,
      fontSize: 14,
      color: colors.muted,
      marginTop: Spacing.two,
      marginBottom: Spacing.six,
    },
    label: {
      fontFamily: Fonts.semiBold,
      fontSize: 13,
      color: colors.muted,
      marginBottom: Spacing.two,
      marginTop: Spacing.four,
    },
    avatarPreview: {
      width: 72,
      height: 72,
      borderRadius: Radii.pill,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "center",
      marginBottom: Spacing.three,
    },
    avatarPreviewEmoji: { fontSize: 36 },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radii.medium,
      padding: Spacing.three,
      fontFamily: Fonts.regular,
      color: colors.ink,
      backgroundColor: colors.surface,
      fontSize: 16,
    },
    currencyRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },
    currencyChip: {
      paddingHorizontal: Spacing.four,
      paddingVertical: Spacing.two,
      borderRadius: Radii.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    currencyChipSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    submitButton: {
      backgroundColor: colors.primary,
      borderRadius: Radii.medium,
      paddingVertical: Spacing.four,
      alignItems: "center",
      marginTop: Spacing.six,
    },
    submitText: { color: colors.white, fontFamily: Fonts.bold, fontSize: 16 },
  });
}
