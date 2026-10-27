import { Link, useNavigate, useParams } from "react-router-dom";
import { AddMealBox, type AddedMeal } from "../../components/meals/MealParts";
import { DEFAULT_SERVINGS, useMealsData } from "../../hooks/useMeals";
import { formatMinutes, hasRecipe } from "../../functions/meals";
import Recipe from "./Recipe";

// Every meal you've added, with or without a recipe yet. A meal opens to its
// recipe.
export default function Library() {
  const { mealId } = useParams();
  const { meals, plan, loading, addMeal, addToPlan } = useMealsData();
  const navigate = useNavigate();

  if (mealId) return <Recipe key={mealId} mealId={mealId} />;

  const planned = new Set(plan.map((p) => p.meal_id));
  const servings = plan.at(-1)?.servings ?? DEFAULT_SERVINGS;

  // Adding here only puts the meal in the library, not on the plan; picking
  // a match opens it.
  const handleAdd = async (added: AddedMeal) => {
    if (added.kind === "existing")
      return navigate(`/meals/library/${added.meal.id}`);
    if (added.kind === "name") return addMeal({ name: added.name });
    const { recipe } = added;
    return addMeal({
      name: added.name,
      source_url: added.url,
      ...(recipe && {
        servings: recipe.servings ?? DEFAULT_SERVINGS,
        total_minutes: recipe.total_minutes,
        ingredients: recipe.ingredients,
        steps: recipe.steps,
      }),
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <AddMealBox
        meals={meals}
        placeholder="Find a meal, add one, or paste a link"
        onAdd={handleAdd}
      />
      {meals.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {meals.map((m) => (
            <li
              key={m.id}
              className="flex items-center gap-2 rounded-2xl bg-base-content/5 dark:bg-base-content/9 pl-3 pr-2 py-2"
            >
              <Link to={`/meals/library/${m.id}`} className="min-w-0 flex-1">
                <span className="block truncate font-bold">{m.name}</span>
                <span className="block text-sm font-medium text-base-content/60 dark:text-base-content/75">
                  {hasRecipe(m)
                    ? [
                        `Serves ${m.servings}`,
                        m.total_minutes && formatMinutes(m.total_minutes),
                      ]
                        .filter(Boolean)
                        .join(" · ")
                    : "No recipe yet"}
                </span>
              </Link>
              {planned.has(m.id) ? (
                <span className="px-2 text-sm font-bold text-base-content/50 dark:text-base-content/70">
                  Planned
                </span>
              ) : (
                <button
                  type="button"
                  className="btn btn-sm rounded-full font-bold bg-base-content/8 border-0 shadow-none"
                  onClick={() => addToPlan(m.id, servings)}
                >
                  + Plan
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : loading ? (
        <div className="flex justify-center py-8 text-base-content/40 dark:text-base-content/70">
          <span className="loading loading-spinner loading-md"></span>
        </div>
      ) : (
        <p className="py-6 text-center text-sm font-medium text-base-content/55 dark:text-base-content/70">
          Meals you add show up here with their recipes.
        </p>
      )}
    </div>
  );
}
