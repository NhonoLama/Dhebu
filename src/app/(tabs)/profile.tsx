import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import RNAndroidNotificationListener from "react-native-android-notification-listener";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmojiPicker } from "@/components/emoji-picker";
import { RenameModal } from "@/components/rename-modal";
import {
  ColorScheme,
  Fonts,
  Radii,
  Spacing,
  TabBarClearance,
} from "@/constants/theme";
import { getDb } from "@/db/client";
import type { Account, Category } from "@/db/types";
import { createAccount } from "@/repositories/accounts.repo";
import {
  getAllTimeSummary,
  type AllTimeSummary,
} from "@/repositories/transactions.repo";
import {
  getUserProfile,
  updateUserProfile,
  type UserProfile,
} from "@/repositories/user-profile.repo";
import { useLedgerStore } from "@/stores/useLedgerStore";
import { ThemeMode, useTheme } from "@/theme/theme-context";
import { formatCurrency } from "@/utils/currency";
import { formatDisplayDate } from "@/utils/date";

interface NotificationApp {
  package_name: string;
  app_label: string;
  enabled: number;
}

type EditTarget =
  | { kind: "account"; item: Account }
  | { kind: "category"; item: Category }
  | null;

const THEME_OPTIONS: { mode: ThemeMode; label: string }[] = [
  { mode: "system", label: "System" },
  { mode: "light", label: "Light" },
  { mode: "dark", label: "Dark" },
];

const EMPTY_SUMMARY: AllTimeSummary = {
  income: 0,
  expense: 0,
  balance: 0,
  transactionCount: 0,
  earliestDate: null,
};

