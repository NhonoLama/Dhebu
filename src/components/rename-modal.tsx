import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Colors, Fonts, Radii, Spacing } from "@/constants/theme";

interface RenameModalProps {
  visible: boolean;
  title: string;
  initialValue: string;
  onCancel: () => void;
  onSubmit: (value: string) => void;
}

export function RenameModal({
  visible,
  title,
  initialValue,
  onCancel,
  onSubmit,
}: RenameModalProps) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (visible) setValue(initialValue);
  }, [visible, initialValue]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={setValue}
            autoFocus
            selectTextOnFocus
          />
          <View style={styles.buttonRow}>
            <Pressable style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={styles.confirmBtn}
              onPress={() => {
                if (value.trim()) onSubmit(value.trim());
              }}
            >
              <Text style={styles.confirmText}>Save</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "#00000055",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.five,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: Colors.surface,
    borderRadius: Radii.large,
    padding: Spacing.four,
  },
  title: {
    fontFamily: Fonts.semiBold,
    fontSize: 18,
    color: Colors.ink,
    marginBottom: Spacing.three,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.medium,
    padding: Spacing.three,
    fontFamily: Fonts.regular,
    color: Colors.ink,
    marginBottom: Spacing.four,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: Spacing.three,
  },
  cancelBtn: { paddingVertical: Spacing.two, paddingHorizontal: Spacing.three },
  cancelText: { fontFamily: Fonts.medium, color: Colors.muted },
  confirmBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Radii.medium,
  },
  confirmText: { fontFamily: Fonts.semiBold, color: Colors.white },
});
