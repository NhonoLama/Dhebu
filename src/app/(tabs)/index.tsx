import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getAvatarSource } from "@/constants/avatars";

import { PendingReviewModal } from "@/components/pending-review-modal";
import { ColorScheme, Fonts, Radii, Spacing } from "@/constants/theme";
import type { CategoryBreakdown, PeriodSummary } from "@/db/types";
import {
  getQueuedNotifications,
  removeQueuedNotification,
} from "@/modules/dhebu-notifications";
import { getPendingCount } from "@/repositories/pending-transactions.repo";
import {
  getCategoryBreakdown,
  getPeriodSummary,
} from "@/repositories/transactions.repo";
import { getUserProfile, UserProfile } from "@/repositories/user-profile.repo";
import { useLedgerStore } from "@/stores/useLedgerStore";
import { handleNotificationEvent } from "@/tasks/notification-task";
import { useTheme } from "@/theme/theme-context";
import { formatCurrency } from "@/utils/currency";
import {
  currentMonthRange,
  currentYearRange,
  formatDisplayDate,
} from "@/utils/date";

async function drainNativeNotificationQueue(): Promise<void> {
  const queuedNotifications = await getQueuedNotifications();

  if (__DEV__) {
    console.log("DHEBU: manual refresh draining native queue", {
      count: queuedNotifications.length,
    });
  }

  for (const event of queuedNotifications) {
    const handled = await handleNotificationEvent({
      app: event.app,
      appLabel: event.appLabel,
      title: event.title ?? "",
      text: event.bigText?.trim() || event.text?.trim() || "",
      postedAt: typeof event.postedAt === "number" ? event.postedAt : undefined,
    });

    if (!handled || !event.queueId) {
      continue;
    }

    const removed = await removeQueuedNotification(event.queueId);

    if (__DEV__) {
      console.log("DHEBU: manual refresh acknowledged native queue item", {
        queueId: event.queueId,
        removed,
      });
    }
  }
}

