import { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Colors, Fonts, Radii, Spacing } from "@/constants/theme";
import type { TransactionType } from "@/db/types";
import { useLedgerStore } from "@/stores/useLedgerStore";
import { parseAmountInput } from "@/utils/currency";
import { currentMonthRange, toIsoDate } from "@/utils/date";

export default function AddTransactionScreen() {
  const accounts = useLedgerStore((s) => s.accounts);
  const categories = useLedgerStore((s) => s.categories);
  const addTransaction = useLedgerStore((s) => s.addTransaction);

  const [type, setType] = useState<TransactionType>("expense");
  const [amountText, setAmountText] = useState("");
  const [note, setNote] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const accountId = accounts[0]?.id ?? null;
  const filteredCategories = categories.filter((c) => c.type === type);

  async function handleSubmit() {
    const amount = parseAmountInput(amountText);
    if (!amount) {
      Alert.alert("Invalid amount", "Enter an amount greater than 0.");
      return;
    }
    if (!categoryId) {
      Alert.alert("Pick a category", "Choose a category for this transaction.");
      return;
    }
    if (!accountId) {
      Alert.alert("No account", "Create an account first in Settings.");
      return;
    }

    setSubmitting(true);
    try {
      const { start, end } = currentMonthRange();
      await addTransaction(
        {
          account_id: accountId,
          category_id: categoryId,
          type,
          amount,
          note: note.trim() || undefined,
          date: toIsoDate(new Date()),
        },
        start,
        end,
      );
      setAmountText("");
      setNote("");
      setCategoryId(null);
      Alert.alert("Saved", "Transaction added.");
    } catch {
      Alert.alert("Error", "Could not save transaction. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.heading}>Add Transaction</Text>

        <View style={styles.toggleRow}>
          <TypeToggleButton
            label="Expense"
            active={type === "expense"}
            color={Colors.expense}
            onPress={() => {
              setType("expense");
              setCategoryId(null);
            }}
          />
          <TypeToggleButton
            label="Income"
            active={type === "income"}
            color={Colors.income}
            onPress={() => {
              setType("income");
              setCategoryId(null);
            }}
          />
        </View>

        <Text style={styles.label}>Amount</Text>
        <TextInput
          style={styles.amountInput}
          value={amountText}
          onChangeText={setAmountText}
          placeholder="0.00"
          placeholderTextColor={Colors.muted}
          keyboardType="decimal-pad"
        />

        <Text style={styles.label}>Category</Text>
        <View style={styles.chipRow}>
          {filteredCategories.map((cat) => (
            <Pressable
              key={cat.id}
              onPress={() => setCategoryId(cat.id)}
              style={[
                styles.chip,
                categoryId === cat.id && {
                  backgroundColor: cat.color ?? Colors.primary,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  categoryId === cat.id && {
                    color: Colors.white,
                    fontFamily: Fonts.semiBold,
                  },
                ]}
              >
                {cat.name}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Note (optional)</Text>
        <TextInput
          style={styles.noteInput}
          value={note}
          onChangeText={setNote}
          placeholder="e.g. Groceries at the market"
          placeholderTextColor={Colors.muted}
        />

        <Pressable
          style={[styles.submitButton, submitting && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          <Text style={styles.submitText}>
            {submitting ? "Saving…" : "Save Transaction"}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function TypeToggleButton({
  label,
  active,
  color,
  onPress,
}: {
  label: string;
  active: boolean;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.toggleButton,
        active && { backgroundColor: color, borderColor: color },
      ]}
    >
      <Text
        style={[
          styles.toggleText,
          active && { color: Colors.white, fontFamily: Fonts.semiBold },
        ]}
      >
        {label}
      </Text>
    </Pressable>
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
  toggleRow: {
    flexDirection: "row",
    gap: Spacing.three,
    marginBottom: Spacing.five,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: Spacing.three,
    borderRadius: Radii.medium,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    backgroundColor: Colors.surface,
  },
  toggleText: { fontFamily: Fonts.medium, color: Colors.ink },
  label: {
    fontFamily: Fonts.medium,
    color: Colors.muted,
    marginBottom: Spacing.two,
    marginTop: Spacing.three,
  },
  amountInput: {
    fontFamily: Fonts.bold,
    fontSize: 32,
    color: Colors.ink,
    paddingVertical: Spacing.two,
    borderBottomWidth: 2,
    borderBottomColor: Colors.border,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },
  chip: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Radii.pill,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipText: { fontFamily: Fonts.regular, color: Colors.ink },
  noteInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.medium,
    padding: Spacing.three,
    fontFamily: Fonts.regular,
    color: Colors.ink,
    backgroundColor: Colors.surface,
  },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radii.medium,
    paddingVertical: Spacing.four,
    alignItems: "center",
    marginTop: Spacing.six,
  },
  submitText: { color: Colors.white, fontFamily: Fonts.bold, fontSize: 16 },
});
