import { useState } from "react";
import { Link } from "react-router-dom";
import { mutedClass } from "../../components/meals/MealParts";
import { useMealsData } from "../../hooks/useMeals";
import {
  AISLES,
  groceryList,
  hasRecipe,
  type GroceryItem,
} from "../../functions/meals";

function GroceryRow({
  item,
  checked,
  onToggle,
}: {
  item: GroceryItem;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <li>
      <label className="flex cursor-pointer items-start gap-3 rounded-xl px-2 py-2 transition hover:bg-base-content/5">
        <input
          type="checkbox"
          className="checkbox checkbox-sm checkbox-primary mt-0.5 rounded-md"
          checked={checked}
          onChange={onToggle}
        />
        <span
          className={`min-w-0 flex-1 ${checked ? "text-base-content/40 line-through" : ""}`}
        >
          <span className="flex items-baseline justify-between gap-2">
            <span className="font-semibold">{item.item}</span>
            {item.amounts.length > 0 && (
              <span className="shrink-0 text-right font-bold tabular-nums">
                {item.amounts.join(" + ")}
              </span>
            )}
          </span>
          {item.meals.length > 1 && (
            <span className="block text-xs font-medium text-base-content/50 dark:text-base-content/70">
              {item.meals.join(", ")}
            </span>
          )}
        </span>
      </label>
    </li>
  );
}

// Everything to buy for the planned meals, merged and grouped by aisle.
// Ticks are saved, so the list can be filled in across devices in the store.
export default function Groceries() {
  const { meals, plan, settings, saveSettings, loading } = useMealsData();
  const [showStaples, setShowStaples] = useState(false);

  const byId = new Map(meals.map((m) => [m.id, m]));
  const planned = plan.flatMap((p) => {
    const meal = byId.get(p.meal_id);
    return meal
      ? [
          {
            name: meal.name,
            factor: p.servings / meal.servings,
            ingredients: meal.ingredients,
            hasRecipe: hasRecipe(meal),
          },
        ]
      : [];
  });
  const items = groceryList(planned);
  const missing = planned.filter((p) => !p.hasRecipe);
  const checked = new Set(settings.checked_groceries);
  const toggle = (key: string) =>
    saveSettings({
      checked_groceries: checked.has(key)
        ? settings.checked_groceries.filter((k) => k !== key)
        : [...settings.checked_groceries, key],
    });

  const main = items.filter((i) => !i.staple);
  const staples = items.filter((i) => i.staple);
  const ticked = items.filter((i) => checked.has(i.key)).length;
  // Ticked items sink to the bottom of their aisle.
  const ordered = (list: GroceryItem[]) =>
    [...list].sort(
      (a, b) => Number(checked.has(a.key)) - Number(checked.has(b.key)),
    );

  if (items.length === 0)
    return loading ? (
      <div className="flex justify-center py-8 text-base-content/40 dark:text-base-content/70">
        <span className="loading loading-spinner loading-md"></span>
      </div>
    ) : (
      <p className="py-6 text-center text-sm font-medium text-base-content/55 dark:text-base-content/70">
        {planned.length > 0 ? (
          <>
            Your planned meals don't have recipes yet.{" "}
            <Link to="/meals" className="link font-bold">
              Get them on the Plan page
            </Link>
            .
          </>
        ) : (
          <>
            <Link to="/meals" className="link font-bold">
              Plan some meals
            </Link>{" "}
            and their ingredients show up here.
          </>
        )}
      </p>
    );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 px-1">
        <p className={mutedClass}>
          {main.length} {main.length === 1 ? "item" : "items"} for{" "}
          {planned.length} {planned.length === 1 ? "meal" : "meals"}
        </p>
        {ticked > 0 && (
          <button
            type="button"
            className="btn btn-ghost btn-sm rounded-full font-bold"
            onClick={() => saveSettings({ checked_groceries: [] })}
          >
            Untick all
          </button>
        )}
      </div>
      {missing.length > 0 && (
        <p className="rounded-xl bg-warning/15 px-3 py-2 text-sm font-semibold">
          Not included yet, no recipe: {missing.map((m) => m.name).join(", ")}.{" "}
          <Link to="/meals" className="link">
            Get recipes
          </Link>
        </p>
      )}

      {AISLES.map((aisle) => {
        const list = main.filter((i) => i.aisle === aisle);
        if (list.length === 0) return null;
        return (
          <section key={aisle}>
            <h2 className="px-2 pb-0.5 text-xs font-bold uppercase tracking-wider text-base-content/50 dark:text-base-content/70">
              {aisle}
            </h2>
            <ul>
              {ordered(list).map((i) => (
                <GroceryRow
                  key={i.key}
                  item={i}
                  checked={checked.has(i.key)}
                  onToggle={() => toggle(i.key)}
                />
              ))}
            </ul>
          </section>
        );
      })}

      {staples.length > 0 && (
        <section className="rounded-2xl bg-base-content/5 dark:bg-base-content/9">
          <button
            type="button"
            className="flex w-full items-center justify-between px-3 py-2.5 text-left"
            onClick={() => setShowStaples((s) => !s)}
            aria-expanded={showStaples}
          >
            <span className="font-bold">
              Probably in your kitchen{" "}
              <span className="font-semibold text-base-content/50 dark:text-base-content/70">
                · {staples.length}
              </span>
            </span>
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
              className={`transition ${showStaples ? "rotate-180" : ""}`}
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          {showStaples && (
            <ul className="px-1 pb-2">
              {ordered(staples).map((i) => (
                <GroceryRow
                  key={i.key}
                  item={i}
                  checked={checked.has(i.key)}
                  onToggle={() => toggle(i.key)}
                />
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