export default function DashboardScreen() {
  const { colors, shadows } = useTheme();
  const styles = useMemo(
    () => createStyles(colors, shadows),
    [colors, shadows],
  );
  const summary = useLedgerStore((s) => s.currentPeriodSummary);
  const recent = useLedgerStore((s) => s.recentTransactions);
  const init = useLedgerStore((s) => s.init);

  const [expenseBreakdown, setExpenseBreakdown] = useState<CategoryBreakdown[]>(
    [],
  );
  const [incomeBreakdown, setIncomeBreakdown] = useState<CategoryBreakdown[]>(
    [],
  );
  const [yearSummary, setYearSummary] = useState<PeriodSummary>({
    income: 0,
    expense: 0,
    balance: 0,
  });
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const refreshInProgressRef = useRef(false);

  const reloadDashboardData = useCallback(async () => {
    const { start, end } = currentMonthRange();
    const yearRange = currentYearRange();

    const [count, expense, income, year, userProfile] = await Promise.all([
      getPendingCount(),
      getCategoryBreakdown(start, end, "expense"),
      getCategoryBreakdown(start, end, "income"),
      getPeriodSummary(yearRange.start, yearRange.end),
      getUserProfile(),
      init(),
    ]);

    setPendingCount(count);
    setExpenseBreakdown(expense);
    setIncomeBreakdown(income);
    setYearSummary(year);
    setProfile(userProfile);
  }, [init]);

  const handleRefresh = useCallback(async () => {
    if (refreshInProgressRef.current) {
      return;
    }

    refreshInProgressRef.current = true;
    setRefreshing(true);

    try {
      /*
       * Process native notifications first so any newly created pending
       * transactions are included when the dashboard reloads from SQLite.
       */
      try {
        await drainNativeNotificationQueue();
      } catch (error) {
        console.error("DHEBU: manual native queue refresh failed", error);
      }

      try {
        await reloadDashboardData();
      } catch (error) {
        console.error("DHEBU: manual dashboard data refresh failed", error);
      }
    } finally {
      refreshInProgressRef.current = false;
      setRefreshing(false);
    }
  }, [reloadDashboardData]);

  useFocusEffect(
    useCallback(() => {
      void reloadDashboardData().catch((error) => {
        console.error("DHEBU: failed refreshing dashboard", error);
      });
    }, [reloadDashboardData]),
  );

  async function handleCloseReviewModal() {
    setReviewModalVisible(false);

    try {
      await reloadDashboardData();
    } catch (error) {
      console.error("DHEBU: failed refreshing after pending review", error);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.greeting}>
            Hi{profile ? `, ${profile.name}` : ""} 👋
          </Text>
          <Text style={styles.subGreeting}>Here's your financial summary</Text>
        </View>

        <View style={styles.headerActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh dashboard"
            disabled={refreshing}
            onPress={handleRefresh}
            style={({ pressed }) => [
              styles.refreshButton,
              pressed && !refreshing && styles.refreshButtonPressed,
              refreshing && styles.refreshButtonDisabled,
            ]}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={styles.refreshIcon}>↻</Text>
            )}
          </Pressable>

          <Pressable
            style={styles.avatar}
            onPress={() => router.push("/(tabs)/profile")}
          >
            <Image
              source={getAvatarSource(profile?.avatar_id)}
              style={styles.avatarImage}
              resizeMode="cover"
            />
          </Pressable>
        </View>
      </View>

      {pendingCount > 0 && (
        <Pressable
          style={styles.pendingBanner}
          onPress={() => setReviewModalVisible(true)}
        >
          <Text style={styles.pendingBannerText}>
            {pendingCount} new transaction{pendingCount === 1 ? "" : "s"}{" "}
            detected — tap to review
          </Text>
        </Pressable>
      )}

      <View style={styles.summaryRowPair}>
        <View style={[styles.summaryCard, styles.summaryCardHalf]}>
          <Text style={styles.cardTitle}>This Month</Text>
          <SummaryRow
            label="Income"
            value={summary.income}
            color={colors.income}
            styles={styles}
            compact
          />
          <SummaryRow
            label="Expense"
            value={summary.expense}
            color={colors.expense}
            styles={styles}
            compact
          />
          <View style={styles.divider} />
          <SummaryRow
            label="Balance"
            value={summary.balance}
            color={summary.balance >= 0 ? colors.income : colors.expense}
            bold
            styles={styles}
            compact
          />
        </View>

        <View style={[styles.summaryCard, styles.summaryCardHalf]}>
          <Text style={styles.cardTitle}>This Year</Text>
          <SummaryRow
            label="Income"
            value={yearSummary.income}
            color={colors.income}
            styles={styles}
            compact
          />
          <SummaryRow
            label="Expense"
            value={yearSummary.expense}
            color={colors.expense}
            styles={styles}
            compact
          />
          <View style={styles.divider} />
          <SummaryRow
            label="Balance"
            value={yearSummary.balance}
            color={yearSummary.balance >= 0 ? colors.income : colors.expense}
            bold
            styles={styles}
            compact
          />
        </View>
      </View>

      <Text style={styles.sectionTitle}>Recent Transactions</Text>

      <FlatList
        data={recent}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            progressBackgroundColor={colors.surface}
            tintColor={colors.primary}
          />
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View
              style={[
                styles.badge,
                {
                  backgroundColor:
                    item.type === "income" ? colors.income : colors.expense,
                },
              ]}
            >
              <Text style={styles.badgeText}>
                {item.type === "income" ? "+" : "−"}
              </Text>
            </View>
            <View style={{ flex: 1, marginLeft: Spacing.three }}>
              <Text style={styles.rowTitle}>{item.category_name}</Text>
              <Text style={styles.rowSub}>
                {formatDisplayDate(item.date)}
                {item.note ? ` · ${item.note}` : ""}
              </Text>
            </View>
            <Text
              style={[
                styles.amount,
                {
                  color:
                    item.type === "income" ? colors.income : colors.expense,
                },
              ]}
            >
              {item.type === "income" ? "+" : "-"}
              {formatCurrency(item.amount)}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>
            No transactions yet. Add your first one from the Add tab.
          </Text>
        }
        ListFooterComponent={
          <View>
            <Text style={styles.sectionTitle}>Spending by Category</Text>
            <BreakdownList
              data={expenseBreakdown}
              colors={colors}
              styles={styles}
            />

            <Text style={styles.sectionTitle}>Income by Category</Text>
            <BreakdownList
              data={incomeBreakdown}
              colors={colors}
              styles={styles}
            />
          </View>
        }
      />

      <PendingReviewModal
        visible={reviewModalVisible}
        onClose={handleCloseReviewModal}
      />
    </SafeAreaView>
  );
}

