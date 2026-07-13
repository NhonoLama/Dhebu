import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Colors, Fonts, Spacing } from "@/constants/theme";
import type { TransactionWithRelations } from "@/db/types";
import { getTransactionsByDateRange } from "@/repositories/transactions.repo";
import { useLedgerStore } from "@/stores/useLedgerStore";
import { formatCurrency } from "@/utils/currency";
import { currentMonthRange, formatDisplayDate } from "@/utils/date";

export default function TransactionsScreen() {
  const removeTransaction = useLedgerStore((s) => s.removeTransaction);
  const [items, setItems] = useState<TransactionWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const { start, end } = currentMonthRange();

  async function load() {
    setLoading(true);
    const data = await getTransactionsByDateRange(start, end);
    setItems(data);
    setLoading(false);
  }

  useFocusEffect(
    useCallback(() => {
      load();
    }, []),
  );

  function confirmDelete(id: number) {
    Alert.alert("Delete transaction?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await removeTransaction(id, start, end);
          load();
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Text style={styles.heading}>Transactions</Text>
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        refreshing={loading}
        onRefresh={load}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onLongPress={() => confirmDelete(item.id)}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{item.category_name}</Text>
              <Text style={styles.rowSub}>
                {formatDisplayDate(item.date)} · {item.account_name}
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
          </Pressable>
        )}
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.empty}>No transactions this month.</Text>
          ) : null
        }
      />
    </SafeAreaView>
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
    fontSize: 24,
    color: Colors.ink,
    marginTop: Spacing.three,
    marginBottom: Spacing.three,
  },
  list: { gap: 2, paddingBottom: Spacing.six },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
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
