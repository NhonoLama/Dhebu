import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { getCategoryBreakdown } from '@/repositories/transactions.repo';
import { formatCurrency } from '@/utils/currency';
import { currentMonthRange } from '@/utils/date';
import type { CategoryBreakdown } from '@/db/types';

export default function ReportsScreen() {
  const [expenseBreakdown, setExpenseBreakdown] = useState<CategoryBreakdown[]>([]);
  const [incomeBreakdown, setIncomeBreakdown] = useState<CategoryBreakdown[]>([]);

  useEffect(() => {
    (async () => {
      const { start, end } = currentMonthRange();
      const [expense, income] = await Promise.all([
        getCategoryBreakdown(start, end, 'expense'),
        getCategoryBreakdown(start, end, 'income'),
      ]);
      setExpenseBreakdown(expense);
      setIncomeBreakdown(income);
    })();
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ThemedText type="title" style={styles.heading}>
          This Month's Reports
        </ThemedText>

        <ThemedText type="subtitle" style={styles.sectionTitle}>
          Spending by Category
        </ThemedText>
        <BreakdownList data={expenseBreakdown} />

        <ThemedText type="subtitle" style={styles.sectionTitle}>
          Income by Category
        </ThemedText>
        <BreakdownList data={incomeBreakdown} />
      </ScrollView>
    </SafeAreaView>
  );
}

function BreakdownList({ data }: { data: CategoryBreakdown[] }) {
  const max = Math.max(...data.map((d) => d.total), 1);

  if (data.length === 0) {
    return (
      <ThemedText type="small" style={styles.empty}>
        No data yet.
      </ThemedText>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      {data.map((row) => (
        <View key={row.category_id}>
          <View style={styles.barLabelRow}>
            <ThemedText type="small">{row.category_name}</ThemedText>
            <ThemedText type="small">{formatCurrency(row.total)}</ThemedText>
          </View>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                {
                  width: `${(row.total / max) * 100}%`,
                  backgroundColor: row.category_color ?? '#208AEF',
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
  container: { flex: 1, paddingHorizontal: 16 },
  scroll: { paddingBottom: 40 },
  heading: { marginTop: 12, marginBottom: 20 },
  sectionTitle: { marginTop: 8, marginBottom: 12 },
  barLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00000010',
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 4 },
  empty: { marginBottom: 16 },
});
