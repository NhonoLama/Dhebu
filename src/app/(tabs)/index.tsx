import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PendingReviewModal } from "@/components/pending-review-modal";
import { ColorScheme, Fonts, Radii, Spacing } from "@/constants/theme";
import type { CategoryBreakdown, PeriodSummary } from "@/db/types";
import { getPendingCount } from "@/repositories/pending-transactions.repo";
import {
  getCategoryBreakdown,
  getPeriodSummary,
} from "@/repositories/transactions.repo";
import { useLedgerStore } from "@/stores/useLedgerStore";
import { useTheme } from "@/theme/theme-context";
import { formatCurrency } from "@/utils/currency";
import {
  currentMonthRange,
  currentYearRange,
  formatDisplayDate,
} from "@/utils/date";

export default function DashboardScreen() {
  const { colors, shadows } = useTheme();
  const styles = useMemo(
    () => createStyles(colors, shadows),
    [colors, shadows],
  );
  const summary = useLedgerStore((s) => s.currentPeriodSummary);
  const recent = useLedgerStore((s) => s.recentTransactions);

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
  const [pendingCount, setPendingCount] = useState(0);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const { start, end } = currentMonthRange();
        const yearRange = currentYearRange();
        const [expense, income, year] = await Promise.all([
          getCategoryBreakdown(start, end, "expense"),
          getCategoryBreakdown(start, end, "income"),
          getPeriodSummary(yearRange.start, yearRange.end),
        ]);
        setExpenseBreakdown(expense);
        setIncomeBreakdown(income);
        setYearSummary(year);
      })();
    }, []),
  );

  function handleCloseReviewModal() {
    setReviewModalVisible(false);
    getPendingCount().then(setPendingCount); // refresh badge after reviewing
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.greeting}>Hi there 👋</Text>
          <Text style={styles.subGreeting}>Here's your financial summary</Text>
        </View>
        <Pressable
          style={styles.avatar}
          onPress={() => router.push("/(tabs)/profile")}
        >
          <Text style={styles.avatarText}>D</Text>
        </Pressable>
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
      borderRadius: Radii.pill,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: { fontFamily: Fonts.bold, color: colors.white, fontSize: 16 },
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
