import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Colors, Fonts, Spacing } from "@/constants/theme";
import type { CategoryBreakdown } from "@/db/types";
import { getCategoryBreakdown } from "@/repositories/transactions.repo";
import { formatCurrency } from "@/utils/currency";
import { currentMonthRange } from "@/utils/date";

export default function ReportsScreen() {
  const [expenseBreakdown, setExpenseBreakdown] = useState<CategoryBreakdown[]>(
    [],
  );
  const [incomeBreakdown, setIncomeBreakdown] = useState<CategoryBreakdown[]>(
    [],
  );

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const { start, end } = currentMonthRange();
        const [expense, income] = await Promise.all([
          getCategoryBreakdown(start, end, "expense"),
          getCategoryBreakdown(start, end, "income"),
        ]);
        setExpenseBreakdown(expense);
        setIncomeBreakdown(income);
      })();
    }, []),
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.heading}>This Month's Reports</Text>

        <Text style={styles.sectionTitle}>Spending by Category</Text>
        <BreakdownList data={expenseBreakdown} />

        <Text style={styles.sectionTitle}>Income by Category</Text>
        <BreakdownList data={incomeBreakdown} />
      </ScrollView>
    </SafeAreaView>
  );
}

function BreakdownList({ data }: { data: CategoryBreakdown[] }) {
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
                  backgroundColor: row.category_color ?? Colors.primary,
                },
              ]}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    backgroundColor: Colors.background,
  },
  scroll: { paddingBottom: 40 },
  heading: {
    fontFamily: Fonts.bold,
    fontSize: 24,
    color: Colors.ink,
    marginTop: Spacing.three,
    marginBottom: Spacing.five,
  },
  sectionTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: Colors.muted,
    marginTop: Spacing.three,
    marginBottom: Spacing.three,
  },
  barLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  barLabel: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.ink },
  barValue: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.ink },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
    overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: 4 },
  empty: {
    fontFamily: Fonts.regular,
    color: Colors.muted,
    marginBottom: Spacing.four,
  },
});
