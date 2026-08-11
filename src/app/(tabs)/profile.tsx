import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ColorScheme, Fonts, Radii, Spacing } from "@/constants/theme";
import {
  getAllTimeSummary,
  type AllTimeSummary,
} from "@/repositories/transactions.repo";
import { useTheme } from "@/theme/theme-context";
import { formatCurrency } from "@/utils/currency";
import { formatDisplayDate } from "@/utils/date";

const EMPTY_SUMMARY: AllTimeSummary = {
  income: 0,
  expense: 0,
  balance: 0,
  transactionCount: 0,
  earliestDate: null,
};

export default function ProfileScreen() {
  const { colors, shadows } = useTheme();
  const styles = useMemo(
    () => createStyles(colors, shadows),
    [colors, shadows],
  );
  const [summary, setSummary] = useState<AllTimeSummary>(EMPTY_SUMMARY);

  useFocusEffect(
    useCallback(() => {
      getAllTimeSummary().then(setSummary);
    }, []),
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Text style={styles.heading}>Profile</Text>
      <Text style={styles.subheading}>Your all-time ledger, since day one</Text>

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
            summary.earliestDate ? formatDisplayDate(summary.earliestDate) : "—"
          }
          color={colors.primary}
          styles={styles}
        />
      </View>
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

function createStyles(colors: ColorScheme, shadows: { soft: object }) {
  return StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: Spacing.four,
      backgroundColor: colors.background,
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
    balanceCard: {
      backgroundColor: colors.surface,
      borderRadius: Radii.large,
      padding: Spacing.five,
      alignItems: "center",
      marginBottom: Spacing.four,
      ...shadows.soft,
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
      ...shadows.soft,
    },
    statLabel: { fontFamily: Fonts.medium, color: colors.muted, fontSize: 11 },
    statValue: { fontFamily: Fonts.semiBold, fontSize: 15, marginTop: 4 },
  });
}
