import React, { useState } from "react";
import Chip from "../Chip";
import { BODY_REGIONS } from "../../functions/bodyRegions";
import type {
  ExerciseCategory,
  ExercisePurpose,
  NewExercise,
} from "../../hooks/useExercises";

const fieldClass =
  "w-full min-w-0 rounded-xl bg-base-content/8 px-3 py-2.5 font-semibold outline-none transition focus:bg-base-content/12 placeholder:font-medium placeholder:text-base-content/45";

const CATEGORIES: { key: ExerciseCategory; label: string }[] = [
  { key: "strength", label: "Strength" },
  { key: "stability", label: "Stability" },
  { key: "mobility", label: "Mobility" },
  { key: "stretch", label: "Stretch" },
];

const toggle = <T,>(list: T[], item: T) =>
  list.includes(item) ? list.filter((x) => x !== item) : [...list, item];

interface NewExerciseFormProps {
  onSave: (exercise: NewExercise) => Promise<boolean>;
  onCancel: () => void;
}

export default function NewExerciseForm({
  onSave,
  onCancel,
}: NewExerciseFormProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ExerciseCategory>("strength");
  const [purposes, setPurposes] = useState<ExercisePurpose[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [dosage, setDosage] = useState("");
  const [description, setDescription] = useState("");
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
      description: description.trim() || null,
    });
    setSaving(false);
    if (saved) onCancel();
  };

  const label = "text-xs font-semibold tracking-wide text-base-content/55";

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl bg-base-content/5 dark:bg-base-content/9 px-4 py-4 sm:px-5 flex flex-col gap-3"
    >
      <h2 className="font-bold">Add your own exercise</h2>
      <input
        className={fieldClass}
        placeholder="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        aria-label="Name"
        autoCapitalize="words"
        autoFocus
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
      <input
        className={fieldClass}
        placeholder="Sets and reps, like 3 × 10 (optional)"
        value={dosage}
        onChange={(e) => setDosage(e.target.value)}
        aria-label="Sets and reps"
      />
      <textarea
        className={`${fieldClass} resize-none font-medium`}
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
          Save exercise
        </button>
      </div>
    </form>
  );
}
