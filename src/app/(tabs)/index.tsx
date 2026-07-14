import { router } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Colors, Fonts, Radii, Shadows, Spacing } from "@/constants/theme";
import { useLedgerStore } from "@/stores/useLedgerStore";
import { formatCurrency } from "@/utils/currency";
import { formatDisplayDate } from "@/utils/date";

export default function DashboardScreen() {
  const summary = useLedgerStore((s) => s.currentPeriodSummary);
  const recent = useLedgerStore((s) => s.recentTransactions);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.greeting}>Hi there 👋</Text>
          <Text style={styles.subGreeting}>Here's your financial summary</Text>
        </View>
        <Pressable
          style={styles.avatar}
          onPress={() => router.push("/(tabs)/settings")}
        >
          <Text style={styles.avatarText}>D</Text>
        </Pressable>
      </View>

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
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.three,
    marginBottom: Spacing.four,
  },
  greeting: { fontFamily: Fonts.bold, fontSize: 20, color: Colors.ink },
  subGreeting: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.muted,
    marginTop: 2,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: Radii.pill,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontFamily: Fonts.bold, color: Colors.white, fontSize: 16 },
  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.large,
    padding: Spacing.four,
    gap: Spacing.two,
    ...Shadows.soft,
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
  list: { gap: Spacing.one, paddingBottom: Spacing.six + 64 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.three,
    marginBottom: Spacing.two,
    borderRadius: Radii.medium,
    backgroundColor: Colors.surface,
    ...Shadows.soft,
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
