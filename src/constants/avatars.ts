import type { ImageSourcePropType } from "react-native";

export type AvatarId =
  | "avatar_01"
  | "avatar_02"
  | "avatar_03"
  | "avatar_04"
  | "avatar_05"
  | "avatar_06"
  | "avatar_07"
  | "avatar_08"
  | "avatar_09"
  | "avatar_10"
  | "avatar_11"
  | "avatar_12"
  | "avatar_13"
  | "avatar_14"
  | "avatar_15"
  | "avatar_16";

export interface DhebuAvatar {
  id: AvatarId;
  source: ImageSourcePropType;
}

export const AVATARS: DhebuAvatar[] = [
  {
    id: "avatar_01",
    source: require("../../assets/images/avatars/avatar_01.png"),
  },
  {
    id: "avatar_02",
    source: require("../../assets/images/avatars/avatar_02.png"),
  },
  {
    id: "avatar_03",
    source: require("../../assets/images/avatars/avatar_03.png"),
  },
  {
    id: "avatar_04",
    source: require("../../assets/images/avatars/avatar_04.png"),
  },
  {
    id: "avatar_05",
    source: require("../../assets/images/avatars/avatar_05.png"),
  },
  {
    id: "avatar_06",
    source: require("../../assets/images/avatars/avatar_06.png"),
  },
  {
    id: "avatar_07",
    source: require("../../assets/images/avatars/avatar_07.png"),
  },
  {
    id: "avatar_08",
    source: require("../../assets/images/avatars/avatar_08.png"),
  },
  {
    id: "avatar_09",
    source: require("../../assets/images/avatars/avatar_09.png"),
  },
  {
    id: "avatar_10",
    source: require("../../assets/images/avatars/avatar_10.png"),
  },
  {
    id: "avatar_11",
    source: require("../../assets/images/avatars/avatar_11.png"),
  },
  {
    id: "avatar_12",
    source: require("../../assets/images/avatars/avatar_12.png"),
  },
  {
    id: "avatar_13",
    source: require("../../assets/images/avatars/avatar_13.png"),
  },
  {
    id: "avatar_14",
    source: require("../../assets/images/avatars/avatar_14.png"),
  },
  {
    id: "avatar_15",
    source: require("../../assets/images/avatars/avatar_15.png"),
  },
  {
    id: "avatar_16",
    source: require("../../assets/images/avatars/avatar_16.png"),
  },
];

export const DEFAULT_AVATAR_ID: AvatarId = "avatar_01";

export function getAvatarSource(avatarId?: string | null): ImageSourcePropType {
  return (
    AVATARS.find((avatar) => avatar.id === avatarId)?.source ??
    AVATARS[0].source
  );
}
