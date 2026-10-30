import { useMemo, useState } from "react";
import useDraft from "../../hooks/useDraft";
import {
  Link,
  Navigate,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import Chip from "../../components/Chip";
import ErrorBanner from "../../components/ErrorBanner";
import ExerciseCard from "../../components/workouts/ExerciseCard";
import NewExerciseForm from "../../components/workouts/NewExerciseForm";
import { useAuth } from "../../context/AuthContext";
import useExercises, {
  type Exercise,
  type ExercisePurpose,
} from "../../hooks/useExercises";
import useExerciseNotes from "../../hooks/useExerciseNotes";
import useInjuries from "../../hooks/useInjuries";
import { BODY_REGIONS } from "../../functions/bodyRegions";
import { nameKey } from "../../functions/exerciseName";

const PURPOSES: { key: ExercisePurpose | null; label: string }[] = [
  { key: null, label: "All" },
  { key: "healing", label: "Healing" },
  { key: "prevention", label: "Prevention" },
];

export default function Library() {
  const { user } = useAuth();
  const {
    exercises,
    byLowerName,
    loading,
    error,
    dismissError,
    addExercise,
    updateExercise,
    removeExercise,
  } = useExercises(user?.id);
  const notes = useExerciseNotes(user?.id);
  const { injuries } = useInjuries(user?.id);
  const navigate = useNavigate();
  // Filters live in the URL so other pages (e.g. the body map) can link here.
  const [params, setParams] = useSearchParams();
  const region = params.get("region");
  const purpose = params.get("purpose") as ExercisePurpose | null;
  const [query, setQuery] = useState("");
  // An open form stays open through a refresh, with its unsaved input.
  const [adding, setAdding] = useDraft("library", "adding", false);
  const [editingId, setEditingId] = useDraft<string | null>(
    "library",
    "editingId",
    null,
  );
  // One exercise's own page, linked from past workouts.
  const { exerciseId } = useParams();

  // A built-in exercise you've made your own copy of shows as your copy.
  const library = useMemo(
    () =>
      exercises.filter(
        (e) => e.user_id || byLowerName.get(nameKey(e.name)) === e,
      ),
    [exercises, byLowerName],
  );

  // Only offer areas some exercise covers.
  const regions = useMemo(() => {
    const used = new Set(library.flatMap((e) => e.body_regions));
    return BODY_REGIONS.filter((r) => used.has(r.key));
  }, [library]);

  const card = (e: Exercise, open = false) =>
    editingId === e.id ? (
      <NewExerciseForm
        key={e.id}
        initial={e}
        onSave={async (changes) => (await updateExercise(e, changes)) !== null}
        onCancel={() => setEditingId(null)}
      />
    ) : (
      <ExerciseCard
        key={e.id}
        exercise={e}
        defaultOpen={open}
        onLog={() => navigate("/workouts", { state: { exercise: e.name } })}
        onEdit={() => setEditingId(e.id)}
        exerciseNotes={{ notes, injuries }}
        onDelete={
          e.user_id
            ? () => {
                removeExercise(e);
                if (exerciseId) navigate("/workouts/library");
              }
            : undefined
        }
      />
    );

  if (exerciseId) {
    const exercise = exercises.find((e) => e.id === exerciseId);
    const own =
      exercise && !exercise.user_id
        ? byLowerName.get(nameKey(exercise.name))
        : undefined;
    if (own && own.id !== exerciseId)
      return <Navigate to={`/workouts/library/${own.id}`} replace />;
    return (
      <div className="flex flex-col gap-3 pb-6">
        {error && <ErrorBanner message={error} onDismiss={dismissError} />}
        {notes.error && (
          <ErrorBanner message={notes.error} onDismiss={notes.dismissError} />
        )}
        <Link
          to="/workouts/library"
          className="self-start ml-1 text-sm font-bold text-primary dark:text-[color-mix(in_oklab,var(--color-primary),white_65%)] hover:underline"
        >
          ← All exercises
        </Link>
        {exercise ? (
          card(exercise, true)
        ) : loading ? (
          <div className="flex justify-center py-4 text-base-content/40 dark:text-base-content/70">
            <span className="loading loading-spinner loading-md"></span>
          </div>
        ) : (
          <p className="py-8 text-center text-lg font-bold">
            That exercise isn't in your library
          </p>
        )}
      </div>
    );
  }

  const setFilter = (key: string, value: string | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );

  const q = query.trim().toLowerCase();
  const shown = library.filter(
    (e) =>
      (!region || e.body_regions.includes(region)) &&
      (!purpose || e.purposes.includes(purpose)) &&
      (!q ||
        e.name.toLowerCase().includes(q) ||
        e.description?.toLowerCase().includes(q)),
  );

  return (
    <div className="flex flex-col gap-3 pb-6">
      {error && <ErrorBanner message={error} onDismiss={dismissError} />}
      {notes.error && (
        <ErrorBanner message={notes.error} onDismiss={notes.dismissError} />
      )}

      <label className="flex items-center gap-2 h-12 rounded-3xl bg-base-content/8 px-4 focus-within:bg-base-content/10">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0 text-base-content/50 dark:text-base-content/75"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="search"
          className="flex-1 min-w-0 bg-transparent outline-none font-medium placeholder:text-base-content/50 dark:placeholder:text-base-content/65"
          placeholder="Search exercises"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      <div className="flex gap-1.5">
        {PURPOSES.map((p) => (
          <Chip
            key={p.label}
            selected={purpose === p.key}
            onClick={() => setFilter("purpose", p.key)}
          >
            {p.label}
          </Chip>
        ))}
      </div>

      <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-2 px-2 sm:mx-0 sm:px-0">
        <Chip selected={!region} onClick={() => setFilter("region", null)}>
          Every area
        </Chip>
        {regions.map((r) => (
          <Chip
            key={r.key}
            selected={region === r.key}
            onClick={() => setFilter("region", region === r.key ? null : r.key)}
          >
            {r.label}
          </Chip>
        ))}
      </div>

      {loading && exercises.length === 0 && (
        <div className="flex justify-center py-4 text-base-content/40 dark:text-base-content/70">
          <span className="loading loading-spinner loading-md"></span>
        </div>
      )}

      {!loading && shown.length === 0 && (
        <div className="py-8 text-center">
          <p className="text-lg font-bold">No exercises match</p>
          <p className="text-sm font-medium text-base-content/55 dark:text-base-content/75">
            Try another area or search, or add your own below.
          </p>
        </div>
      )}

      {shown.map((e) => card(e))}

      {adding ? (
        <NewExerciseForm
          onSave={addExercise}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button
          type="button"
          className="btn btn-ghost rounded-full font-bold self-center"
          onClick={() => setAdding(true)}
        >
          Add your own exercise
        </button>
      )}

      <p className="text-xs font-medium text-base-content/50 dark:text-base-content/75 text-center px-4">
        General guidance, not medical advice. Stop if an exercise causes sharp
        pain, and see a physical therapist for an injury that isn't improving.
      </p>
    </div>
  );
}
