import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { AvatarId } from "@/constants/avatars";
import { AVATARS } from "@/constants/avatars";

import { ColorScheme, Fonts, Radii, Spacing } from "@/constants/theme";

import { useTheme } from "@/theme/theme-context";

interface AvatarPickerProps {
  visible: boolean;
  value: string;
  onClose: () => void;
  onChange: (avatarId: AvatarId) => void;
}

export function AvatarPicker({
  visible,
  value,
  onClose,
  onChange,
}: AvatarPickerProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  function handleSelect(avatarId: AvatarId) {
    onChange(avatarId);
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Choose Avatar</Text>

            <Text style={styles.subtitle}>
              Pick a profile picture for Dhebu.
            </Text>
          </View>

          <Pressable onPress={onClose}>
            <Text style={styles.done}>Done</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
        >
          {AVATARS.map((avatar) => {
            const selected = avatar.id === value;

            return (
              <Pressable
                key={avatar.id}
                onPress={() => handleSelect(avatar.id)}
                style={[
                  styles.avatarButton,
                  selected && styles.avatarButtonSelected,
                ]}
              >
                <Image
                  source={avatar.source}
                  style={styles.avatarImage}
                  resizeMode="contain"
                />

                {selected && (
                  <View style={styles.selectedBadge}>
                    <Text style={styles.selectedBadgeText}>✓</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },

    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: Spacing.four,
      paddingVertical: Spacing.three,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },

    title: {
      fontFamily: Fonts.bold,
      fontSize: 20,
      color: colors.ink,
    },

    subtitle: {
      fontFamily: Fonts.regular,
      fontSize: 12,
      color: colors.muted,
      marginTop: 2,
    },

    done: {
      fontFamily: Fonts.semiBold,
      color: colors.primary,
    },

    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      padding: Spacing.four,
      gap: Spacing.three,
    },

    avatarButton: {
      width: "22%",
      aspectRatio: 1,
      borderRadius: Radii.large,
      backgroundColor: colors.surface,
      borderWidth: 2,
      borderColor: "transparent",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      position: "relative",
    },

    avatarButtonSelected: {
      borderColor: colors.primary,
    },

    avatarImage: {
      width: "86%",
      height: "86%",
    },

    selectedBadge: {
      position: "absolute",
      right: 4,
      top: 4,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },

    selectedBadgeText: {
      color: colors.white,
      fontFamily: Fonts.bold,
      fontSize: 12,
    },
  });
}
