import type { WorkoutSet } from "../hooks/useWorkouts";
import { regionLabel } from "./bodyRegions";

// The seven major muscle groups past workouts are summed up by. Each
// library region (and "arms" from the name guesses) belongs to one.
const MUSCLE_GROUPS: Record<string, string> = {
  chest: "chest",
  upper_back: "back",
  mid_back: "back",
  lower_back: "back",
  neck: "back",
  shoulder: "shoulders",
  arms: "arms",
  elbow: "arms",
  wrist_hand: "arms",
  core: "core",
  glute: "glutes_hips",
  hip: "glutes_hips",
  quad: "legs",
  hamstring: "legs",
  knee: "legs",
  calf: "legs",
  ankle_foot: "legs",
};

// Labels for the groups, plus cardio and anything unknown.
const LABELS: Record<string, string> = {
  chest: "Chest",
  back: "Back",
  shoulders: "Shoulders",
  arms: "Arms",
  core: "Core",
  glutes_hips: "Glutes",
  legs: "Legs",
  cardio: "Cardio",
  other: "Other",
};

export const bodyPartLabel = (key: string) => LABELS[key] ?? regionLabel(key);

// Regions as muscle groups, in order and without repeats, so the first is
// still the main one.
export function muscleGroups(regions: string[]) {
  return [...new Set(regions.map((r) => MUSCLE_GROUPS[r] ?? r))];
}

// Regions under their muscle groups, main group first: knee, quad, glute,
// hip becomes Legs (knee, quad) then Glutes (glute, hip).
export function groupRegions(regions: string[]) {
  const groups = new Map<string, string[]>();
  for (const r of regions) {
    const group = MUSCLE_GROUPS[r] ?? r;
    groups.set(group, [...(groups.get(group) ?? []), r]);
  }
  return [...groups].map(([group, regions]) => ({ group, regions }));
}

// Guesses for common lifts that aren't in the library, checked in order so
// "leg curl" lands on hamstrings before "curl" lands on arms.
const GUESSES: [RegExp, string[]][] = [
  [
    /\brun|jog|sprint|treadmill|bike|\bcycl|spin\b|spinning|elliptical|rower|rowing|erg\b|swim|stair|jump rope|skipping|hike/,
    ["cardio"],
  ],
  [/leg curl|hamstring|nordic/, ["hamstring", "glute"]],
  [
    /deadlift|rdl|good morning|hinge|swing/,
    ["hamstring", "glute", "lower_back"],
  ],
  [/hip thrust|bridge|glute|kickback|abduct/, ["glute", "hip"]],
  [
    /squat|lunge|leg press|step.?up|leg extension|split/,
    ["quad", "glute", "knee"],
  ],
  [/calf|heel raise/, ["calf", "ankle_foot"]],
  [/bench|chest|push.?up|dip|fly|pec/, ["chest", "shoulder", "arms"]],
  [
    /overhead|shoulder press|military|lateral raise|front raise|delt|face pull|shrug/,
    ["shoulder", "upper_back"],
  ],
  [
    /row|pull.?up|chin.?up|pulldown|lat |lats|pull.?over/,
    ["upper_back", "arms"],
  ],
  [/back extension|superman/, ["lower_back", "glute"]],
  [/curl|tricep|skull|extension|pushdown|bicep/, ["arms", "elbow"]],
  [
    /plank|crunch|sit.?up|ab |abs|core|twist|leg raise|hollow|carry|pallof/,
    ["core"],
  ],
  [/wrist|grip|forearm/, ["wrist_hand", "elbow"]],
  [/neck/, ["neck"]],
];

export function guessBodyParts(name: string): string[] {
  const n = ` ${name.toLowerCase()} `;
  return GUESSES.find(([re]) => re.test(n))?.[1] ?? [];
}

// How hard each body part was hit: every set counts once for an exercise's
// first (main) body part and half for the others it works. A left and a
// right side make one set between them. Hardest first. Cardio is measured
// in time instead, and only counts toward "cardio" (its `seconds`).
export function bodyPartScores(
  sets: WorkoutSet[],
  partsOf: (exerciseName: string) => string[],
) {
  const scores = new Map<string, number>();
  let cardio: { part: string; score: number; seconds: number } | null = null;
  for (const set of sets) {
    const parts = muscleGroups(partsOf(set.exercise_name));
    const each = set.side ? 0.5 : 1;
    if (parts[0] === "cardio") {
      cardio ??= { part: "cardio", score: 0, seconds: 0 };
      cardio.score += each;
      cardio.seconds += set.duration_seconds ?? 0;
      continue;
    }
    (parts.length > 0 ? parts : ["other"]).forEach((part, i) =>
      scores.set(part, (scores.get(part) ?? 0) + each * (i === 0 ? 1 : 0.5)),
    );
  }
  const parts: { part: string; score: number; seconds?: number }[] = [...scores]
    .map(([part, score]) => ({ part, score }))
    .sort(
      (a, b) =>
        Number(a.part === "other") - Number(b.part === "other") ||
        b.score - a.score,
    );
  return cardio ? [cardio, ...parts] : parts;
}

// 1–5 for the meter: a couple of sets is light, ten or more is a lot.
export function scoreLevel(score: number) {
  return score < 2 ? 1 : score < 4 ? 2 : score < 6 ? 3 : score < 9 ? 4 : 5;
}
