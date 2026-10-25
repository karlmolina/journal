import type { WorkoutSet } from "../hooks/useWorkouts";
import { regionLabel } from "./bodyRegions";

// Body parts named in a summary beyond the library's regions.
const EXTRA_LABELS: Record<string, string> = {
  arms: "Arms",
  cardio: "Cardio",
  other: "Other",
};

export const bodyPartLabel = (key: string) =>
  EXTRA_LABELS[key] ?? regionLabel(key);

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
    const parts = partsOf(set.exercise_name);
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
