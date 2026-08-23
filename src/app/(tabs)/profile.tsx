import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  AppState,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import { AvatarPicker } from "@/components/avatar-picker";
import { RenameModal } from "@/components/rename-modal";
import { getAvatarSource, type AvatarId } from "@/constants/avatars";

import {
  ColorScheme,
  Fonts,
  Radii,
  Spacing,
  TabBarClearance,
} from "@/constants/theme";

import { getDb } from "@/db/client";

import type { Account, Category } from "@/db/types";

import {
  getAllowedNotificationApps,
  getInstalledApps,
  isNotificationAccessGranted,
  openNotificationAccessSettings,
  setAllowedNotificationApps,
  type DhebuInstalledApp,
} from "@/modules/dhebu-notifications";

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

type EditTarget =
  | {
      kind: "account";
      item: Account;
    }
  | {
      kind: "category";
      item: Category;
    }
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

  const [avatarPickerVisible, setAvatarPickerVisible] = useState(false);

  /*
   * ============================
   * NOTIFICATION SETTINGS
   * ============================
   */

  const [notificationAccess, setNotificationAccess] = useState<boolean | null>(
    null,
  );

  const [installedApps, setInstalledApps] = useState<DhebuInstalledApp[]>([]);

  const [allowedPackages, setAllowedPackages] = useState<string[]>([]);

  const [appSelectorVisible, setAppSelectorVisible] = useState(false);

  const [appSearch, setAppSearch] = useState("");

  const [loadingApps, setLoadingApps] = useState(false);

  const [savingPackage, setSavingPackage] = useState<string | null>(null);

  /*
   * ============================
   * PROFILE DATA
   * ============================
   */

  useFocusEffect(
    useCallback(() => {
      getAllTimeSummary().then(setSummary);

      getUserProfile().then((p) => {
        setProfile(p);

        if (p) {
          setNameInput(p.name);
        }
      });

      loadNotificationSettings();
    }, []),
  );

  /*
   * Refresh notification access
   * when returning from Android
   * settings.
   */
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        refreshNotificationAccess();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  async function refreshNotificationAccess() {
    try {
      const granted = await isNotificationAccessGranted();

      setNotificationAccess(granted);
    } catch (error) {
      console.error("DHEBU: failed checking notification access", error);

      setNotificationAccess(false);
    }
  }

  async function loadNotificationSettings() {
    try {
      setLoadingApps(true);

      const [granted, apps, packages] = await Promise.all([
        isNotificationAccessGranted(),
        getInstalledApps(),
        getAllowedNotificationApps(),
      ]);

      setNotificationAccess(granted);

      setInstalledApps(apps);

      setAllowedPackages(packages);
    } catch (error) {
      console.error("DHEBU: failed loading notification settings", error);
    } finally {
      setLoadingApps(false);
    }
  }

  /*
   * Important:
   *
   * We save selected apps in TWO places.
   *
   * 1. Native SharedPreferences:
   *    Kotlin uses this BEFORE sending
   *    anything to JavaScript.
   *
   * 2. notification_apps SQLite:
   *    The existing transaction pipeline
   *    still checks this database table.
   *
   * This keeps both layers synchronized.
   */
  async function toggleNotificationApp(app: DhebuInstalledApp) {
    if (savingPackage) {
      return;
    }

    const currentlyAllowed = allowedPackages.includes(app.packageName);

    const nextPackages = currentlyAllowed
      ? allowedPackages.filter((packageName) => packageName !== app.packageName)
      : [...allowedPackages, app.packageName];

    try {
      setSavingPackage(app.packageName);

      /*
       * Update native package filter.
       */
      await setAllowedNotificationApps(nextPackages);

      /*
       * Keep SQLite source approval
       * synchronized with native settings.
       */
      const db = await getDb();

      await db.runAsync(
        `
        INSERT INTO notification_apps (
          package_name,
          app_label,
          enabled
        )
        VALUES (?, ?, ?)

        ON CONFLICT(package_name)
        DO UPDATE SET
          app_label = excluded.app_label,
          enabled = excluded.enabled;
        `,
        [app.packageName, app.appLabel, currentlyAllowed ? 0 : 1],
      );

      setAllowedPackages(nextPackages);

      if (__DEV__) {
        console.log(
          currentlyAllowed
            ? "DHEBU: notification app disabled"
            : "DHEBU: notification app enabled",
          {
            appLabel: app.appLabel,
            packageName: app.packageName,
          },
        );
      }
    } catch (error) {
      console.error("DHEBU: failed updating allowed notification app", error);

      Alert.alert(
        "Could not update app",
        "Dhebu could not save this notification source.",
      );

      /*
       * Reload native truth if either
       * operation failed.
       */
      await loadNotificationSettings();
    } finally {
      setSavingPackage(null);
    }
  }

  /*
   * Apps shown in selector.
   */
  const filteredInstalledApps = useMemo(() => {
    const query = appSearch.trim().toLowerCase();

    if (!query) {
      return installedApps;
    }

    return installedApps.filter(
      (app) =>
        app.appLabel.toLowerCase().includes(query) ||
        app.packageName.toLowerCase().includes(query),
    );
  }, [installedApps, appSearch]);

  /*
   * Selected apps displayed on Profile.
   */
  const selectedApps = useMemo(() => {
    return installedApps.filter((app) =>
      allowedPackages.includes(app.packageName),
    );
  }, [installedApps, allowedPackages]);

  /*
   * ============================
   * PROFILE
   * ============================
   */

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

  async function handleChangeAvatar(avatarId: AvatarId) {
    await updateUserProfile({
      avatarId,
    });

    const updated = await getUserProfile();

    setProfile(updated);
  }

  /*
   * ============================
   * ACCOUNTS
   * ============================
   */

  async function handleAddAccount() {
    if (!newAccountName.trim()) {
      return;
    }

    await createAccount({
      name: newAccountName.trim(),

      type: "other",
    });

    setNewAccountName("");

    await init();
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

          onPress: () => removeAccount(account.id),
        },
      ],
    );
  }

  /*
   * ============================
   * CATEGORIES
   * ============================
   */

  function handleDeleteCategory(category: Category) {
    Alert.alert(`Delete "${category.name}"?`, "This cannot be undone.", [
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
    if (!newCategoryName.trim()) {
      return;
    }

    await addCategory({
      name: newCategoryName.trim(),

      type: newCategoryType,
    });

    setNewCategoryName("");
  }

  async function handleRenameSubmit(value: string) {
    if (!editTarget) {
      return;
    }

    if (editTarget.kind === "account") {
      await renameAccount(editTarget.item.id, value);
    } else {
      await renameCategory(editTarget.item.id, value);
    }

    setEditTarget(null);
  }

  /*
   * ============================
   * RENDER
   * ============================
   */

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
          <Pressable
            style={styles.identityAvatar}
            onPress={() => setAvatarPickerVisible(true)}
          >
            <Image
              source={getAvatarSource(profile?.avatar_id)}
              style={styles.identityAvatarImage}
              resizeMode="contain"
            />

            <View style={styles.avatarEditBadge}>
              <Text style={styles.avatarEditBadgeText}>✎</Text>
            </View>
          </Pressable>

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
          <AvatarPicker
            visible={avatarPickerVisible}
            value={profile?.avatar_id ?? "avatar_01"}
            onClose={() => setAvatarPickerVisible(false)}
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

        {/* Appearance */}

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

        {/* Accounts */}

        <Text style={styles.sectionTitle}>Accounts</Text>

        {accounts.map((a) => (
          <View key={a.id} style={styles.row}>
            <View
              style={{
                flex: 1,
              }}
            >
              <Text style={styles.rowLabel}>{a.name}</Text>

              <Text style={styles.rowSub}>{a.type}</Text>
            </View>

            <Pressable
              onPress={() =>
                setEditTarget({
                  kind: "account",
                  item: a,
                })
              }
              style={styles.iconBtn}
            >
              <Text style={styles.iconBtnText}>Edit</Text>
            </Pressable>

            <Pressable
              onPress={() => handleDeleteAccount(a)}
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

        {/* Categories */}

        <Text style={styles.sectionTitle}>Categories</Text>

        {categories.map((c) => (
          <View key={c.id} style={styles.row}>
            <View
              style={{
                flex: 1,
              }}
            >
              <Text style={styles.rowLabel}>{c.name}</Text>

              <Text style={styles.rowSub}>{c.type}</Text>
            </View>

            <Pressable
              onPress={() =>
                setEditTarget({
                  kind: "category",
                  item: c,
                })
              }
              style={styles.iconBtn}
            >
              <Text style={styles.iconBtnText}>Edit</Text>
            </Pressable>

            <Pressable
              onPress={() => handleDeleteCategory(c)}
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
                    ? {
                        color: colors.white,
                        fontFamily: Fonts.semiBold,
                      }
                    : {
                        color: colors.muted,
                      }
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

        {/* ========================
            AUTO DETECT
           ======================== */}

        <Text style={styles.sectionTitle}>Auto-Detect Transactions</Text>

        <View style={styles.notificationCard}>
          <View style={styles.notificationHeader}>
            <View
              style={{
                flex: 1,
              }}
            >
              <Text style={styles.rowLabel}>Notification Access</Text>

              <Text style={styles.rowSub}>
                {notificationAccess === null
                  ? "Checking..."
                  : notificationAccess
                    ? "Enabled"
                    : "Not enabled"}
              </Text>
            </View>

            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: notificationAccess
                    ? colors.income
                    : colors.expense,
                },
              ]}
            />
          </View>

          <Text style={styles.notificationDescription}>
            Android requires notification access so Dhebu can detect bank
            transaction alerts.
          </Text>

          <Pressable
            style={styles.settingsButton}
            onPress={openNotificationAccessSettings}
          >
            <Text style={styles.settingsButtonText}>
              Open Notification Settings
            </Text>
          </Pressable>
        </View>

        {/* Selected apps */}

        <View style={styles.appSourceHeader}>
          <View
            style={{
              flex: 1,
            }}
          >
            <Text style={styles.sourceTitle}>Transaction Apps</Text>

            <Text style={styles.rowSub}>
              Only selected apps are processed by Dhebu.
            </Text>
          </View>

          <Pressable
            style={styles.chooseAppsButton}
            onPress={() => {
              setAppSearch("");
              setAppSelectorVisible(true);
            }}
          >
            <Text style={styles.chooseAppsText}>Choose Apps</Text>
          </Pressable>
        </View>

        {loadingApps ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : selectedApps.length === 0 ? (
          <View style={styles.emptyAppsCard}>
            <Text style={styles.emptyAppsTitle}>
              No transaction apps selected
            </Text>

            <Text style={styles.rowSub}>
              Choose your SMS, banking or wallet apps. Other notifications will
              be rejected immediately by Android.
            </Text>
          </View>
        ) : (
          selectedApps.map((app) => (
            <View key={app.packageName} style={styles.selectedAppRow}>
              <View style={styles.appInitial}>
                <Text style={styles.appInitialText}>
                  {app.appLabel.charAt(0).toUpperCase()}
                </Text>
              </View>

              <View
                style={{
                  flex: 1,
                }}
              >
                <Text style={styles.rowLabel}>{app.appLabel}</Text>

                <Text style={styles.packageText} numberOfLines={1}>
                  {app.packageName}
                </Text>
              </View>

              <Switch
                value={true}
                disabled={savingPackage === app.packageName}
                onValueChange={() => toggleNotificationApp(app)}
                trackColor={{
                  true: colors.primary,
                }}
              />
            </View>
          ))
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

      {/* ============================
          APP SELECTOR MODAL
         ============================ */}

      <Modal
        visible={appSelectorVisible}
        animationType="slide"
        onRequestClose={() => setAppSelectorVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View
              style={{
                flex: 1,
              }}
            >
              <Text style={styles.modalTitle}>Choose Transaction Apps</Text>

              <Text style={styles.rowSub}>
                Dhebu will process notifications only from apps you enable here.
              </Text>
            </View>

            <Pressable onPress={() => setAppSelectorVisible(false)}>
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          </View>

          <View style={styles.searchWrapper}>
            <TextInput
              style={styles.searchInput}
              value={appSearch}
              onChangeText={setAppSearch}
              placeholder="Search Messages, eSewa, bank..."
              placeholderTextColor={colors.muted}
              autoCorrect={false}
            />
          </View>

          <ScrollView
            contentContainerStyle={styles.appList}
            keyboardShouldPersistTaps="handled"
          >
            {filteredInstalledApps.map((app) => {
              const enabled = allowedPackages.includes(app.packageName);

              const saving = savingPackage === app.packageName;

              return (
                <View key={app.packageName} style={styles.appRow}>
                  <View style={styles.appInitial}>
                    <Text style={styles.appInitialText}>
                      {app.appLabel.charAt(0).toUpperCase()}
                    </Text>
                  </View>

                  <View
                    style={{
                      flex: 1,
                    }}
                  >
                    <Text style={styles.rowLabel}>{app.appLabel}</Text>

                    <Text style={styles.packageText} numberOfLines={1}>
                      {app.packageName}
                    </Text>
                  </View>

                  {saving ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : (
                    <Switch
                      value={enabled}
                      onValueChange={() => toggleNotificationApp(app)}
                      trackColor={{
                        true: colors.primary,
                      }}
                    />
                  )}
                </View>
              );
            })}

            {filteredInstalledApps.length === 0 && (
              <Text style={styles.noResults}>No apps found.</Text>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
      width: 72,
      height: 72,

      borderRadius: Radii.pill,

      backgroundColor: colors.background,

      alignItems: "center",

      justifyContent: "center",

      marginBottom: Spacing.two,
    },

    identityAvatarImage: {
      width: 56,
      height: 56,
    },

    avatarEditBadge: {
      position: "absolute",
      right: -2,
      bottom: -2,

      width: 22,
      height: 22,

      borderRadius: 11,

      backgroundColor: colors.primary,

      alignItems: "center",
      justifyContent: "center",

      borderWidth: 2,
      borderColor: colors.surface,
    },

    avatarEditBadgeText: {
      color: colors.white,
      fontFamily: Fonts.bold,
      fontSize: 11,
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

    /*
     * Notification settings
     */

    notificationCard: {
      backgroundColor: colors.surface,

      borderRadius: Radii.large,

      borderWidth: 1,

      borderColor: colors.border,

      padding: Spacing.four,
    },

    notificationHeader: {
      flexDirection: "row",

      alignItems: "center",
    },

    notificationDescription: {
      fontFamily: Fonts.regular,

      fontSize: 12,

      lineHeight: 18,

      color: colors.muted,

      marginTop: Spacing.three,
    },

    statusDot: {
      width: 10,
      height: 10,

      borderRadius: 5,

      marginLeft: Spacing.two,
    },

    settingsButton: {
      marginTop: Spacing.three,

      alignSelf: "flex-start",

      paddingHorizontal: Spacing.three,

      paddingVertical: Spacing.two,

      borderRadius: Radii.medium,

      backgroundColor: colors.background,

      borderWidth: 1,

      borderColor: colors.border,
    },

    settingsButtonText: {
      fontFamily: Fonts.semiBold,

      fontSize: 12,

      color: colors.primary,
    },

    appSourceHeader: {
      flexDirection: "row",

      alignItems: "center",

      gap: Spacing.three,

      marginTop: Spacing.four,

      marginBottom: Spacing.two,
    },

    sourceTitle: {
      fontFamily: Fonts.semiBold,

      fontSize: 15,

      color: colors.ink,
    },

    chooseAppsButton: {
      paddingHorizontal: Spacing.three,

      paddingVertical: Spacing.two,

      borderRadius: Radii.medium,

      backgroundColor: colors.primary,
    },

    chooseAppsText: {
      fontFamily: Fonts.semiBold,

      fontSize: 12,

      color: colors.white,
    },

    loadingRow: {
      paddingVertical: Spacing.four,

      alignItems: "center",
    },

    emptyAppsCard: {
      backgroundColor: colors.surface,

      padding: Spacing.four,

      borderRadius: Radii.medium,

      borderWidth: 1,

      borderColor: colors.border,
    },

    emptyAppsTitle: {
      fontFamily: Fonts.semiBold,

      fontSize: 14,

      color: colors.ink,

      marginBottom: Spacing.one,
    },

    selectedAppRow: {
      flexDirection: "row",

      alignItems: "center",

      gap: Spacing.three,

      paddingVertical: Spacing.three,

      borderBottomWidth: StyleSheet.hairlineWidth,

      borderBottomColor: colors.border,
    },

    appInitial: {
      width: 38,
      height: 38,

      borderRadius: Radii.medium,

      alignItems: "center",

      justifyContent: "center",

      backgroundColor: colors.surface,

      borderWidth: 1,

      borderColor: colors.border,
    },

    appInitialText: {
      fontFamily: Fonts.bold,

      fontSize: 15,

      color: colors.primary,
    },

    packageText: {
      fontFamily: Fonts.regular,

      fontSize: 10,

      color: colors.muted,

      marginTop: 2,
    },

    /*
     * Modal
     */

    modalContainer: {
      flex: 1,

      backgroundColor: colors.background,
    },

    modalHeader: {
      flexDirection: "row",

      alignItems: "center",

      paddingHorizontal: Spacing.four,

      paddingTop: Spacing.three,

      paddingBottom: Spacing.three,

      borderBottomWidth: StyleSheet.hairlineWidth,

      borderBottomColor: colors.border,

      gap: Spacing.three,
    },

    modalTitle: {
      fontFamily: Fonts.bold,

      fontSize: 20,

      color: colors.ink,
    },

    doneText: {
      fontFamily: Fonts.semiBold,

      color: colors.primary,
    },

    searchWrapper: {
      paddingHorizontal: Spacing.four,

      paddingVertical: Spacing.three,
    },

    searchInput: {
      borderWidth: 1,

      borderColor: colors.border,

      backgroundColor: colors.surface,

      color: colors.ink,

      borderRadius: Radii.medium,

      paddingHorizontal: Spacing.three,

      paddingVertical: Spacing.three,

      fontFamily: Fonts.regular,
    },

    appList: {
      paddingHorizontal: Spacing.four,

      paddingBottom: Spacing.six,
    },

    appRow: {
      flexDirection: "row",

      alignItems: "center",

      gap: Spacing.three,

      paddingVertical: Spacing.three,

      borderBottomWidth: StyleSheet.hairlineWidth,

      borderBottomColor: colors.border,
    },

    noResults: {
      fontFamily: Fonts.regular,

      color: colors.muted,

      textAlign: "center",

      paddingVertical: Spacing.six,
    },
  });
}