function BreakdownList({
  data,
  colors,
  styles,
}: {
  data: CategoryBreakdown[];
  colors: ColorScheme;
  styles: ReturnType<typeof createStyles>;
}) {
  const max = Math.max(...data.map((d) => d.total), 1);

  if (data.length === 0) {
    return <Text style={styles.empty}>No data yet.</Text>;
  }

  return (
    <View style={{ gap: Spacing.three }}>
      {data.map((row) => (
        <View key={row.category_id}>
          <View style={styles.barLabelRow}>
            <Text style={styles.barLabel}>{row.category_name}</Text>
            <Text style={styles.barValue}>{formatCurrency(row.total)}</Text>
          </View>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                {
                  width: `${(row.total / max) * 100}%`,
                  backgroundColor: row.category_color ?? colors.primary,
                },
              ]}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

function SummaryRow({
  label,
  value,
  color,
  bold,
  styles,
  compact,
}: {
  label: string;
  value: number;
  color: string;
  bold?: boolean;
  styles: ReturnType<typeof createStyles>;
  compact?: boolean;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text
        style={[
          styles.summaryLabel,
          bold && { fontFamily: Fonts.semiBold },
          compact && { fontSize: 11 },
        ]}
      >
        {label}
      </Text>
      <Text
        style={[styles.summaryValue, { color }, compact && { fontSize: 13 }]}
        numberOfLines={1}
      >
        {formatCurrency(value)}
      </Text>
    </View>
  );
}

function createStyles(colors: ColorScheme, shadows: { soft: object }) {
  return StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: Spacing.four,
      backgroundColor: colors.background,
    },
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: Spacing.three,
      marginBottom: Spacing.four,
    },
    headerText: {
      flex: 1,
      paddingRight: Spacing.three,
    },
    headerActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.two,
    },
    refreshButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    refreshButtonPressed: {
      opacity: 0.7,
    },
    refreshButtonDisabled: {
      opacity: 0.65,
    },
    refreshIcon: {
      fontFamily: Fonts.semiBold,
      fontSize: 24,
      lineHeight: 26,
      color: colors.primary,
    },
    greeting: { fontFamily: Fonts.bold, fontSize: 20, color: colors.ink },
    subGreeting: {
      fontFamily: Fonts.regular,
      fontSize: 13,
      color: colors.muted,
      marginTop: 2,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.border,
    },

    avatarImage: {
      width: "100%",
      height: "100%",
    },
    pendingBanner: {
      backgroundColor: colors.primary,
      borderRadius: Radii.medium,
      padding: Spacing.three,
      marginBottom: Spacing.three,
    },
    pendingBannerText: {
      fontFamily: Fonts.semiBold,
      color: colors.white,
      fontSize: 13,
      textAlign: "center",
    },
    summaryRowPair: {
      flexDirection: "row",
      gap: Spacing.three,
    },
    summaryCard: {
      backgroundColor: colors.surface,
      borderRadius: Radii.large,
      padding: Spacing.four,
      gap: Spacing.two,
      ...shadows.soft,
    },
    summaryCardHalf: {
      flex: 1,
      padding: Spacing.three,
    },
    cardTitle: {
      fontFamily: Fonts.semiBold,
      fontSize: 12,
      color: colors.muted,
      marginBottom: 2,
    },
    summaryRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    summaryLabel: {
      fontFamily: Fonts.regular,
      color: colors.ink,
      fontSize: 14,
    },
    summaryValue: { fontFamily: Fonts.semiBold, fontSize: 16 },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: Spacing.one,
    },
    sectionTitle: {
      fontFamily: Fonts.semiBold,
      fontSize: 14,
      color: colors.muted,
      marginTop: Spacing.five,
      marginBottom: Spacing.two,
    },
    list: { gap: Spacing.one, paddingBottom: Spacing.six + 64 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      padding: Spacing.three,
      marginBottom: Spacing.two,
      borderRadius: Radii.medium,
      backgroundColor: colors.surface,
      ...shadows.soft,
    },
    badge: {
      width: 32,
      height: 32,
      borderRadius: Radii.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    badgeText: { color: colors.white, fontFamily: Fonts.bold, fontSize: 16 },
    rowTitle: { fontFamily: Fonts.medium, color: colors.ink },
    rowSub: {
      fontFamily: Fonts.regular,
      fontSize: 12,
      color: colors.muted,
      marginTop: 2,
    },
    amount: { fontFamily: Fonts.semiBold, fontSize: 15 },
    empty: {
      textAlign: "center",
      marginTop: Spacing.five,
      fontFamily: Fonts.regular,
      color: colors.muted,
    },
    barLabelRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 4,
    },
    barLabel: { fontFamily: Fonts.regular, fontSize: 13, color: colors.ink },
    barValue: { fontFamily: Fonts.medium, fontSize: 13, color: colors.ink },
    barTrack: {
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.border,
      overflow: "hidden",
    },
    barFill: { height: "100%", borderRadius: 4 },
  });
}
