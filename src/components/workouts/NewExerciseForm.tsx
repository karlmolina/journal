import React, { useState } from "react";
import Chip from "../Chip";
import { BODY_REGIONS } from "../../functions/bodyRegions";
import type {
  Exercise,
  ExerciseCategory,
  ExercisePurpose,
  NewExercise,
} from "../../hooks/useExercises";
import { boldFieldClass } from "../styles";

const CATEGORIES: { key: ExerciseCategory; label: string }[] = [
  { key: "strength", label: "Strength" },
  { key: "stability", label: "Stability" },
  { key: "mobility", label: "Mobility" },
  { key: "stretch", label: "Stretch" },
  { key: "cardio", label: "Cardio" },
];

const toggle = <T,>(list: T[], item: T) =>
  list.includes(item) ? list.filter((x) => x !== item) : [...list, item];

interface NewExerciseFormProps {
  // An exercise to edit, instead of adding a new one.
  initial?: Exercise;
  onSave: (exercise: NewExercise) => Promise<boolean>;
  onCancel: () => void;
}

export default function NewExerciseForm({
  initial,
  onSave,
  onCancel,
}: NewExerciseFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState<ExerciseCategory>(
    initial?.category ?? "strength",
  );
  const [purposes, setPurposes] = useState<ExercisePurpose[]>(
    initial?.purposes ?? [],
  );
  const [regions, setRegions] = useState<string[]>(initial?.body_regions ?? []);
  const [dosage, setDosage] = useState(initial?.dosage ?? "");
  const [unilateral, setUnilateral] = useState(initial?.unilateral ?? false);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    const saved = await onSave({
      name: name.trim(),
      category,
      purposes,
      body_regions: regions,
      dosage: dosage.trim() || null,
      unilateral,
      description: description.trim() || null,
    });
    setSaving(false);
    if (saved) onCancel();
  };

  const label =
    "text-xs font-semibold tracking-wide text-base-content/55 dark:text-base-content/75";

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl bg-base-content/5 dark:bg-base-content/9 px-4 py-4 sm:px-5 flex flex-col gap-3"
    >
      <h2 className="font-bold">
        {initial ? `Edit ${initial.name}` : "Add your own exercise"}
      </h2>
      {initial && !initial.user_id && (
        <p className="-mt-2 text-sm font-medium text-base-content/55 dark:text-base-content/75">
          This is a built-in exercise, so your changes are saved as your own
          copy.
        </p>
      )}
      <input
        className={boldFieldClass}
        placeholder="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        aria-label="Name"
        autoCapitalize="words"
        autoFocus={!initial}
      />
      <div className="flex flex-col gap-1.5">
        <span className={label}>Type</span>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <Chip
              key={c.key}
              selected={category === c.key}
              onClick={() => setCategory(c.key)}
            >
              {c.label}
            </Chip>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className={label}>Good for</span>
        <div className="flex flex-wrap gap-1.5">
          <Chip
            selected={purposes.includes("healing")}
            onClick={() => setPurposes(toggle(purposes, "healing"))}
          >
            Healing
          </Chip>
          <Chip
            selected={purposes.includes("prevention")}
            onClick={() => setPurposes(toggle(purposes, "prevention"))}
          >
            Prevention
          </Chip>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className={label}>Body areas</span>
        <div className="flex flex-wrap gap-1.5">
          {BODY_REGIONS.map((r) => (
            <Chip
              key={r.key}
              selected={regions.includes(r.key)}
              onClick={() => setRegions(toggle(regions, r.key))}
            >
              {r.label}
            </Chip>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className={label}>Sides</span>
        <div className="flex flex-wrap gap-1.5">
          <Chip selected={!unilateral} onClick={() => setUnilateral(false)}>
            Both together
          </Chip>
          <Chip selected={unilateral} onClick={() => setUnilateral(true)}>
            One side at a time
          </Chip>
        </div>
      </div>
      <input
        className={boldFieldClass}
        placeholder="Sets and reps, like 3 × 10 (optional)"
        value={dosage}
        onChange={(e) => setDosage(e.target.value)}
        aria-label="Sets and reps"
      />
      <textarea
        className={`${boldFieldClass} resize-none font-medium`}
        rows={3}
        placeholder="How to do it, or who prescribed it (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        aria-label="Notes"
      />
      <div className="flex gap-2">
        <button
          type="button"
          className="btn btn-ghost rounded-full font-bold flex-1"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="btn btn-primary rounded-full font-bold flex-1"
          disabled={!name.trim() || saving}
        >
          {initial ? "Save changes" : "Save exercise"}
        </button>
      </div>
    </form>
  );
}
