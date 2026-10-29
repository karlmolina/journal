import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ServingsField,
  labelClass,
  mutedClass,
} from "../../components/meals/MealParts";
import { useMealsData, type Meal } from "../../hooks/useMeals";
import {
  formatMinutes,
  hasRecipe,
  ingredientText,
  itemKey,
  parseIngredient,
  type Ingredient,
} from "../../functions/meals";
import { normalizeUrl, recipeFromLink } from "../../functions/recipeFromLink";
import { cardClass, fieldClass } from "../../components/styles";

// Edits a recipe as plain text: one ingredient or step per line. Ingredients
// keep their aisle when the item is unchanged; new ones get a guess.
function RecipeForm({
  meal,
  onSave,
  onCancel,
}: {
  meal: Meal;
  onSave: (patch: Partial<Meal>) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(meal.name);
  const [servings, setServings] = useState(meal.servings);
  const [minutes, setMinutes] = useState(
    meal.total_minutes ? String(meal.total_minutes) : "",
  );
  const [link, setLink] = useState(meal.source_url ?? "");
  const [ingredients, setIngredients] = useState(
    meal.ingredients.map((i) => ingredientText(i)).join("\n"),
  );
  const [steps, setSteps] = useState(meal.steps.join("\n"));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const mins = minutes.trim() ? parseInt(minutes, 10) : null;
  const minutesOk = mins === null || (mins > 0 && mins <= 2000);

  const fillFromLink = async () => {
    setBusy(true);
    setNote(null);
    const { recipe } = await recipeFromLink(normalizeUrl(link));
    setBusy(false);
    if (!recipe) {
      setNote("Couldn't read a recipe on that page.");
      return;
    }
    if (recipe.servings) setServings(recipe.servings);
    if (recipe.total_minutes) setMinutes(String(recipe.total_minutes));
    setIngredients(recipe.ingredients.map((i) => ingredientText(i)).join("\n"));
    setSteps(recipe.steps.join("\n"));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !minutesOk) return;
    const aisles = new Map(
      meal.ingredients.map((i) => [itemKey(i.item), i.aisle]),
    );
    const parsed = ingredients
      .split("\n")
      .map((line) => {
        const i = parseIngredient(line);
        return i && { ...i, aisle: aisles.get(itemKey(i.item)) ?? i.aisle };
      })
      .filter((i): i is Ingredient => !!i);
    setBusy(true);
    const ok = await onSave({
      name: name.trim(),
      servings,
      total_minutes: mins,
      source_url: link.trim() ? normalizeUrl(link) : null,
      ingredients: parsed,
      steps: steps
        .split("\n")
        .map((s) => s.trim().replace(/^\d+[.)]\s+/, ""))
        .filter(Boolean),
    });
    setBusy(false);
    if (ok) onCancel();
  };

  return (
    <form onSubmit={save} className={`${cardClass} flex flex-col gap-3`}>
      <input
        className={`${fieldClass} text-lg font-bold`}
        value={name}
        onChange={(e) => setName(e.target.value)}
        aria-label="Meal name"
      />
      <div className="flex items-center gap-2">
        <ServingsField value={servings} onChange={setServings} />
        <label className="flex flex-1 items-center gap-2 rounded-xl bg-base-content/8 px-3 py-2">
          <input
            className={`w-full min-w-0 bg-transparent text-right text-2xl font-extrabold tabular-nums outline-none ${
              minutesOk ? "" : "text-error"
            }`}
            inputMode="numeric"
            placeholder="–"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            aria-label="Total minutes"
          />
          <span className="text-sm font-bold text-base-content/50 dark:text-base-content/70">
            min
          </span>
        </label>
      </div>
      <div className="flex gap-2">
        <input
          className={fieldClass}
          placeholder="Recipe link (optional)"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          aria-label="Recipe link"
        />
        {link.trim() && (
          <button
            type="button"
            className="btn rounded-full font-bold bg-base-content/8 border-0 shadow-none shrink-0"
            onClick={fillFromLink}
            disabled={busy}
          >
            Fill from link
          </button>
        )}
      </div>
      {note && <p className={mutedClass}>{note}</p>}
      <label className="flex flex-col gap-1">
        <span className={labelClass}>Ingredients, one per line</span>
        <textarea
          className={`${fieldClass} resize-y`}
          rows={Math.max(4, Math.min(14, ingredients.split("\n").length + 1))}
          placeholder={"2 cups rice\n1 onion, diced\nSalt, to taste"}
          value={ingredients}
          onChange={(e) => setIngredients(e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className={labelClass}>Steps, one per line</span>
        <textarea
          className={`${fieldClass} resize-y`}
          rows={Math.max(4, Math.min(14, steps.split("\n").length + 1))}
          value={steps}
          onChange={(e) => setSteps(e.target.value)}
        />
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          className="btn btn-ghost flex-1 rounded-full font-bold"
          onClick={onCancel}
          disabled={busy}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="btn btn-primary flex-1 rounded-full font-bold"
          disabled={busy || !name.trim() || !minutesOk}
        >
          Save
        </button>
      </div>
    </form>
  );
}

const siteName = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

// One meal's recipe, scaled to however many people you pick (the planned
// servings when it's on the plan).
export default function Recipe({ mealId }: { mealId: string }) {
  const { meals, plan, loading, updateMeal, removeMeal, addToPlan } =
    useMealsData();
  const navigate = useNavigate();
  const meal = meals.find((m) => m.id === mealId);
  const planned = plan.find((p) => p.meal_id === mealId);
  const [editing, setEditing] = useState(false);
  const [servings, setServings] = useState<number | null>(null);

  if (!meal)
    return loading ? (
      <div className="flex justify-center py-8 text-base-content/40 dark:text-base-content/70">
        <span className="loading loading-spinner loading-md"></span>
      </div>
    ) : (
      <p className="py-6 text-center text-sm font-medium text-base-content/55 dark:text-base-content/70">
        That meal isn't in your library.{" "}
        <Link to="/meals/library" className="link font-bold">
          Back to the library
        </Link>
      </p>
    );

  if (editing)
    return (
      <RecipeForm
        meal={meal}
        onSave={(patch) => updateMeal(meal.id, patch)}
        onCancel={() => setEditing(false)}
      />
    );

  const shown = servings ?? planned?.servings ?? meal.servings;
  const factor = shown / meal.servings;

  return (
    <article className="flex flex-col gap-4">
      <div className="px-1">
        <Link
          to="/meals/library"
          className="text-sm font-bold text-base-content/55 dark:text-base-content/75"
        >
          ‹ Library
        </Link>
        <h2 className="mt-1 text-2xl font-extrabold tracking-tight">
          {meal.name}
        </h2>
        <p className={mutedClass}>
          {[
            meal.total_minutes && formatMinutes(meal.total_minutes),
            planned && "On your plan",
          ]
            .filter(Boolean)
            .join(" · ")}
          {meal.source_url && (
            <>
              {meal.total_minutes || planned ? " · " : ""}
              <a
                href={meal.source_url}
                target="_blank"
                rel="noreferrer"
                className="link"
              >
                {siteName(meal.source_url)}
              </a>
            </>
          )}
        </p>
      </div>

      {hasRecipe(meal) ? (
        <>
          <section className={`${cardClass} flex flex-col gap-2`}>
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold">Ingredients</h3>
              <ServingsField compact value={shown} onChange={setServings} />
            </div>
            <ul className="flex flex-col gap-1">
              {meal.ingredients.map((i, n) => (
                <li key={n} className="flex gap-2 font-medium">
                  <span className="text-base-content/40">•</span>
                  {ingredientText(i, factor)}
                </li>
              ))}
            </ul>
          </section>
          {meal.steps.length > 0 && (
            <section className="flex flex-col gap-2 px-1">
              <h3 className="font-bold">Steps</h3>
              <ol className="flex flex-col gap-2.5">
                {meal.steps.map((s, n) => (
                  <li key={n} className="flex gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-base-content/8 text-sm font-bold tabular-nums">
                      {n + 1}
                    </span>
                    <span className="font-medium leading-snug">{s}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </>
      ) : (
        <p className={`${cardClass} ${mutedClass}`}>
          No recipe yet. Plan this meal to get it from a chatbot with the other
          planned meals, or edit it to paste a link or write it in.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {!planned && (
          <button
            type="button"
            className="btn btn-primary rounded-full font-bold"
            onClick={() => addToPlan(meal.id, shown)}
          >
            Add to plan
          </button>
        )}
        <button
          type="button"
          className="btn rounded-full font-bold bg-base-content/8 border-0 shadow-none"
          onClick={() => setEditing(true)}
        >
          Edit
        </button>
        <button
          type="button"
          className="btn btn-ghost rounded-full font-bold text-error ml-auto"
          onClick={() => {
            removeMeal(meal.id);
            navigate("/meals/library");
          }}
        >
          Delete
        </button>
      </div>
    </article>
  );
}
