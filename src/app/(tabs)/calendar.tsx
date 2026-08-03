import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CalendarGrid } from "@/components/calendar-grid";
import { LeaveView } from "@/components/leave-view";
import { Colors, Fonts, Radii, Spacing } from "@/constants/theme";
import type { CalendarNote } from "@/db/types";
import {
  attachNotificationId,
  createNote,
  deleteNote,
  getNotesForDate,
  getNotesForMonth,
} from "@/repositories/calendar-notes.repo";
import { formatDisplayDate, toIsoDate } from "@/utils/date";
import {
  cancelReminder,
  ensureNotificationPermission,
  isExpoGo,
  scheduleReminder,
} from "@/utils/notifications";

type CalendarTab = "notes" | "leave";

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export default function CalendarScreen() {
  const [activeTab, setActiveTab] = useState<CalendarTab>("notes");
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(toIsoDate(today));
  const [notesForMonth, setNotesForMonth] = useState<CalendarNote[]>([]);
  const [notesForSelected, setNotesForSelected] = useState<CalendarNote[]>([]);
  const [noteText, setNoteText] = useState("");
  const [remindMe, setRemindMe] = useState(false);

  const loadMonth = useCallback(async () => {
    const start = `${year}-${pad(month + 1)}-01`;
    const end = `${year}-${pad(month + 1)}-31`;
    const notes = await getNotesForMonth(start, end);
    setNotesForMonth(notes);
  }, [year, month]);

  const loadSelectedDate = useCallback(async () => {
    const notes = await getNotesForDate(selectedDate);
    setNotesForSelected(notes);
  }, [selectedDate]);

  useFocusEffect(
    useCallback(() => {
      loadMonth();
      loadSelectedDate();
    }, [loadMonth, loadSelectedDate]),
  );

  const datesWithNotes = new Set(notesForMonth.map((n) => n.date));

  function shiftMonth(delta: number) {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  function shiftSelectedDate(days: number) {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    const iso = toIsoDate(d);
    setSelectedDate(iso);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  async function handleAddNote() {
    if (!noteText.trim()) return;

    let notificationId: string | null = null;
    if (remindMe) {
      const granted = await ensureNotificationPermission();
      if (!granted) {
        Alert.alert(
          "Notifications disabled",
          "Enable notifications in your phone settings to use reminders.",
        );
        return;
      }
    }

    const noteId = await createNote({
      date: selectedDate,
      note: noteText.trim(),
      remind: remindMe,
    });

    if (remindMe) {
      // Fire at 9 AM on the selected date.
      const fireDate = new Date(selectedDate);
      fireDate.setHours(9, 0, 0, 0);
      notificationId = await scheduleReminder(
        "Dhebu reminder",
        noteText.trim(),
        fireDate,
      );
      if (notificationId) {
        await attachNotificationId(noteId, notificationId);
      }
    }

    setNoteText("");
    setRemindMe(false);
    loadMonth();
    loadSelectedDate();
  }

  function handleDeleteNote(note: CalendarNote) {
    Alert.alert("Delete this note?", undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const deleted = await deleteNote(note.id);
          if (deleted?.notification_id) {
            await cancelReminder(deleted.notification_id);
          }
          loadMonth();
          loadSelectedDate();
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.topArea}>
        <Text style={styles.heading}>Calendar</Text>

        <View style={styles.tabToggle}>
          <Pressable
            style={[
              styles.tabButton,
              activeTab === "notes" && styles.tabButtonActive,
            ]}
            onPress={() => setActiveTab("notes")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "notes" && styles.tabTextActive,
              ]}
            >
              Calendar
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.tabButton,
              activeTab === "leave" && styles.tabButtonActive,
            ]}
            onPress={() => setActiveTab("leave")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "leave" && styles.tabTextActive,
              ]}
            >
              Leave
            </Text>
          </Pressable>
        </View>
      </View>

      {activeTab === "leave" ? (
        <View style={styles.leaveWrapper}>
          <LeaveView />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
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

          <CalendarGrid
            year={year}
            month={month}
            selectedDate={selectedDate}
            datesWithNotes={datesWithNotes}
            onSelectDate={setSelectedDate}
          />

          <Text style={styles.sectionTitle}>
            {formatDisplayDate(selectedDate)}
          </Text>

          <View style={styles.quickShiftRow}>
            <QuickShiftButton
              label="+1 Week"
              onPress={() => shiftSelectedDate(7)}
            />
            <QuickShiftButton
              label="+1 Month"
              onPress={() => shiftSelectedDate(30)}
            />
            <QuickShiftButton
              label="+1 Year"
              onPress={() => shiftSelectedDate(365)}
            />
          </View>

          {notesForSelected.map((n) => (
            <Pressable
              key={n.id}
              style={styles.noteRow}
              onLongPress={() => handleDeleteNote(n)}
            >
              <Text style={styles.noteText}>{n.note}</Text>
              {n.remind && <Text style={styles.reminderTag}>🔔 9:00 AM</Text>}
            </Pressable>
          ))}
          {notesForSelected.length === 0 && (
            <Text style={styles.empty}>
              No notes on this date. Long-press a note to delete it.
            </Text>
          )}

          <TextInput
            style={styles.input}
            placeholder="Add a note for this date"
            placeholderTextColor={Colors.muted}
            value={noteText}
            onChangeText={setNoteText}
          />

          <View style={styles.remindRow}>
            <Text style={styles.remindLabel}>
              {isExpoGo
                ? "Reminders need a development build (not available in Expo Go)"
                : "Remind me at 9 AM on this date"}
            </Text>
            <Switch
              value={remindMe}
              onValueChange={setRemindMe}
              disabled={isExpoGo}
              trackColor={{ true: Colors.primary }}
            />
          </View>

          <Pressable style={styles.addButton} onPress={handleAddNote}>
            <Text style={styles.addButtonText}>Save Note</Text>
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function QuickShiftButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.quickShiftChip} onPress={onPress}>
      <Text style={styles.quickShiftText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topArea: { paddingHorizontal: Spacing.four },
  scroll: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.six },
  leaveWrapper: { flex: 1, paddingHorizontal: Spacing.four },
  heading: {
    fontFamily: Fonts.bold,
    fontSize: 24,
    color: Colors.ink,
    marginTop: Spacing.three,
    marginBottom: Spacing.three,
  },
  tabToggle: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderRadius: Radii.pill,
    padding: 4,
    gap: 4,
    marginBottom: Spacing.four,
  },
  tabButton: {
    flex: 1,
    paddingVertical: Spacing.two,
    borderRadius: Radii.pill,
    alignItems: "center",
  },
  tabButtonActive: { backgroundColor: Colors.primary },
  tabText: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.muted },
  tabTextActive: { color: Colors.white, fontFamily: Fonts.semiBold },
  monthNav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.three,
  },
  navArrow: {
    fontSize: 28,
    color: Colors.primary,
    paddingHorizontal: Spacing.three,
  },
  monthLabel: { fontFamily: Fonts.semiBold, fontSize: 16, color: Colors.ink },
  sectionTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: Colors.muted,
    marginTop: Spacing.five,
    marginBottom: Spacing.two,
  },
  quickShiftRow: {
    flexDirection: "row",
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  quickShiftChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radii.pill,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickShiftText: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: Colors.primary,
  },
  noteRow: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.medium,
    padding: Spacing.three,
    marginBottom: Spacing.two,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  noteText: { fontFamily: Fonts.regular, color: Colors.ink },
  reminderTag: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: Colors.primary,
    marginTop: 4,
  },
  empty: {
    fontFamily: Fonts.regular,
    color: Colors.muted,
    marginBottom: Spacing.three,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.medium,
    padding: Spacing.three,
    fontFamily: Fonts.regular,
    color: Colors.ink,
    backgroundColor: Colors.surface,
    marginTop: Spacing.three,
  },
  remindRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.three,
  },
  remindLabel: { fontFamily: Fonts.regular, color: Colors.ink, flex: 1 },
  addButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radii.medium,
    paddingVertical: Spacing.three,
    alignItems: "center",
    marginTop: Spacing.four,
  },
  addButtonText: { color: Colors.white, fontFamily: Fonts.semiBold },
});
