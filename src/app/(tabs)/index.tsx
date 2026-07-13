import { FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Colors, Fonts, Radii, Spacing } from "@/constants/theme";
import { useLedgerStore } from "@/stores/useLedgerStore";
import { formatCurrency } from "@/utils/currency";
import { formatDisplayDate } from "@/utils/date";

export default function DashboardScreen() {
  const summary = useLedgerStore((s) => s.currentPeriodSummary);
  const recent = useLedgerStore((s) => s.recentTransactions);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Text style={styles.heading}>Dhebu</Text>

      <View style={styles.summaryCard}>
        <SummaryRow
          label="Income"
          value={summary.income}
          color={Colors.income}
        />
        <SummaryRow
          label="Expense"
          value={summary.expense}
          color={Colors.expense}
        />
        <View style={styles.divider} />
        <SummaryRow
          label="Balance"
          value={summary.balance}
          color={summary.balance >= 0 ? Colors.income : Colors.expense}
          bold
        />
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
                    item.type === "income" ? Colors.income : Colors.expense,
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
                    item.type === "income" ? Colors.income : Colors.expense,
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
      />
    </SafeAreaView>
  );
}

function SummaryRow({
  label,
  value,
  color,
  bold,
}: {
  label: string;
  value: number;
  color: string;
  bold?: boolean;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text
        style={[styles.summaryLabel, bold && { fontFamily: Fonts.semiBold }]}
      >
        {label}
      </Text>
      <Text style={[styles.summaryValue, { color }]}>
        {formatCurrency(value)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    backgroundColor: Colors.background,
  },
  heading: {
    fontFamily: Fonts.bold,
    fontSize: 28,
    color: Colors.primary,
    marginTop: Spacing.three,
    marginBottom: Spacing.four,
  },
  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.large,
    padding: Spacing.four,
    gap: Spacing.two,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryLabel: { fontFamily: Fonts.regular, color: Colors.ink, fontSize: 14 },
  summaryValue: { fontFamily: Fonts.semiBold, fontSize: 16 },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.one,
  },
  sectionTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: Colors.muted,
    marginTop: Spacing.five,
    marginBottom: Spacing.two,
  },
  list: { gap: Spacing.one, paddingBottom: Spacing.six },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  badge: {
    width: 32,
    height: 32,
    borderRadius: Radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: Colors.white, fontFamily: Fonts.bold, fontSize: 16 },
  rowTitle: { fontFamily: Fonts.medium, color: Colors.ink },
  rowSub: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.muted,
    marginTop: 2,
  },
  amount: { fontFamily: Fonts.semiBold, fontSize: 15 },
  empty: {
    textAlign: "center",
    marginTop: Spacing.five,
    fontFamily: Fonts.regular,
    color: Colors.muted,
  },
});
