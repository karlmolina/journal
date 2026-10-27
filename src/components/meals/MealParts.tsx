import { useState } from "react";
import useDragAdjust from "../../hooks/useDragAdjust";
import type { Meal } from "../../hooks/useMeals";
import {
  looksLikeUrl,
  normalizeUrl,
  recipeFromLink,
  type LinkRecipe,
} from "../../functions/recipeFromLink";

export const cardClass =
  "rounded-2xl bg-base-content/5 dark:bg-base-content/9 px-4 py-4 sm:px-5";
export const fieldClass =
  "w-full min-w-0 rounded-xl bg-base-content/8 px-3 py-2.5 font-medium outline-none transition focus:bg-base-content/12 placeholder:text-base-content/45 dark:placeholder:text-base-content/65";
export const labelClass =
  "text-xs font-semibold tracking-wide text-base-content/55 dark:text-base-content/75";
export const mutedClass =
  "text-sm font-medium text-base-content/60 dark:text-base-content/75";

const parseServings = (text: string) =>
  /^\s*\d{1,2}\s*$/.test(text) && Number(text) >= 1 && Number(text) <= 50
    ? Number(text)
    : null;

// How many people a meal is for: tap to type, or drag up and down to turn
// the same scroll wheel as the reps and sleep fields.
export function ServingsField({
  value,
  onChange,
  compact,
}: {
  value: number;
  onChange: (servings: number) => void;
  compact?: boolean;
}) {
  const [text, setText] = useState(String(value));
  const [synced, setSynced] = useState(value);
  // Follow changes from outside (an undo, a reload) while not typing.
  if (synced !== value) {
    setSynced(value);
    setText(String(value));
  }
  const commit = (next: string) => {
    setText(next);
    const n = parseServings(next);
    if (n !== null) onChange(n);
  };
  const drag = useDragAdjust({
    value: text,
    onChange: commit,
    label: "Servings",
    min: 1,
    max: 50,
    parse: (t) => parseServings(t) ?? value,
    format: String,
  });

  return (
    <>
      <label
        className={`flex shrink-0 items-baseline gap-1 rounded-xl bg-base-content/8 cursor-ns-resize touch-none transition focus-within:bg-base-content/12 ${
          compact ? "px-2.5 py-1" : "px-3 py-2"
        }`}
        {...drag.bind}
      >
        <input
          className={`w-7 bg-transparent text-right font-extrabold tabular-nums outline-none ${
            compact ? "text-lg" : "text-2xl"
          } ${parseServings(text) === null ? "text-error" : ""}`}
          inputMode="numeric"
          value={text}
          onChange={(e) => commit(e.target.value)}
          onBlur={() => setText(String(value))}
          aria-label="Servings"
        />
        <span className="text-sm font-bold text-base-content/50 dark:text-base-content/70">
          {value === 1 ? "serving" : "servings"}
        </span>
      </label>
      {drag.picker}
    </>
  );
}

export type AddedMeal =
  | { kind: "existing"; meal: Meal }
  | { kind: "name"; name: string }
  | {
      kind: "link";
      url: string;
      name: string;
      recipe: LinkRecipe | null;
    };

// One box for adding a meal: type a name (or pick a match from the library),
// or paste a recipe link to import it.
export function AddMealBox({
  meals,
  placeholder,
  onAdd,
  skipIds,
}: {
  meals: Meal[];
  placeholder: string;
  onAdd: (added: AddedMeal) => Promise<unknown>;
  // Library meals not to suggest, like ones already planned.
  skipIds?: Set<string>;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const query = text.trim().toLowerCase();
  const isLink = looksLikeUrl(text);
  const matches =
    query && !isLink
      ? meals
          .filter(
            (m) => !skipIds?.has(m.id) && m.name.toLowerCase().includes(query),
          )
          .slice(0, 5)
      : [];
  const exact = meals.find((m) => m.name.trim().toLowerCase() === query);

  const add = async (added: AddedMeal) => {
    setBusy(true);
    await onAdd(added);
    setBusy(false);
    setText("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query || busy) return;
    setNote(null);
    if (isLink) {
      setBusy(true);
      const url = normalizeUrl(text);
      const { recipe, name } = await recipeFromLink(url);
      setNote(
        recipe
          ? `Imported "${name}" from the link.`
          : `Couldn't read a recipe on that page, so "${name}" was added with its link. The chatbot prompt will ask for that recipe.`,
      );
      await add({ kind: "link", url, name, recipe });
      return;
    }
    await add(
      exact
        ? { kind: "existing", meal: exact }
        : { kind: "name", name: text.trim() },
    );
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <input
          className={fieldClass}
          placeholder={placeholder}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setNote(null);
          }}
          disabled={busy}
          aria-label="Meal name or recipe link"
        />
        <button
          type="submit"
          className="btn btn-primary rounded-full font-bold shrink-0"
          disabled={!query || busy}
        >
          {busy ? (
            <span className="loading loading-spinner loading-sm"></span>
          ) : isLink ? (
            "Import"
          ) : (
            "Add"
          )}
        </button>
      </div>
      {matches.length > 0 &&
        !(matches.length === 1 && matches[0] === exact) && (
          <div className="flex flex-wrap gap-1.5">
            {matches.map((m) => (
              <button
                key={m.id}
                type="button"
                className="rounded-full bg-base-content/8 px-3 py-1.5 text-sm font-bold transition active:scale-95 hover:bg-base-content/12"
                onClick={() => add({ kind: "existing", meal: m })}
                disabled={busy}
              >
                + {m.name}
              </button>
            ))}
          </div>
        )}
      {busy && isLink && <p className={mutedClass}>Reading the recipe…</p>}
      {note && <p className={mutedClass}>{note}</p>}
    </form>
  );
}
