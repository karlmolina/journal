import { useState } from "react";
import { Link } from "react-router-dom";
import Chip from "../../components/Chip";
import { CopyPrompt, PasteReply } from "../../components/ChatbotPrompt";
import {
  AddMealBox,
  ServingsField,
  labelClass,
  mutedClass,
  type AddedMeal,
} from "../../components/meals/MealParts";
import {
  DEFAULT_SERVINGS,
  useMealsData,
  type Meal,
  type PlannedMeal,
} from "../../hooks/useMeals";
import {
  buildMealPrompt,
  matchRecipes,
  parseMealReply,
  type Recipe,
} from "../../functions/mealPrompt";
import {
  DIETS,
  formatMinutes,
  groceryList,
  hasRecipe,
} from "../../functions/meals";
import { cardClass, fieldClass } from "../../components/styles";

const parseRecipes = (reply: string) => {
  const result = parseMealReply(reply);
  return result.ok ? { ok: true as const, value: result.recipes } : result;
};

function PlannedRow({
  planned,
  meal,
  onServings,
  onMade,
  onRemove,
}: {
  planned: PlannedMeal;
  meal: Meal;
  onServings: (servings: number) => void;
  onMade: () => void;
  onRemove: () => void;
}) {
  return (
    <li className="flex items-center gap-2 rounded-2xl bg-base-content/5 dark:bg-base-content/9 px-3 py-2.5">
      <Link to={`/meals/library/${meal.id}`} className="min-w-0 flex-1">
        <span className="block truncate font-bold">{meal.name}</span>
        <span
          className={`block text-sm font-medium ${
            hasRecipe(meal)
              ? "text-base-content/60 dark:text-base-content/75"
              : "text-warning"
          }`}
        >
          {hasRecipe(meal)
            ? [
                `${meal.ingredients.length} ingredients`,
                meal.total_minutes && formatMinutes(meal.total_minutes),
              ]
                .filter(Boolean)
                .join(" · ")
            : "Needs a recipe"}
        </span>
      </Link>
      <ServingsField compact value={planned.servings} onChange={onServings} />
      <div className="dropdown dropdown-end">
        <button
          type="button"
          tabIndex={0}
          className="btn btn-ghost btn-sm btn-circle"
          aria-label={`More for ${meal.name}`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <circle cx="12" cy="5" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="12" cy="19" r="2" />
          </svg>
        </button>
        <ul
          tabIndex={0}
          className="menu dropdown-content z-10 mt-1 w-44 rounded-2xl border border-base-content/10 bg-base-100 p-1.5 font-medium shadow-lg"
        >
          <li>
            <button type="button" onClick={onMade}>
              Made it
            </button>
          </li>
          <li>
            <button type="button" onClick={onRemove}>
              Remove from plan
            </button>
          </li>
        </ul>
      </div>
    </li>
  );
}

// Diet constraints saved for every prompt, and the copy and paste steps for
// the planned meals that still need a recipe.
function RecipePrompt({
  waiting,
}: {
  waiting: { meal: Meal; servings: number }[];
}) {
  const { settings, saveSettings, importRecipes } = useMealsData();
  const [notes, setNotes] = useState(settings.diet_notes);
  const [saving, setSaving] = useState(false);

  const toggleDiet = (diet: string) =>
    saveSettings({
      diets: settings.diets.includes(diet)
        ? settings.diets.filter((d) => d !== diet)
        : [...settings.diets, diet],
    });
  const saveNotes = () => {
    if (notes.trim() !== settings.diet_notes)
      saveSettings({ diet_notes: notes.trim() });
  };

  const handleImport = async (recipes: Recipe[]) => {
    setSaving(true);
    const ok = await importRecipes(
      matchRecipes(
        recipes,
        waiting.map((w) => w.meal),
      ),
    );
    setSaving(false);
    return ok;
  };

  return (
    <div className={`${cardClass} flex flex-col gap-3`}>
      <div>
        <h2 className="font-bold">
          {waiting.length === 1
            ? "1 meal needs a recipe"
            : `${waiting.length} meals need a recipe`}
        </h2>
        <p className={mutedClass}>
          Copy a prompt for {waiting.length === 1 ? "it" : "all of them"} into
          any chatbot, then paste its reply back here.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className={labelClass}>Diet</span>
        <div className="flex flex-wrap gap-1.5">
          {DIETS.map((d) => (
            <Chip
              key={d}
              selected={settings.diets.includes(d)}
              onClick={() => toggleDiet(d)}
            >
              {d}
            </Chip>
          ))}
        </div>
        <input
          className={fieldClass}
          placeholder="Anything else, like: no mushrooms, allergic to shellfish"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={saveNotes}
          aria-label="Other diet notes"
        />
      </div>
      <p className={labelClass}>
        1. Copy the prompt into ChatGPT, Claude, Gemini or another chatbot
      </p>
      <CopyPrompt
        getPrompt={() => {
          saveNotes();
          return buildMealPrompt({
            meals: waiting.map(({ meal, servings }) => ({
              name: meal.name,
              servings,
              source_url: meal.source_url,
            })),
            diets: settings.diets,
            dietNotes: notes,
          });
        }}
      />
      <p className={labelClass}>2. Paste its reply</p>
      <PasteReply
        saving={saving}
        parse={parseRecipes}
        importLabel={waiting.length === 1 ? "Import recipe" : "Import recipes"}
        onImport={handleImport}
      />
    </div>
  );
}

// The Meals tab's first page: the meals planned next, a way to add more, and
// the chatbot prompt for any that still need a recipe.
export default function MealPlan() {
  const {
    meals,
    plan,
    loading,
    addMeal,
    addToPlan,
    setPlanServings,
    removeFromPlan,
  } = useMealsData();
  const byId = new Map(meals.map((m) => [m.id, m]));
  const rows = plan
    .map((p) => ({ planned: p, meal: byId.get(p.meal_id) }))
    .filter((r): r is { planned: PlannedMeal; meal: Meal } => !!r.meal);
  const waiting = rows
    .filter((r) => !hasRecipe(r.meal))
    .map((r) => ({ meal: r.meal, servings: r.planned.servings }));
  const groceryCount = groceryList(
    rows.map((r) => ({
      name: r.meal.name,
      factor: r.planned.servings / r.meal.servings,
      ingredients: r.meal.ingredients,
    })),
  ).filter((i) => !i.staple).length;
  // New meals are for as many people as the last one planned.
  const servings = plan.at(-1)?.servings ?? DEFAULT_SERVINGS;

  const handleAdd = async (added: AddedMeal) => {
    if (added.kind === "existing") return addToPlan(added.meal.id, servings);
    if (added.kind === "name") return addMeal({ name: added.name }, servings);
    const { recipe } = added;
    return addMeal(
      {
        name: added.name,
        source_url: added.url,
        ...(recipe && {
          servings: recipe.servings ?? servings,
          total_minutes: recipe.total_minutes,
          ingredients: recipe.ingredients,
          steps: recipe.steps,
        }),
      },
      servings,
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <AddMealBox
        meals={meals}
        placeholder="Add a meal, or paste a recipe link"
        skipIds={new Set(plan.map((p) => p.meal_id))}
        onAdd={handleAdd}
      />

      {rows.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {rows.map(({ planned, meal }) => (
            <PlannedRow
              key={planned.id}
              planned={planned}
              meal={meal}
              onServings={(n) => setPlanServings(planned.id, n)}
              onMade={() => removeFromPlan(planned.id, `Made ${meal.name}`)}
              onRemove={() => removeFromPlan(planned.id)}
            />
          ))}
        </ul>
      ) : loading ? (
        <div className="flex justify-center py-8 text-base-content/40 dark:text-base-content/70">
          <span className="loading loading-spinner loading-md"></span>
        </div>
      ) : (
        <p className="py-6 text-center text-sm font-medium text-base-content/55 dark:text-base-content/70">
          Add the meals you want to cook next. Their ingredients make your
          grocery list.
        </p>
      )}

      {rows.length > 0 && groceryCount > 0 && (
        <Link
          to="/meals/groceries"
          className="btn rounded-full font-bold bg-base-content/8 border-0 shadow-none"
        >
          Grocery list · {groceryCount} {groceryCount === 1 ? "item" : "items"}
        </Link>
      )}

      {waiting.length > 0 && (
        // Remount once loaded, so the notes box starts from the saved notes.
        <RecipePrompt key={String(loading)} waiting={waiting} />
      )}
    </div>
  );
}
