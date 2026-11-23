import { useCallback, useMemo } from "react";
import type { PlannedExercise } from "./useWorkoutPlans";
import type { SetInput, Workout } from "./useWorkouts";
import useDraft from "./useDraft";
import { setPrefill } from "../functions/planProgress";
import { nameKey } from "../functions/exerciseName";
import {
  progressionFor,
  withProgression,
  type Progression,
} from "../functions/progression";
import type { ProgressionChoice } from "../components/workouts/ProgressionNudge";

// The numbers a workout's new sets start with, and the nudge up from last
// time before each exercise's first set. A nudge you take is kept for this
// workout (like a draft, so a refresh keeps it) and changes those numbers.
export default function useProgression(
  active: Workout | null | undefined,
  history: Workout[],
  exercises: PlannedExercise[] | undefined,
) {
  const [saved, setSaved] = useDraft<{
    workout: string;
    taken: Record<string, Partial<SetInput>>;
  } | null>("progression", "taken", null);
  const taken = useMemo(
    () => (active && saved?.workout === active.id ? saved.taken : {}),
    [active, saved],
  );

  // See setPrefill, then any progression taken for it.
  const prefillFor = useCallback(
    (name: string): Partial<SetInput> => {
      const k = nameKey(name);
      const doneToday = !!active?.workout_sets.some(
        (s) => nameKey(s.exercise_name) === k,
      );
      return withProgression(
        setPrefill(name, active, history, exercises),
        taken[k],
        doneToday,
      );
    },
    [active, history, exercises, taken],
  );

  // See progressionFor.
  const progression = useCallback(
    (name: string): ProgressionChoice | undefined => {
      if (!active) return undefined;
      const suggestion = progressionFor(name, active, history, exercises);
      if (!suggestion) return undefined;
      const k = nameKey(name);
      const take = (p: Progression | null) =>
        setSaved((was) => {
          const all = { ...(was?.workout === active.id ? was.taken : {}) };
          if (p) all[k] = p.prefill;
          else delete all[k];
          return { workout: active.id, taken: all };
        });
      return {
        suggestion,
        taken: !!taken[k],
        onTake: () => take(suggestion),
        onUndo: () => take(null),
      };
    },
    [active, history, exercises, taken, setSaved],
  );

  return { prefillFor, progression };
}
