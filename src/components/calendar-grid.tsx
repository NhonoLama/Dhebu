import { Pressable, StyleSheet, Text, View } from "react-native";

import { Colors, Fonts, Radii, Spacing } from "@/constants/theme";

interface CalendarGridProps {
  year: number;
  month: number; // 0-indexed, like JS Date (0 = January)
  selectedDate: string; // yyyy-MM-dd
  datesWithNotes: Set<string>; // yyyy-MM-dd strings that have a note
  onSelectDate: (date: string) => void;
}

const WEEKDAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function CalendarGrid({
  year,
  month,
  selectedDate,
  datesWithNotes,
  onSelectDate,
}: CalendarGridProps) {
  const firstOfMonth = new Date(year, month, 1);
  // getDay(): 0 = Sunday. We want Monday-first, so shift it.
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: Array<{ day: number; iso: string } | null> = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      return { day, iso: `${year}-${pad(month + 1)}-${pad(day)}` };
    }),
  ];

  // Pad the end so the grid always completes full rows of 7 —
  // avoids uneven/broken layout on the last partial week.
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return (
    <View>
      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((label, i) => (
          <Text key={i} style={styles.weekdayLabel}>
            {label}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map((item, i) => {
          if (!item) return <View key={i} style={styles.cell} />;
          const isSelected = item.iso === selectedDate;
          const hasNote = datesWithNotes.has(item.iso);
          return (
            <Pressable
              key={i}
              style={[styles.cell, isSelected && styles.cellSelected]}
              onPress={() => onSelectDate(item.iso)}
            >
              <Text
                style={[styles.dayText, isSelected && styles.dayTextSelected]}
              >
                {item.day}
              </Text>
              {hasNote && (
                <View style={[styles.dot, isSelected && styles.dotSelected]} />
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  weekdayRow: { flexDirection: "row", marginBottom: Spacing.two },
  weekdayLabel: {
    width: `${100 / 7}%`,
    textAlign: "center",
    fontFamily: Fonts.semiBold,
    fontSize: 12,
    color: Colors.muted,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radii.medium,
  },
  cellSelected: { backgroundColor: Colors.primary },
  dayText: { fontFamily: Fonts.regular, color: Colors.ink, fontSize: 14 },
  dayTextSelected: { color: Colors.white, fontFamily: Fonts.semiBold },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.primary,
    marginTop: 2,
  },
  dotSelected: { backgroundColor: Colors.white },
});
