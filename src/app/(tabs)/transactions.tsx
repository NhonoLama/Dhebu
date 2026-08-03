import { useEffect, useMemo, useState } from "react";
import { Alert, FlatList, StyleSheet, Text, View } from "react-native";
import Animated, { FadeOut } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { AnimatedPressable } from "@/components/animated-pressable";
import { ColorScheme, Fonts, Spacing } from "@/constants/theme";
import type { TransactionWithRelations } from "@/db/types";
import { getTransactionsByDateRange } from "@/repositories/transactions.repo";
import { useLedgerStore } from "@/stores/useLedgerStore";
import { useTheme } from "@/theme/theme-context";
import { formatCurrency } from "@/utils/currency";
import { currentMonthRange, formatDisplayDate } from "@/utils/date";

export default function TransactionsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

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

  useEffect(() => {
    load();
  }, []);

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
          <Animated.View exiting={FadeOut.duration(250)}>
            <AnimatedPressable
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
                      item.type === "income" ? colors.income : colors.expense,
                  },
                ]}
              >
                {item.type === "income" ? "+" : "-"}
                {formatCurrency(item.amount)}
              </Text>
            </AnimatedPressable>
          </Animated.View>
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

function createStyles(colors: ColorScheme) {
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
      marginBottom: Spacing.three,
    },
    list: { gap: 2, paddingBottom: Spacing.six + 64 },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: Spacing.three,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
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
  });
}