export default function ProfileScreen() {
  const { colors, mode, setMode } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const accounts = useLedgerStore((s) => s.accounts);
  const categories = useLedgerStore((s) => s.categories);
  const init = useLedgerStore((s) => s.init);
  const renameAccount = useLedgerStore((s) => s.renameAccount);
  const removeAccount = useLedgerStore((s) => s.removeAccount);
  const renameCategory = useLedgerStore((s) => s.renameCategory);
  const removeCategory = useLedgerStore((s) => s.removeCategory);
  const addCategory = useLedgerStore((s) => s.addCategory);

  const [summary, setSummary] = useState<AllTimeSummary>(EMPTY_SUMMARY);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");

  const [newAccountName, setNewAccountName] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryType, setNewCategoryType] = useState<"income" | "expense">(
    "expense",
  );
  const [editTarget, setEditTarget] = useState<EditTarget>(null);
  const [permissionStatus, setPermissionStatus] = useState<string>("unknown");
  const [notificationApps, setNotificationApps] = useState<NotificationApp[]>(
    [],
  );

  useFocusEffect(
    useCallback(() => {
      getAllTimeSummary().then(setSummary);
      getUserProfile().then((p) => {
        setProfile(p);
        if (p) setNameInput(p.name);
      });
    }, []),
  );

  async function handleSaveName() {
    if (!nameInput.trim()) return;
    await updateUserProfile({ name: nameInput.trim() });
    const updated = await getUserProfile();
    setProfile(updated);
    setEditingName(false);
  }

  async function handleChangeAvatar(emoji: string) {
    await updateUserProfile({ avatarEmoji: emoji });
    const updated = await getUserProfile();
    setProfile(updated);
  }

  async function loadNotificationSettings() {
    const status = await RNAndroidNotificationListener.getPermissionStatus();
    setPermissionStatus(status);
    const db = await getDb();
    const apps = await db.getAllAsync<NotificationApp>(
      "SELECT * FROM notification_apps ORDER BY app_label ASC;",
    );
    setNotificationApps(apps);
  }

  useEffect(() => {
    loadNotificationSettings();
  }, []);

  async function toggleApp(packageName: string, currentlyEnabled: number) {
    const db = await getDb();
    await db.runAsync(
      "UPDATE notification_apps SET enabled = ? WHERE package_name = ?;",
      [currentlyEnabled ? 0 : 1, packageName],
    );
    loadNotificationSettings();
  }

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
        <Text style={styles.heading}>Profile</Text>
        <Text style={styles.subheading}>
          Your all-time ledger, since day one
        </Text>

        <View style={styles.identityCard}>
          <View style={styles.identityAvatar}>
            <Text style={styles.identityEmoji}>
              {profile?.avatar_emoji ?? "🙂"}
            </Text>
          </View>
          {editingName ? (
            <View style={styles.nameEditRow}>
              <TextInput
                style={styles.nameInput}
                value={nameInput}
                onChangeText={setNameInput}
                autoFocus
              />
              <Pressable onPress={handleSaveName}>
                <Text style={styles.saveNameText}>Save</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={() => setEditingName(true)}>
              <Text style={styles.identityName}>{profile?.name ?? "—"}</Text>
              <Text style={styles.identityHint}>tap to edit name</Text>
            </Pressable>
          )}
          <EmojiPicker
            value={profile?.avatar_emoji ?? "🙂"}
            onChange={handleChangeAvatar}
          />
        </View>

        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Lifetime Balance</Text>
          <Text
            style={[
              styles.balanceValue,
              { color: summary.balance >= 0 ? colors.income : colors.expense },
            ]}
          >
            {formatCurrency(summary.balance)}
          </Text>
        </View>

        <View style={styles.rowPair}>
          <StatCard
            label="Total Income"
            value={formatCurrency(summary.income)}
            color={colors.income}
            styles={styles}
          />
          <StatCard
            label="Total Expense"
            value={formatCurrency(summary.expense)}
            color={colors.expense}
            styles={styles}
          />
        </View>
        <View style={styles.rowPair}>
          <StatCard
            label="Transactions Logged"
            value={String(summary.transactionCount)}
            color={colors.primary}
            styles={styles}
          />
          <StatCard
            label="Tracking Since"
            value={
              summary.earliestDate
                ? formatDisplayDate(summary.earliestDate)
                : "—"
            }
            color={colors.primary}
            styles={styles}
          />
        </View>

        <Text style={styles.sectionTitle}>Appearance</Text>
        <View style={styles.themeToggleRow}>
          {THEME_OPTIONS.map((opt) => {
            const isActive = mode === opt.mode;
            return (
              <Pressable
                key={opt.mode}
                onPress={() => setMode(opt.mode)}
                style={[styles.themeChip, isActive && styles.themeChipActive]}
              >
                <Text
                  style={[
                    styles.themeChipText,
                    isActive && styles.themeChipTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

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
              <Text style={[styles.iconBtnText, { color: colors.expense }]}>
                Delete
              </Text>
            </Pressable>
          </View>
        ))}
        <View style={styles.addRow}>
          <TextInput
            style={styles.input}
            placeholder="New account name"
            placeholderTextColor={colors.muted}
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
              <Text style={[styles.iconBtnText, { color: colors.expense }]}>
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
                    t === "income" ? colors.income : colors.expense,
                },
              ]}
            >
              <Text
                style={
                  newCategoryType === t
                    ? { color: colors.white, fontFamily: Fonts.semiBold }
                    : { color: colors.muted }
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
            placeholderTextColor={colors.muted}
            value={newCategoryName}
            onChangeText={setNewCategoryName}
          />
          <Pressable style={styles.addButton} onPress={handleAddCategory}>
            <Text style={styles.addButtonText}>Add</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Auto-Detect Transactions</Text>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowLabel}>Notification Access</Text>
            <Text style={styles.rowSub}>
              {permissionStatus === "authorized"
                ? "Enabled"
                : "Not enabled — tap to open settings"}
            </Text>
          </View>
          <Pressable
            style={styles.iconBtn}
            onPress={() => RNAndroidNotificationListener.requestPermission()}
          >
            <Text style={styles.iconBtnText}>Open Settings</Text>
          </Pressable>
        </View>

        {notificationApps.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: Spacing.four }]}>
              Approved Apps
            </Text>
            {notificationApps.map((app) => (
              <View key={app.package_name} style={styles.row}>
                <Text style={[styles.rowLabel, { flex: 1 }]}>
                  {app.app_label}
                </Text>
                <Switch
                  value={app.enabled === 1}
                  onValueChange={() => toggleApp(app.package_name, app.enabled)}
                  trackColor={{ true: colors.primary }}
                />
              </View>
            ))}
          </>
        )}

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

