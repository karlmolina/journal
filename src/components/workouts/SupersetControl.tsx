import { useState } from "react";
import { boldFieldClass } from "../styles";
import ExerciseInput from "./ExerciseInput";

// Shows what the current exercise is in a superset with, and adds more
// exercises to it (any number: a superset of three or more is a circuit).
export default function SupersetControl({
  exercise,
  partners,
  suggestions,
  onSuperset,
  onLeave,
}: {
  exercise: string;
  partners?: string[];
  suggestions: string[];
  onSuperset: (partner: string) => void;
  onLeave: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [partner, setPartner] = useState("");
  const linkClass =
    "btn btn-ghost btn-xs rounded-full font-bold text-primary dark:text-[color-mix(in_oklab,var(--color-primary),white_65%)]";

  if (!adding)
    return partners?.length ? (
      <div className="flex flex-wrap items-center justify-center gap-x-1 text-sm font-semibold text-base-content/60 dark:text-base-content/80">
        <span className="text-center">Superset with {partners.join(", ")}</span>
        <button
          type="button"
          className={linkClass}
          onClick={() => setAdding(true)}
        >
          + Add
        </button>
        <button type="button" className={linkClass} onClick={onLeave}>
          Remove
        </button>
      </div>
    ) : (
      <button
        type="button"
        className={`${linkClass} self-center`}
        onClick={() => setAdding(true)}
        disabled={!exercise}
      >
        + Superset with another exercise
      </button>
    );

  const add = () => {
    const name = partner.trim();
    if (!name || name.toLowerCase() === exercise.toLowerCase()) return;
    onSuperset(name);
    // Stay open so a circuit can be built one exercise after another.
    setPartner("");
  };
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-base-content/5 p-2">
      <p className="text-sm font-semibold text-base-content/60 dark:text-base-content/80 px-1">
        {partners?.length
          ? `Superset with ${partners.join(", ")}. Add as many as you like.`
          : "Do a set of each in turn, then rest."}
      </p>
      <ExerciseInput
        className={boldFieldClass}
        value={partner}
        onChange={setPartner}
        suggestions={suggestions.filter(
          (n) =>
            ![exercise, ...(partners ?? [])].some(
              (m) => m.toLowerCase() === n.toLowerCase(),
            ),
        )}
      />
      <div className="flex gap-2">
        <button
          type="button"
          className="btn btn-ghost btn-sm rounded-full font-bold flex-1"
          onClick={() => setAdding(false)}
        >
          Done
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm rounded-full font-bold flex-1"
          onClick={add}
          disabled={!partner.trim()}
        >
          Add to superset
        </button>
      </div>
    </div>
  );
}
