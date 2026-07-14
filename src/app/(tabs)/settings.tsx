import { useState } from "react";
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

import { RenameModal } from "@/components/rename-modal";
import { Colors, Fonts, Radii, Spacing } from "@/constants/theme";
import type { Account, Category } from "@/db/types";
import { createAccount } from "@/repositories/accounts.repo";
import { useLedgerStore } from "@/stores/useLedgerStore";

type EditTarget =
  | { kind: "account"; item: Account }
  | { kind: "category"; item: Category }
  | null;

export default function SettingsScreen() {
  const accounts = useLedgerStore((s) => s.accounts);
  const categories = useLedgerStore((s) => s.categories);
  const init = useLedgerStore((s) => s.init);
  const renameAccount = useLedgerStore((s) => s.renameAccount);
  const removeAccount = useLedgerStore((s) => s.removeAccount);
  const renameCategory = useLedgerStore((s) => s.renameCategory);
  const removeCategory = useLedgerStore((s) => s.removeCategory);
  const addCategory = useLedgerStore((s) => s.addCategory);

  const [newAccountName, setNewAccountName] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryType, setNewCategoryType] = useState<"income" | "expense">(
    "expense",
  );
  const [editTarget, setEditTarget] = useState<EditTarget>(null);

  async function handleAddAccount() {
    if (!newAccountName.trim()) return;
    await createAccount({ name: newAccountName.trim(), type: "other" });
    setNewAccountName("");
    await init();
  }

  function handleDeleteAccount(account: Account) {
    Alert.alert(
      `Delete "${account.name}"?`,
      "Any transactions on this account will also be removed. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => removeAccount(account.id),
        },
      ],
    );
  }

  function handleDeleteCategory(category: Category) {
    Alert.alert(`Delete "${category.name}"?`, "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await removeCategory(category.id);
          } catch {
            Alert.alert(
              "Cannot delete",
              "This category still has transactions recorded against it.",
            );
          }
        },
      },
    ]);
  }

  async function handleAddCategory() {
    if (!newCategoryName.trim()) return;
    await addCategory({ name: newCategoryName.trim(), type: newCategoryType });
    setNewCategoryName("");
  }

  async function handleRenameSubmit(value: string) {
    if (!editTarget) return;
    if (editTarget.kind === "account") {
      await renameAccount(editTarget.item.id, value);
    } else {
      await renameCategory(editTarget.item.id, value);
    }
    setEditTarget(null);
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.heading}>Settings</Text>

        <Text style={styles.sectionTitle}>Accounts</Text>
        {accounts.map((a) => (
          <View key={a.id} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>{a.name}</Text>
              <Text style={styles.rowSub}>{a.type}</Text>
            </View>
            <Pressable
              onPress={() => setEditTarget({ kind: "account", item: a })}
              style={styles.iconBtn}
            >
              <Text style={styles.iconBtnText}>Edit</Text>
            </Pressable>
            <Pressable
              onPress={() => handleDeleteAccount(a)}
              style={styles.iconBtn}
            >
              <Text style={[styles.iconBtnText, { color: Colors.expense }]}>
                Delete
              </Text>
            </Pressable>
          </View>
        ))}
        <View style={styles.addRow}>
          <TextInput
            style={styles.input}
            placeholder="New account name"
            placeholderTextColor={Colors.muted}
            value={newAccountName}
            onChangeText={setNewAccountName}
          />
          <Pressable style={styles.addButton} onPress={handleAddAccount}>
            <Text style={styles.addButtonText}>Add</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Categories</Text>
        {categories.map((c) => (
          <View key={c.id} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>{c.name}</Text>
              <Text style={styles.rowSub}>{c.type}</Text>
            </View>
            <Pressable
              onPress={() => setEditTarget({ kind: "category", item: c })}
              style={styles.iconBtn}
            >
              <Text style={styles.iconBtnText}>Edit</Text>
            </Pressable>
            <Pressable
              onPress={() => handleDeleteCategory(c)}
              style={styles.iconBtn}
            >
              <Text style={[styles.iconBtnText, { color: Colors.expense }]}>
                Delete
              </Text>
            </Pressable>
          </View>
        ))}

        <View style={styles.typeToggleRow}>
          {(["expense", "income"] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => setNewCategoryType(t)}
              style={[
                styles.typeChip,
                newCategoryType === t && {
                  backgroundColor:
                    t === "income" ? Colors.income : Colors.expense,
                },
              ]}
            >
              <Text
                style={
                  newCategoryType === t
                    ? { color: Colors.white, fontFamily: Fonts.semiBold }
                    : { color: Colors.muted }
                }
              >
                {t === "income" ? "Income" : "Expense"}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.addRow}>
          <TextInput
            style={styles.input}
            placeholder="New category name"
            placeholderTextColor={Colors.muted}
            value={newCategoryName}
            onChangeText={setNewCategoryName}
          />
          <Pressable style={styles.addButton} onPress={handleAddCategory}>
            <Text style={styles.addButtonText}>Add</Text>
          </Pressable>
        </View>

        <RenameModal
          visible={editTarget !== null}
          title={
            editTarget?.kind === "account"
              ? "Rename account"
              : "Rename category"
          }
          initialValue={editTarget?.item.name ?? ""}
          onCancel={() => setEditTarget(null)}
          onSubmit={handleRenameSubmit}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.six + 64 },
  heading: {
    fontFamily: Fonts.bold,
    fontSize: 24,
    color: Colors.ink,
    marginTop: Spacing.three,
    marginBottom: Spacing.four,
  },
  sectionTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: Colors.primary,
    marginTop: Spacing.five,
    marginBottom: Spacing.two,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    gap: Spacing.two,
  },
  rowLabel: { fontFamily: Fonts.medium, color: Colors.ink },
  rowSub: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.muted },
  iconBtn: { paddingHorizontal: Spacing.two, paddingVertical: Spacing.one },
  iconBtnText: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: Colors.primary,
  },
  addRow: { flexDirection: "row", gap: Spacing.two, marginTop: Spacing.three },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.medium,
    padding: Spacing.three,
    fontFamily: Fonts.regular,
    color: Colors.ink,
    backgroundColor: Colors.surface,
  },
  addButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radii.medium,
    paddingHorizontal: Spacing.four,
    justifyContent: "center",
  },
  addButtonText: { color: Colors.white, fontFamily: Fonts.semiBold },
  typeToggleRow: {
    flexDirection: "row",
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  typeChip: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Radii.pill,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
});