function StatCard({
  label,
  value,
  color,
  styles,
}: {
  label: string;
  value: string;
  color: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text
        style={[styles.statValue, { color }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
    </View>
  );
}

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: {
      paddingHorizontal: Spacing.four,
      paddingBottom: TabBarClearance,
    },
    heading: {
      fontFamily: Fonts.bold,
      fontSize: 24,
      color: colors.ink,
      marginTop: Spacing.three,
    },
    subheading: {
      fontFamily: Fonts.regular,
      fontSize: 13,
      color: colors.muted,
      marginTop: 2,
      marginBottom: Spacing.four,
    },
    identityCard: {
      backgroundColor: colors.surface,
      borderRadius: Radii.large,
      padding: Spacing.four,
      alignItems: "center",
      marginBottom: Spacing.three,
    },
    identityAvatar: {
      width: 64,
      height: 64,
      borderRadius: Radii.pill,
      backgroundColor: colors.background,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: Spacing.two,
    },
    identityEmoji: { fontSize: 32 },
    identityName: {
      fontFamily: Fonts.semiBold,
      fontSize: 17,
      color: colors.ink,
      textAlign: "center",
    },
    identityHint: {
      fontFamily: Fonts.regular,
      fontSize: 11,
      color: colors.muted,
      textAlign: "center",
      marginBottom: Spacing.three,
    },
    nameEditRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.two,
      marginBottom: Spacing.three,
    },
    nameInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radii.medium,
      padding: Spacing.two,
      fontFamily: Fonts.medium,
      color: colors.ink,
      backgroundColor: colors.background,
      minWidth: 140,
    },
    saveNameText: { fontFamily: Fonts.semiBold, color: colors.primary },
    balanceCard: {
      backgroundColor: colors.surface,
      borderRadius: Radii.large,
      padding: Spacing.five,
      alignItems: "center",
      marginBottom: Spacing.three,
    },
    balanceLabel: {
      fontFamily: Fonts.medium,
      color: colors.muted,
      fontSize: 13,
    },
    balanceValue: {
      fontFamily: Fonts.bold,
      fontSize: 30,
      marginTop: Spacing.one,
    },
    rowPair: {
      flexDirection: "row",
      gap: Spacing.three,
      marginBottom: Spacing.three,
    },
    statCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: Radii.medium,
      padding: Spacing.three,
    },
    statLabel: { fontFamily: Fonts.medium, color: colors.muted, fontSize: 11 },
    statValue: { fontFamily: Fonts.semiBold, fontSize: 15, marginTop: 4 },
    sectionTitle: {
      fontFamily: Fonts.semiBold,
      fontSize: 13,
      textTransform: "uppercase",
      letterSpacing: 1,
      color: colors.primary,
      marginTop: Spacing.five,
      marginBottom: Spacing.two,
    },
    themeToggleRow: {
      flexDirection: "row",
      gap: Spacing.two,
    },
    themeChip: {
      flex: 1,
      paddingVertical: Spacing.two,
      borderRadius: Radii.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
    },
    themeChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    themeChipText: {
      fontFamily: Fonts.medium,
      fontSize: 13,
      color: colors.muted,
    },
    themeChipTextActive: {
      color: colors.white,
      fontFamily: Fonts.semiBold,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: Spacing.two,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      gap: Spacing.two,
    },
    rowLabel: { fontFamily: Fonts.medium, color: colors.ink },
    rowSub: { fontFamily: Fonts.regular, fontSize: 12, color: colors.muted },
    iconBtn: { paddingHorizontal: Spacing.two, paddingVertical: Spacing.one },
    iconBtnText: {
      fontFamily: Fonts.medium,
      fontSize: 13,
      color: colors.primary,
    },
    addRow: {
      flexDirection: "row",
      gap: Spacing.two,
      marginTop: Spacing.three,
    },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radii.medium,
      padding: Spacing.three,
      fontFamily: Fonts.regular,
      color: colors.ink,
      backgroundColor: colors.surface,
    },
    addButton: {
      backgroundColor: colors.primary,
      borderRadius: Radii.medium,
      paddingHorizontal: Spacing.four,
      justifyContent: "center",
    },
    addButtonText: { color: colors.white, fontFamily: Fonts.semiBold },
    typeToggleRow: {
      flexDirection: "row",
      gap: Spacing.two,
      marginTop: Spacing.three,
    },
    typeChip: {
      paddingHorizontal: Spacing.four,
      paddingVertical: Spacing.two,
      borderRadius: Radii.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
  });
}
