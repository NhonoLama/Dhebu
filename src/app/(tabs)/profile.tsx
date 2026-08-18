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
import { handleNotificationEvent } from "@/tasks/notification-task";
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

const THEME_OPTIONS: {
  mode: ThemeMode;
  label: string;
}[] = [
  {
    mode: "system",
    label: "System",
  },
  {
    mode: "light",
    label: "Light",
  },
  {
    mode: "dark",
    label: "Dark",
  },
];

const EMPTY_SUMMARY: AllTimeSummary = {
  income: 0,
  expense: 0,
  balance: 0,
  transactionCount: 0,
  earliestDate: null,
};

const TEST_NOTIFICATIONS = [
  {
    label: "Debit (Dr)",
    title: "Prabhu Bank",
    text: "AC#024XX5991 Dr by NPR 1000 on 09Aug26 09:43:29 - 14047889dqhs,petroll",
  },

  {
    label: "Credit (Cr)",
    title: "Prabhu Bank",
    text: "AC#024XX5991 Cr by NPR 29300 on 07Aug26 18:35:25 - CIPSDAWA LAMA LAMA#H",
  },

  {
    label: "Withdrawn",
    title: "Prabhu Bank",
    text: "Dear DAWA, NPR 800.00 has been withdrawn from your A/C 257###18 on 07/08/2026 19:42:30. Rmk: Load eSewa,UPI-192128507, Thank You ! Prabhu Bank",
  },

  {
    label: "Deposited",
    title: "Prabhu Bank",
    text: "Dear DAWA, NPR 20,000.00 has been deposited in your A/C 257###18 on 29/07/2026 09:18:35. Rmk: IntraBnk,suppliers,986941 Thank You ! Prabhu Bank",
  },
];

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

  const [notificationApps, setNotificationApps] = useState<NotificationApp[]>(
    [],
  );

  useFocusEffect(
    useCallback(() => {
      getAllTimeSummary().then(setSummary);

      getUserProfile().then((p) => {
        setProfile(p);

        if (p) {
          setNameInput(p.name);
        }
      });
    }, []),
  );

  async function handleSaveName() {
    if (!nameInput.trim()) {
      return;
    }

    await updateUserProfile({
      name: nameInput.trim(),
    });

    const updated = await getUserProfile();

    setProfile(updated);
    setEditingName(false);
  }

  async function handleChangeAvatar(emoji: string) {
    await updateUserProfile({
      avatarEmoji: emoji,
    });

    const updated = await getUserProfile();

    setProfile(updated);
  }

  async function loadNotificationSettings() {
    try {
      const db = await getDb();

      const apps = await db.getAllAsync<NotificationApp>(
        `
            SELECT *
            FROM notification_apps
            ORDER BY app_label ASC;
          `,
      );

      setNotificationApps(apps);
    } catch (error) {
      console.error("Failed to load notification apps:", error);
    }
  }

  useEffect(() => {
    loadNotificationSettings();
  }, []);

  async function toggleApp(packageName: string, currentlyEnabled: number) {
    try {
      const db = await getDb();

      await db.runAsync(
        `
          UPDATE notification_apps
          SET enabled = ?
          WHERE package_name = ?;
        `,
        [currentlyEnabled ? 0 : 1, packageName],
      );

      await loadNotificationSettings();
    } catch (error) {
      console.error("Failed to toggle notification app:", error);

      Alert.alert("Error", "Could not update this app.");
    }
  }

  async function handleSimulateNotification(
    sample: (typeof TEST_NOTIFICATIONS)[number],
  ) {
    try {
      const db = await getDb();

      await db.runAsync(
        `
          INSERT INTO notification_apps (
            package_name,
            app_label,
            enabled
          )
          VALUES (
            'com.dhebu.debug.testbank',
            'Test Bank (Debug)',
            1
          )
          ON CONFLICT(package_name)
          DO UPDATE SET
            app_label = 'Test Bank (Debug)',
            enabled = 1;
        `,
      );

      await handleNotificationEvent({
        app: "com.dhebu.debug.testbank",

        title: sample.title,

        text: sample.text,
      });

      Alert.alert(
        "Test notification simulated",
        "Check the Dashboard banner to review the detected transaction.",
      );

      await loadNotificationSettings();
    } catch (error) {
      console.error("Debug notification failed:", error);

      Alert.alert(
        "Debug Error",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  async function handleAddAccount() {
    if (!newAccountName.trim()) {
      return;
    }

    try {
      await createAccount({
        name: newAccountName.trim(),

        type: "other",
      });

      setNewAccountName("");

      await init();
    } catch (error) {
      console.error("Failed to add account:", error);

      Alert.alert("Error", "Could not create account.");
    }
  }

  function handleDeleteAccount(account: Account) {
    Alert.alert(
      `Delete "${account.name}"?`,

      "Any transactions on this account will also be removed. This cannot be undone.",

      [
        {
          text: "Cancel",

          style: "cancel",
        },

        {
          text: "Delete",

          style: "destructive",

          onPress: async () => {
            try {
              await removeAccount(account.id);
            } catch (error) {
              console.error("Failed to delete account:", error);

              Alert.alert("Error", "Could not delete account.");
            }
          },
        },
      ],
    );
  }

  function handleDeleteCategory(category: Category) {
    Alert.alert(
      `Delete "${category.name}"?`,

      "This cannot be undone.",

      [
        {
          text: "Cancel",

          style: "cancel",
        },

        {
          text: "Delete",

          style: "destructive",

          onPress: async () => {
            try {
              await removeCategory(category.id);
            } catch (error) {
              console.error("Failed to delete category:", error);

              Alert.alert(
                "Cannot delete",
                "This category still has transactions recorded against it.",
              );
            }
          },
        },
      ],
    );
  }

  async function handleAddCategory() {
    if (!newCategoryName.trim()) {
      return;
    }

    try {
      await addCategory({
        name: newCategoryName.trim(),

        type: newCategoryType,
      });

      setNewCategoryName("");
    } catch (error) {
      console.error("Failed to add category:", error);

      Alert.alert("Error", "Could not create category.");
    }
  }

  async function handleRenameSubmit(value: string) {
    if (!editTarget) {
      return;
    }

    try {
      if (editTarget.kind === "account") {
        await renameAccount(editTarget.item.id, value);
      } else {
        await renameCategory(editTarget.item.id, value);
      }

      setEditTarget(null);
    } catch (error) {
      console.error("Rename failed:", error);

      Alert.alert("Error", "Could not rename this item.");
    }
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
              {
                color: summary.balance >= 0 ? colors.income : colors.expense,
              },
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

        {accounts.map((account) => (
          <View key={account.id} style={styles.row}>
            <View
              style={{
                flex: 1,
              }}
            >
              <Text style={styles.rowLabel}>{account.name}</Text>

              <Text style={styles.rowSub}>{account.type}</Text>
            </View>

            <Pressable
              onPress={() =>
                setEditTarget({
                  kind: "account",

                  item: account,
                })
              }
              style={styles.iconBtn}
            >
              <Text style={styles.iconBtnText}>Edit</Text>
            </Pressable>

            <Pressable
              onPress={() => handleDeleteAccount(account)}
              style={styles.iconBtn}
            >
              <Text
                style={[
                  styles.iconBtnText,
                  {
                    color: colors.expense,
                  },
                ]}
              >
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

        {categories.map((category) => (
          <View key={category.id} style={styles.row}>
            <View
              style={{
                flex: 1,
              }}
            >
              <Text style={styles.rowLabel}>{category.name}</Text>

              <Text style={styles.rowSub}>{category.type}</Text>
            </View>

            <Pressable
              onPress={() =>
                setEditTarget({
                  kind: "category",

                  item: category,
                })
              }
              style={styles.iconBtn}
            >
              <Text style={styles.iconBtnText}>Edit</Text>
            </Pressable>

            <Pressable
              onPress={() => handleDeleteCategory(category)}
              style={styles.iconBtn}
            >
              <Text
                style={[
                  styles.iconBtnText,
                  {
                    color: colors.expense,
                  },
                ]}
              >
                Delete
              </Text>
            </Pressable>
          </View>
        ))}

        <View style={styles.typeToggleRow}>
          {(["expense", "income"] as const).map((type) => (
            <Pressable
              key={type}
              onPress={() => setNewCategoryType(type)}
              style={[
                styles.typeChip,

                newCategoryType === type && {
                  backgroundColor:
                    type === "income" ? colors.income : colors.expense,
                },
              ]}
            >
              <Text
                style={
                  newCategoryType === type
                    ? {
                        color: colors.white,

                        fontFamily: Fonts.semiBold,
                      }
                    : {
                        color: colors.muted,
                      }
                }
              >
                {type === "income" ? "Income" : "Expense"}
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

        {/* AUTO DETECT */}

        <Text style={styles.sectionTitle}>Auto-Detect Transactions</Text>

        <View style={styles.row}>
          <View
            style={{
              flex: 1,
            }}
          >
            <Text style={styles.rowLabel}>Notification Access</Text>

            <Text style={styles.rowSub}>
              Native notification listener is being configured.
            </Text>
          </View>
        </View>

        {/* APPROVED APPS */}

        {notificationApps.length > 0 && (
          <>
            <Text
              style={[
                styles.sectionTitle,
                {
                  marginTop: Spacing.four,
                },
              ]}
            >
              Approved Apps
            </Text>

            {notificationApps.map((app) => (
              <View key={app.package_name} style={styles.row}>
                <View
                  style={{
                    flex: 1,
                  }}
                >
                  <Text style={styles.rowLabel}>{app.app_label}</Text>

                  <Text style={styles.rowSub} numberOfLines={1}>
                    {app.package_name}
                  </Text>
                </View>

                <Switch
                  value={app.enabled === 1}
                  onValueChange={() => toggleApp(app.package_name, app.enabled)}
                  trackColor={{
                    true: colors.primary,
                  }}
                />
              </View>
            ))}
          </>
        )}

        {/* DEBUG */}

        <Text
          style={[
            styles.sectionTitle,
            {
              marginTop: Spacing.four,
            },
          ]}
        >
          Debug: Simulate Notification
        </Text>

        <Text style={styles.rowSub}>
          Tests the parser directly, bypassing Android's notification system.
        </Text>

        <View style={styles.debugRow}>
          {TEST_NOTIFICATIONS.map((sample) => (
            <Pressable
              key={sample.label}
              style={styles.debugChip}
              onPress={() => handleSimulateNotification(sample)}
            >
              <Text style={styles.debugChipText}>{sample.label}</Text>
            </Pressable>
          ))}
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
        style={[
          styles.statValue,
          {
            color,
          },
        ]}
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
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },

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

    identityEmoji: {
      fontSize: 32,
    },

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

    saveNameText: {
      fontFamily: Fonts.semiBold,

      color: colors.primary,
    },

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

    statLabel: {
      fontFamily: Fonts.medium,

      color: colors.muted,

      fontSize: 11,
    },

    statValue: {
      fontFamily: Fonts.semiBold,

      fontSize: 15,

      marginTop: 4,
    },

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

    rowLabel: {
      fontFamily: Fonts.medium,

      color: colors.ink,
    },

    rowSub: {
      fontFamily: Fonts.regular,

      fontSize: 12,

      color: colors.muted,
    },

    iconBtn: {
      paddingHorizontal: Spacing.two,

      paddingVertical: Spacing.one,
    },

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

    addButtonText: {
      color: colors.white,

      fontFamily: Fonts.semiBold,
    },

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

    debugRow: {
      flexDirection: "row",

      flexWrap: "wrap",

      gap: Spacing.two,

      marginTop: Spacing.two,
    },

    debugChip: {
      paddingHorizontal: Spacing.three,

      paddingVertical: Spacing.two,

      borderRadius: Radii.pill,

      backgroundColor: colors.surface,

      borderWidth: 1,

      borderColor: colors.primary,
    },

    debugChipText: {
      fontFamily: Fonts.medium,

      fontSize: 12,

      color: colors.primary,
    },
  });
}
