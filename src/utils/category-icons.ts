import type { Ionicons } from "@expo/vector-icons";

/**
 * Maps the icon strings stored in the categories table to actual Ionicons
 * glyph names. Our seed data uses simple, readable names (e.g. "utensils")
 * that don't match Ionicons' real names (e.g. "restaurant") — this bridges
 * the two so a mismatch never renders a broken icon.
 */
const ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
  wallet: "wallet",
  briefcase: "briefcase",
  "plus-circle": "add-circle",
  utensils: "restaurant",
  car: "car",
  home: "home",
  zap: "flash",
  "shopping-bag": "bag-handle",
  heart: "heart",
  "more-horizontal": "ellipsis-horizontal",
};

export function getCategoryIcon(
  icon: string | null,
): keyof typeof Ionicons.glyphMap {
  if (icon && ICON_MAP[icon]) return ICON_MAP[icon];
  return "pricetag";
}
