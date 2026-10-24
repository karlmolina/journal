import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Chip from "../../components/Chip";
import ErrorBanner from "../../components/ErrorBanner";
import ExerciseCard from "../../components/workouts/ExerciseCard";
import NewExerciseForm from "../../components/workouts/NewExerciseForm";
import { useAuth } from "../../context/AuthContext";
import useExercises, { type ExercisePurpose } from "../../hooks/useExercises";
import useExerciseNotes from "../../hooks/useExerciseNotes";
import { BODY_REGIONS } from "../../functions/bodyRegions";

const PURPOSES: { key: ExercisePurpose | null; label: string }[] = [
  { key: null, label: "All" },
  { key: "healing", label: "Healing" },
  { key: "prevention", label: "Prevention" },
];

export default function Library() {
  const { user } = useAuth();
  const {
    exercises,
    loading,
    error,
    dismissError,
    addExercise,
    removeExercise,
  } = useExercises(user?.id);
  const notes = useExerciseNotes(user?.id);
  const navigate = useNavigate();
  // Filters live in the URL so other pages (e.g. the body map) can link here.
  const [params, setParams] = useSearchParams();
  const region = params.get("region");
  const purpose = params.get("purpose") as ExercisePurpose | null;
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);

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

  // Only offer areas some exercise covers.
  const regions = useMemo(() => {
    const used = new Set(exercises.flatMap((e) => e.body_regions));
    return BODY_REGIONS.filter((r) => used.has(r.key));
  }, [exercises]);

  const q = query.trim().toLowerCase();
  const shown = exercises.filter(
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

      {shown.map((e) => (
        <ExerciseCard
          key={e.id}
          exercise={e}
          onLog={() => navigate("/workouts", { state: { exercise: e.name } })}
          note={notes.noteFor(e.name)}
          onSaveNote={(note) => notes.saveNote(e.name, note)}
          onDelete={e.user_id ? () => removeExercise(e) : undefined}
        />
      ))}

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
