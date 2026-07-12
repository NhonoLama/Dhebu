import { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useLedgerStore } from '@/stores/useLedgerStore';
import { getTransactionsByDateRange } from '@/repositories/transactions.repo';
import { formatCurrency } from '@/utils/currency';
import { currentMonthRange, formatDisplayDate } from '@/utils/date';
import type { TransactionWithRelations } from '@/db/types';

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

  useEffect(() => {
    load();
  }, []);

  function confirmDelete(id: number) {
    Alert.alert('Delete transaction?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await removeTransaction(id, start, end);
          load();
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ThemedText type="title" style={styles.heading}>
        Transactions
      </ThemedText>
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
              <ThemedText>{item.category_name}</ThemedText>
              <ThemedText type="small">
                {formatDisplayDate(item.date)} · {item.account_name}
                {item.note ? ` · ${item.note}` : ''}
              </ThemedText>
            </View>
            <ThemedText
              style={{
                color: item.type === 'income' ? '#22C55E' : '#EF4444',
                fontWeight: '600',
              }}
            >
              {item.type === 'income' ? '+' : '-'}
              {formatCurrency(item.amount)}
            </ThemedText>
          </Pressable>
        )}
        ListEmptyComponent={
          !loading ? (
            <ThemedText type="small" style={styles.empty}>
              No transactions this month.
            </ThemedText>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16 },
  heading: { marginTop: 12, marginBottom: 12 },
  list: { gap: 4, paddingBottom: 24 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#00000020',
  },
  empty: { textAlign: 'center', marginTop: 24 },
});
