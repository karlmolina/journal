import type { Exercise } from "../hooks/useExercises";
import type { PlannedExercise } from "../hooks/useWorkoutPlans";

export interface EquipmentNeed {
  item: string;
  // The exercises that use it, in workout order.
  exercises: string[];
  // Every exercise that uses it says it's optional.
  optional: boolean;
}

// Words in an exercise's name (or its library equipment) that mean a piece
// of kit. Earlier rules win, so "mini band" is matched before "band".
const RULES: [RegExp, string][] = [
  [/\btrap[- ]?bar|\bhex[- ]?bar/, "Trap bar"],
  [/\bez[- ]?bar/, "EZ bar"],
  [/\bsmith\b/, "Smith machine"],
  [/barbell|\bbb\b/, "Barbell"],
  [/dumbbell|\bdbs?\b|\bgoblet\b/, "Dumbbells"],
  [/kettlebell|\bkbs?\b/, "Kettlebell"],
  [/\bmini[- ]?band|\bloop band|\bhip circle/, "Mini band"],
  [/\bbands?\b|\bbanded\b/, "Resistance band"],
  [/\bcable|\bpulley/, "Cable machine"],
  [/\blat pull[- ]?down/, "Lat pulldown machine"],
  [/\bleg press/, "Leg press"],
  [/\bleg curl|\bhamstring curl machine/, "Leg curl machine"],
  [/\bleg extension/, "Leg extension machine"],
  [/\bpull[- ]?ups?\b|\bchin[- ]?ups?\b|\bhang(ing)?\b/, "Pull-up bar"],
  [/\bdips?\b/, "Dip bars"],
  [/\bbench\b|\bincline\b|\bdecline\b/, "Bench"],
  [/\bbox\b|\bstep[- ]?ups?\b|\bstep[- ]?downs?\b/, "Box or step"],
  [/\bfoam roll/, "Foam roller"],
  [/\b(medicine|med|slam|wall) ball/, "Medicine ball"],
  [/\b(stability|swiss|exercise) ball/, "Stability ball"],
  [/\bab wheel|\bab roller/, "Ab wheel"],
  [/\bjump rope|\bskipping|\brope jump/, "Jump rope"],
  [/\bbike\b|\bcycling\b|\bcycle\b|\bspin\b|\bassault bike/, "Bike"],
  [/\btreadmill/, "Treadmill"],
  [/\brow(ing)? machine|\brower\b|\berg\b/, "Rowing machine"],
  [/\belliptical/, "Elliptical"],
  [/\btrx\b|\bsuspension\b|\brings?\b/, "Suspension trainer"],
  [/\blandmine/, "Landmine"],
  [/\bsled\b/, "Sled"],
  [/\bplate\b/, "Weight plate"],
  [/\bankle weights?/, "Ankle weight"],
  [/\bsliders?\b/, "Sliders"],
  [/\bstick\b|\bdowel\b|\bbroomstick\b|\bpvc\b/, "Stick or dowel"],
  [/\bmat\b/, "Mat"],
  [/\bchair\b/, "Chair"],
  [/\bstrap\b/, "Strap"],
  [/\btowel\b/, "Towel"],
];

// Things that carry the load, so a weighted exercise naming one is covered.
const LOADS = new Set([
  "Trap bar",
  "EZ bar",
  "Smith machine",
  "Barbell",
  "Dumbbells",
  "Kettlebell",
  "Cable machine",
  "Lat pulldown machine",
  "Leg press",
  "Leg curl machine",
  "Leg extension machine",
  "Medicine ball",
  "Landmine",
  "Sled",
  "Weight plate",
  "Ankle weight",
  "Resistance band",
  "Mini band",
]);

const BARBELL_LIFT =
  /\b(bench press|deadlift|back squat|front squat|overhead press|military press)s?\b/;

const itemsIn = (text: string) => {
  const lower = text.toLowerCase();
  const items = RULES.filter(([re]) => re.test(lower)).map(([, item]) => item);
  // A mini band is the band, not one more thing to bring.
  return items.includes("Mini band")
    ? items.filter((item) => item !== "Resistance band")
    : items;
};

// What one exercise needs, with the optional flag from its library entry.
function needsOf(
  exercise: PlannedExercise,
  entry: Exercise | undefined,
): { item: string; optional: boolean }[] {
  const found = new Map<string, boolean>();
  for (const item of itemsIn(exercise.name)) found.set(item, false);

  const listed = entry?.equipment?.trim();
  if (listed) {
    // "Foam roller or rolled towel": the first choice is the one to bring.
    const choice = listed.split(/\s+or\s+/i)[0];
    const optional = /optional/i.test(listed);
    const items = itemsIn(choice);
    // Nothing we know by name: show the library's own words.
    if (items.length === 0)
      items.push(choice.replace(/\s*\(optional\)\s*/i, "").replace(/,.*$/, ""));
    for (const item of items) if (!found.has(item)) found.set(item, optional);
  }

  // Classic barbell lifts, or a planned weight with nothing named to lift.
  if (![...found.keys()].some((item) => LOADS.has(item))) {
    if (BARBELL_LIFT.test(exercise.name.toLowerCase()))
      found.set("Barbell", false);
    else if (exercise.weight) found.set("Weights", false);
  }
  return [...found].map(([item, optional]) => ({ item, optional }));
}

// Everything a planned day needs, in the order it first comes up.
export function equipmentFor(
  exercises: PlannedExercise[],
  lookup: (name: string) => Exercise | undefined,
): EquipmentNeed[] {
  const needs = new Map<string, EquipmentNeed>();
  for (const exercise of exercises) {
    for (const { item, optional } of needsOf(exercise, lookup(exercise.name))) {
      const need = needs.get(item.toLowerCase());
      if (!need) {
        needs.set(item.toLowerCase(), {
          item,
          exercises: [exercise.name],
          optional,
        });
      } else {
        if (!need.exercises.includes(exercise.name))
          need.exercises.push(exercise.name);
        need.optional &&= optional;
      }
    }
  }
  return [...needs.values()];
}
