import { useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useLedgerStore } from '@/stores/useLedgerStore';
import { createAccount } from '@/repositories/accounts.repo';

export default function SettingsScreen() {
  const accounts = useLedgerStore((s) => s.accounts);
  const categories = useLedgerStore((s) => s.categories);
  const init = useLedgerStore((s) => s.init);

  const [newAccountName, setNewAccountName] = useState('');

  async function handleAddAccount() {
    if (!newAccountName.trim()) return;
    await createAccount({ name: newAccountName.trim(), type: 'other' });
    setNewAccountName('');
    await init();
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ThemedText type="title" style={styles.heading}>
        Settings
      </ThemedText>

      <ThemedText type="subtitle" style={styles.sectionTitle}>
        Accounts
      </ThemedText>
      {accounts.map((a) => (
        <View key={a.id} style={styles.item}>
          <ThemedText>{a.name}</ThemedText>
          <ThemedText type="small">{a.type}</ThemedText>
        </View>
      ))}
      <View style={styles.addRow}>
        <TextInput
          style={styles.input}
          placeholder="New account name"
          value={newAccountName}
          onChangeText={setNewAccountName}
        />
        <Pressable style={styles.addButton} onPress={handleAddAccount}>
          <ThemedText style={{ color: 'white', fontWeight: '600' }}>Add</ThemedText>
        </Pressable>
      </View>

      <ThemedText type="subtitle" style={styles.sectionTitle}>
        Categories
      </ThemedText>
      {categories.map((c) => (
        <View key={c.id} style={styles.item}>
          <ThemedText>{c.name}</ThemedText>
          <ThemedText type="small">{c.type}</ThemedText>
        </View>
      ))}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16 },
  heading: { marginTop: 12, marginBottom: 12 },
  sectionTitle: { marginTop: 20, marginBottom: 8 },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#00000020',
  },
  addRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#00000020',
    borderRadius: 10,
    padding: 10,
  },
  addButton: {
    backgroundColor: '#208AEF',
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
});
