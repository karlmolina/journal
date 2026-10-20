// Body regions shared by the exercise library and the injury body map. The
// keys are stored in the database, so only add to this list.
export const BODY_REGIONS = [
  { key: "neck", label: "Neck" },
  { key: "shoulder", label: "Shoulder" },
  { key: "chest", label: "Chest" },
  { key: "upper_back", label: "Upper back" },
  { key: "lower_back", label: "Lower back" },
  { key: "core", label: "Core" },
  { key: "elbow", label: "Elbow" },
  { key: "wrist_hand", label: "Wrist & hand" },
  { key: "hip", label: "Hip" },
  { key: "glute", label: "Glutes" },
  { key: "quad", label: "Quads" },
  { key: "hamstring", label: "Hamstrings" },
  { key: "knee", label: "Knee" },
  { key: "calf", label: "Calf" },
  { key: "ankle_foot", label: "Ankle & foot" },
] as const;

export type BodyRegion = (typeof BODY_REGIONS)[number]["key"];

const LABELS = new Map<string, string>(
  BODY_REGIONS.map((r) => [r.key, r.label]),
);

export const regionLabel = (key: string) => LABELS.get(key) ?? key;
