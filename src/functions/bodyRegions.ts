import type { Side } from "../hooks/useInjuries";

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

export const placeKey = (region: string, side: Side) => `${region}:${side}`;

export function placeLabel(region: string, side: Side) {
  const label = regionLabel(region);
  if (side === "center") return label;
  return `${side === "left" ? "Left" : "Right"} ${label.toLowerCase()}`;
}

// Tailwind fill classes for a pain level (no check-in yet = neutral marker).
export function painFill(pain: number | null) {
  if (pain === null) return "fill-base-content/45";
  if (pain <= 3) return "fill-success";
  if (pain <= 6) return "fill-warning";
  return "fill-error";
}

export function painText(pain: number) {
  if (pain <= 3) return "text-success";
  if (pain <= 6) return "text-warning";
  return "text-error";
}
