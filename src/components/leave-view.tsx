import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Colors, Fonts, Radii, Spacing } from "@/constants/theme";
import type { LeaveDay, LeaveSettings } from "@/repositories/leave.repo";
import {
  getAllLeaveDays,
  getLeaveSettings,
  markLeaveDay,
  setLeaveRate,
  unmarkLeaveDay,
} from "@/repositories/leave.repo";
import { formatDisplayDate } from "@/utils/date";
import { calculateAccruedDays, calculateBalance } from "@/utils/leave";

const LEAVE_COLOR = "#F0A03D"; // distinct from primary blue — this is "leave," not a note

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function LeaveView() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [settings, setSettings] = useState<LeaveSettings | null>(null);
  const [leaveDays, setLeaveDays] = useState<LeaveDay[]>([]);
  const [rateInput, setRateInput] = useState("");

  const load = useCallback(async () => {
    const [s, days] = await Promise.all([
      getLeaveSettings(),
      getAllLeaveDays(),
    ]);
    setSettings(s);
    setLeaveDays(days);
    if (s) setRateInput(String(s.days_per_month));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handleSaveRate() {
    const rate = Number(rateInput);
    if (!Number.isFinite(rate) || rate <= 0) {
      Alert.alert("Invalid rate", "Enter a number greater than 0.");
      return;
    }
    await setLeaveRate(rate);
    load();
  }

  async function handleToggleDate(iso: string) {
    const alreadyTaken = leaveDays.some((d) => d.date === iso);
    if (alreadyTaken) {
      Alert.alert(
        "Remove leave?",
        `Unmark ${formatDisplayDate(iso)} as leave taken?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: async () => {
              await unmarkLeaveDay(iso);
              load();
            },
          },
        ],
      );
    } else {
      Alert.alert(
        "Mark as leave?",
        `Mark ${formatDisplayDate(iso)} as a leave day?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Mark",
            onPress: async () => {
              await markLeaveDay(iso);
              load();
            },
          },
        ],
      );
    }
  }

  function shiftMonth(delta: number) {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  const takenDates = new Set(leaveDays.map((d) => d.date));
  const balance = settings
    ? calculateBalance(
        settings.start_date,
        settings.days_per_month,
        leaveDays.length,
      )
    : 0;
  const accrued = settings
    ? calculateAccruedDays(settings.start_date, settings.days_per_month)
    : 0;

  const firstOfMonth = new Date(year, month, 1);
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<{ day: number; iso: string } | null> = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      return { day, iso: `${year}-${pad(month + 1)}-${pad(day)}` };
    }),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Leave Balance</Text>
        <Text style={styles.balanceValue}>{balance.toFixed(1)} days</Text>
        <Text style={styles.balanceSub}>
          {accrued.toFixed(1)} accrued · {leaveDays.length} taken
        </Text>
      </View>

      {!settings && (
        <View style={styles.setupNotice}>
          <Text style={styles.setupText}>
            Set your monthly leave rate to start tracking.
          </Text>
        </View>
      )}

      <Text style={styles.sectionTitle}>Monthly Leave Rate</Text>
      <View style={styles.rateRow}>
        <TextInput
          style={styles.rateInput}
          value={rateInput}
          onChangeText={setRateInput}
          placeholder="e.g. 2"
          placeholderTextColor={Colors.muted}
          keyboardType="decimal-pad"
        />
        <Text style={styles.rateSuffix}>days / month</Text>
        <Pressable style={styles.saveButton} onPress={handleSaveRate}>
          <Text style={styles.saveButtonText}>Save</Text>
        </Pressable>
      </View>

      <View style={styles.monthNav}>
        <Pressable onPress={() => shiftMonth(-1)}>
          <Text style={styles.navArrow}>‹</Text>
        </Pressable>
        <Text style={styles.monthLabel}>
          {new Date(year, month, 1).toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
          })}
        </Text>
        <Pressable onPress={() => shiftMonth(1)}>
          <Text style={styles.navArrow}>›</Text>
        </Pressable>
      </View>

      <View style={styles.grid}>
        {cells.map((item, i) => {
          if (!item) return <View key={i} style={styles.cell} />;
          const isTaken = takenDates.has(item.iso);
          return (
            <Pressable
              key={i}
              style={[styles.cell, isTaken && styles.cellTaken]}
              onPress={() => handleToggleDate(item.iso)}
            >
              <Text style={[styles.dayText, isTaken && styles.dayTextTaken]}>
                {item.day}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sectionTitle}>Leave History</Text>
      {leaveDays.length === 0 && (
        <Text style={styles.empty}>No leave days marked yet.</Text>
      )}
      {leaveDays.map((d) => (
        <Pressable
          key={d.id}
          style={styles.historyRow}
          onLongPress={() => handleToggleDate(d.date)}
        >
          <Text style={styles.historyText}>{formatDisplayDate(d.date)}</Text>
          <Text style={styles.historyHint}>long-press to remove</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: Spacing.six },
  balanceCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.large,
    padding: Spacing.four,
    alignItems: "center",
    marginBottom: Spacing.four,
  },
  balanceLabel: { fontFamily: Fonts.medium, color: Colors.muted, fontSize: 13 },
  balanceValue: {
    fontFamily: Fonts.bold,
    color: LEAVE_COLOR,
    fontSize: 32,
    marginTop: 4,
  },
  balanceSub: {
    fontFamily: Fonts.regular,
    color: Colors.muted,
    fontSize: 12,
    marginTop: 4,
  },
  setupNotice: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.medium,
    padding: Spacing.three,
    marginBottom: Spacing.four,
  },
  setupText: { fontFamily: Fonts.regular, color: Colors.muted, fontSize: 13 },
  sectionTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: Colors.primary,
    marginTop: Spacing.four,
    marginBottom: Spacing.two,
  },
  rateRow: { flexDirection: "row", alignItems: "center", gap: Spacing.two },
  rateInput: {
    width: 70,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.medium,
    padding: Spacing.two,
    fontFamily: Fonts.medium,
    color: Colors.ink,
    backgroundColor: Colors.surface,
  },
  rateSuffix: {
    fontFamily: Fonts.regular,
    color: Colors.muted,
    fontSize: 13,
    flex: 1,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radii.medium,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  saveButtonText: { color: Colors.white, fontFamily: Fonts.semiBold },
  monthNav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.four,
    marginBottom: Spacing.two,
  },
  navArrow: {
    fontSize: 24,
    color: Colors.primary,
    paddingHorizontal: Spacing.three,
  },
  monthLabel: { fontFamily: Fonts.semiBold, fontSize: 15, color: Colors.ink },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radii.medium,
  },
  cellTaken: { backgroundColor: LEAVE_COLOR },
  dayText: { fontFamily: Fonts.regular, color: Colors.ink, fontSize: 14 },
  dayTextTaken: { color: Colors.white, fontFamily: Fonts.semiBold },
  empty: {
    fontFamily: Fonts.regular,
    color: Colors.muted,
    marginBottom: Spacing.three,
  },
  historyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  historyText: { fontFamily: Fonts.medium, color: Colors.ink },
  historyHint: { fontFamily: Fonts.regular, color: Colors.muted, fontSize: 11 },
});
