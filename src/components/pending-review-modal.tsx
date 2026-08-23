import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import type { ColorScheme } from "@/constants/theme";
import { Fonts, Radii, Spacing } from "@/constants/theme";
import type { TransactionType } from "@/db/types";
import {
  confirmPendingTransaction,
  getPendingTransactions,
  markPendingDismissed,
  type PendingTransaction,
} from "@/repositories/pending-transactions.repo";
import { useLedgerStore } from "@/stores/useLedgerStore";
import { useTheme } from "@/theme/theme-context";
import { formatCurrency, parseAmountInput } from "@/utils/currency";
import { toIsoDate } from "@/utils/date";

interface PendingReviewModalProps {
  visible: boolean;
  onClose: () => void;
}

export function PendingReviewModal({
  visible,
  onClose,
}: PendingReviewModalProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const accounts = useLedgerStore((s) => s.accounts);
  const categories = useLedgerStore((s) => s.categories);
  const [items, setItems] = useState<PendingTransaction[]>([]);

  // Per-item editable overrides, keyed by pending transaction id.
  const [amountEdits, setAmountEdits] = useState<Record<number, string>>({});
  const [typeEdits, setTypeEdits] = useState<Record<number, TransactionType>>(
    {},
  );
  const [categoryEdits, setCategoryEdits] = useState<
    Record<number, number | null>
  >({});

  const load = useCallback(async () => {
    const pending = await getPendingTransactions();
    setItems(pending);

    const amounts: Record<number, string> = {};
    const types: Record<number, TransactionType> = {};
    const cats: Record<number, number | null> = {};
    for (const item of pending) {
      amounts[item.id] = item.detected_amount
        ? String(item.detected_amount)
        : "";
      types[item.id] = item.detected_type ?? "expense";
      cats[item.id] = item.detected_category_id;
    }
    setAmountEdits(amounts);
    setTypeEdits(types);
    setCategoryEdits(cats);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (visible) load();
    }, [visible, load]),
  );

  async function handleConfirm(item: PendingTransaction) {
    const accountId = accounts[0]?.id;

    const categoryId = categoryEdits[item.id];

    const amount = parseAmountInput(amountEdits[item.id] ?? "");

    const type = typeEdits[item.id];

    if (!accountId || !categoryId || !amount) {
      return;
    }

    const transactionId = await confirmPendingTransaction({
      pendingId: item.id,

      account_id: accountId,

      category_id: categoryId,

      type,

      amount,

      note: item.remarks ?? undefined,

      date: toIsoDate(
        item.notification_posted_at
          ? new Date(item.notification_posted_at)
          : new Date(item.created_at),
      ),
    });

    /*
     * null means the pending item was already
     * handled or no longer exists.
     */
    if (transactionId === null) {
      await load();
      return;
    }

    await load();
  }

  async function handleDismiss(item: PendingTransaction) {
    await markPendingDismissed(item.id);
    await load();
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.heading}>Review Detected Transactions</Text>
          <Pressable onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {items.length === 0 && (
            <Text style={styles.empty}>No pending transactions to review.</Text>
          )}

          {items.map((item) => {
            const filteredCategories = categories.filter(
              (c) => c.type === typeEdits[item.id],
            );
            const canConfirm =
              !!categoryEdits[item.id] &&
              !!parseAmountInput(amountEdits[item.id] ?? "");

            return (
              <View key={item.id} style={styles.card}>
                <Text style={styles.remarks}>
                  {item.remarks || item.raw_text}
                </Text>

                <View style={styles.typeToggleRow}>
                  {(["expense", "income"] as const).map((t) => (
                    <Pressable
                      key={t}
                      onPress={() => {
                        const currentType = typeEdits[item.id];

                        if (currentType === t) {
                          return;
                        }

                        setTypeEdits((prev) => ({
                          ...prev,
                          [item.id]: t,
                        }));

                        setCategoryEdits((prev) => ({
                          ...prev,
                          [item.id]: null,
                        }));
                      }}
                      style={[
                        styles.typeChip,
                        typeEdits[item.id] === t && {
                          backgroundColor:
                            t === "income" ? colors.income : colors.expense,
                        },
                      ]}
                    >
                      <Text
                        style={
                          typeEdits[item.id] === t
                            ? {
                                color: colors.white,
                                fontFamily: Fonts.semiBold,
                              }
                            : { color: colors.muted }
                        }
                      >
                        {t === "income" ? "Income" : "Expense"}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <TextInput
                  style={styles.amountInput}
                  value={amountEdits[item.id]}
                  onChangeText={(text) =>
                    setAmountEdits((prev) => ({ ...prev, [item.id]: text }))
                  }
                  keyboardType="decimal-pad"
                  placeholder="Amount"
                  placeholderTextColor={colors.muted}
                />

                <Text style={styles.pickCategoryLabel}>Category</Text>
                <View style={styles.categoryRow}>
                  {filteredCategories.map((cat) => (
                    <Pressable
                      key={cat.id}
                      onPress={() =>
                        setCategoryEdits((prev) => ({
                          ...prev,
                          [item.id]: cat.id,
                        }))
                      }
                      style={[
                        styles.categoryChip,
                        categoryEdits[item.id] === cat.id && {
                          backgroundColor: cat.color ?? colors.primary,
                        },
                      ]}
                    >
                      <Text
                        style={
                          categoryEdits[item.id] === cat.id
                            ? {
                                color: colors.white,
                                fontFamily: Fonts.semiBold,
                              }
                            : { color: colors.ink }
                        }
                      >
                        {cat.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <View style={styles.actionRow}>
                  <Pressable
                    style={styles.dismissBtn}
                    onPress={() => handleDismiss(item)}
                  >
                    <Text style={styles.dismissText}>Dismiss</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.confirmBtn, !canConfirm && { opacity: 0.4 }]}
                    onPress={() => handleConfirm(item)}
                    disabled={!canConfirm}
                  >
                    <Text style={styles.confirmText}>
                      Confirm{" "}
                      {amountEdits[item.id]
                        ? formatCurrency(Number(amountEdits[item.id]))
                        : ""}
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, paddingTop: 50 },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: Spacing.four,
      marginBottom: Spacing.four,
    },
    heading: { fontFamily: Fonts.bold, fontSize: 20, color: colors.ink },
    closeText: { fontFamily: Fonts.semiBold, color: colors.primary },
    scroll: {
      paddingHorizontal: Spacing.four,
      paddingBottom: Spacing.six,
      gap: Spacing.four,
    },
    empty: {
      fontFamily: Fonts.regular,
      color: colors.muted,
      textAlign: "center",
      marginTop: Spacing.six,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: Radii.large,
      padding: Spacing.four,
      gap: Spacing.three,
      marginBottom: Spacing.three,
    },
    remarks: { fontFamily: Fonts.semiBold, color: colors.ink, fontSize: 15 },
    typeToggleRow: { flexDirection: "row", gap: Spacing.two },
    typeChip: {
      flex: 1,
      paddingVertical: Spacing.two,
      borderRadius: Radii.medium,
      backgroundColor: colors.background,
      alignItems: "center",
    },
    amountInput: {
      fontFamily: Fonts.bold,
      fontSize: 22,
      color: colors.ink,
      borderBottomWidth: 2,
      borderBottomColor: colors.border,
      paddingVertical: Spacing.two,
    },
    pickCategoryLabel: {
      fontFamily: Fonts.medium,
      color: colors.muted,
      fontSize: 12,
    },
    categoryRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },
    categoryChip: {
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two,
      borderRadius: Radii.pill,
      backgroundColor: colors.background,
    },
    actionRow: {
      flexDirection: "row",
      gap: Spacing.two,
      marginTop: Spacing.two,
    },
    dismissBtn: {
      flex: 1,
      paddingVertical: Spacing.three,
      borderRadius: Radii.medium,
      backgroundColor: colors.background,
      alignItems: "center",
    },
    dismissText: { fontFamily: Fonts.semiBold, color: colors.expense },
    confirmBtn: {
      flex: 2,
      paddingVertical: Spacing.three,
      borderRadius: Radii.medium,
      backgroundColor: colors.primary,
      alignItems: "center",
    },
    confirmText: { fontFamily: Fonts.semiBold, color: colors.white },
  });
}
