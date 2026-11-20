import { useState } from "react";
import { Link } from "react-router-dom";
import { mutedClass } from "../../components/meals/MealParts";
import { fieldClass } from "../../components/styles";
import useDraft, { clearDraft } from "../../hooks/useDraft";
import { useMealsData, type KitchenFields } from "../../hooks/useMeals";
import {
  AISLES,
  groceryList,
  hasRecipe,
  type Aisle,
  type GroceryItem,
} from "../../functions/meals";
import {
  atHome,
  guessUseBy,
  parseKitchenText,
  sameFood,
  dateLabel,
} from "../../functions/kitchen";

// A row of the list: from the planned meals, or one you added (`ownId`).
interface Row extends GroceryItem {
  ownId?: string;
  // What you already have of it, for the "Already at home" section.
  have?: string;
}

const ownKey = (id: string) => `own:${id}`;

function GroceryRow({
  item,
  checked,
  onToggle,
  onRemove,
  onBuy,
}: {
  item: Row;
  checked: boolean;
  onToggle?: () => void;
  onRemove?: () => void;
  // For food at home: put it on the list anyway, to get more.
  onBuy?: () => void;
}) {
  return (
    <li className="flex items-center gap-1">
      <label
        className={`flex min-w-0 flex-1 items-start gap-3 rounded-xl px-2 py-2 transition ${
          onToggle ? "cursor-pointer hover:bg-base-content/5" : ""
        }`}
      >
        {onToggle && (
          <input
            type="checkbox"
            className="checkbox checkbox-sm checkbox-primary mt-0.5 rounded-md"
            checked={checked}
            onChange={onToggle}
          />
        )}
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
          {(item.meals.length > 1 || item.have) && (
            <span className="block text-xs font-medium text-base-content/50 dark:text-base-content/70">
              {item.have ?? item.meals.join(", ")}
            </span>
          )}
        </span>
      </label>
      {onBuy && (
        <button
          type="button"
          className="btn btn-sm rounded-full font-bold bg-base-content/8 border-0 shadow-none"
          onClick={onBuy}
        >
          + Buy
        </button>
      )}
      {onRemove && (
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-circle text-base-content/50 dark:text-base-content/70"
          onClick={onRemove}
          aria-label={`Remove ${item.item}`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </li>
  );
}

function Collapsible({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-2xl bg-base-content/5 dark:bg-base-content/9">
      <button
        type="button"
        className="flex w-full items-center justify-between px-3 py-2.5 text-left"
        onClick={() => setOpen((s) => !s)}
        aria-expanded={open}
      >
        <span className="font-bold">
          {title}{" "}
          <span className="font-semibold text-base-content/50 dark:text-base-content/70">
            · {count}
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
          className={`transition ${open ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && <ul className="px-1 pb-2">{children}</ul>}
    </section>
  );
}

// Type something to buy that isn't from a planned meal.
function AddGrocery({ onAdd }: { onAdd: (text: string) => Promise<unknown> }) {
  const [text, setText] = useDraft("grocery-add", "text", "");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    const value = text;
    setText("");
    clearDraft("grocery-add");
    await onAdd(value);
  };
  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        className={fieldClass}
        placeholder="Add something to buy, like 2 lb apples"
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label="Add a grocery item"
      />
      <button
        type="submit"
        className="btn btn-primary rounded-full font-bold shrink-0"
        disabled={!text.trim()}
      >
        Add
      </button>
    </form>
  );
}

// Everything to buy: the planned meals' ingredients merged and grouped by
// aisle, plus anything you added. Food you already have at home moves to its
// own section. Ticks are saved, so the list can be filled in across devices
// in the store, and ticked items can be put away into At home.
export default function Groceries() {
  const {
    meals,
    plan,
    settings,
    saveSettings,
    loading,
    kitchen,
    addKitchenItems,
    updateKitchenItems,
    removeKitchenItems,
  } = useMealsData();
  const [putAwayNote, setPutAwayNote] = useState<string | null>(null);

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
  const fromMeals: Row[] = groceryList(planned).map((i) => {
    const have = atHome(i.item, kitchen);
    return have
      ? {
          ...i,
          have: [
            `You have ${have.amount || "some"}`,
            have.use_by && dateLabel(have.use_by).toLowerCase(),
          ]
            .filter(Boolean)
            .join(", "),
        }
      : i;
  });
  const own: Row[] = kitchen
    .filter((k) => k.place === "buy")
    .map((k) => ({
      key: ownKey(k.id),
      ownId: k.id,
      item: k.name,
      aisle: k.aisle,
      amounts: k.amount ? [k.amount] : [],
      meals: [],
      staple: false,
    }));
  const missing = planned.filter((p) => !p.hasRecipe);
  const checked = new Set(settings.checked_groceries);
  const toggle = (key: string) =>
    saveSettings({
      checked_groceries: checked.has(key)
        ? settings.checked_groceries.filter((k) => k !== key)
        : [...settings.checked_groceries, key],
    });

  const main = [...fromMeals.filter((i) => !i.staple && !i.have), ...own];
  const staples = fromMeals.filter((i) => i.staple && !i.have);
  const home = fromMeals.filter((i) => i.have);
  const toBuy = [...main, ...staples];
  const tickedRows = toBuy.filter((i) => checked.has(i.key));
  // Ticked items sink to the bottom of their aisle.
  const ordered = (list: Row[]) =>
    [...list].sort(
      (a, b) =>
        Number(checked.has(a.key)) - Number(checked.has(b.key)) ||
        a.item.localeCompare(b.item),
    );

  const addOwn = async (text: string) => {
    const { name, amount, aisle } = parseKitchenText(text);
    setPutAwayNote(null);
    await addKitchenItems([
      { name, amount, aisle, place: "buy", use_by: null },
    ]);
  };

  // Bought: ticked items go to At home with a guessed use-by date, and their
  // ticks come off.
  const putAway = async () => {
    const rows = tickedRows;
    const adds: KitchenFields[] = [];
    const updates: Promise<boolean>[] = [];
    for (const r of rows) {
      const fields = {
        place: "home" as const,
        use_by: guessUseBy(r.item, r.aisle as Aisle),
        amount: r.amounts.join(" + "),
      };
      if (r.ownId) {
        updates.push(updateKitchenItems([r.ownId], fields));
        continue;
      }
      // More of something already at home (maybe past its date): refresh it.
      const existing = kitchen.find(
        (k) => k.place === "home" && sameFood(k.name, r.item),
      );
      if (existing) updates.push(updateKitchenItems([existing.id], fields));
      else adds.push({ name: r.item, aisle: r.aisle, ...fields });
    }
    const done = new Set(rows.map((r) => r.key));
    saveSettings({
      checked_groceries: settings.checked_groceries.filter((k) => !done.has(k)),
    });
    const ok = (await Promise.all([...updates, addKitchenItems(adds)])).every(
      Boolean,
    );
    if (ok)
      setPutAwayNote(
        `Put away ${rows.length} ${rows.length === 1 ? "item" : "items"}.`,
      );
  };

  const sections = AISLES.map((aisle) => {
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
              onRemove={
                i.ownId
                  ? () => removeKitchenItems([i.ownId!], `Removed ${i.item}`)
                  : undefined
              }
            />
          ))}
        </ul>
      </section>
    );
  });

  return (
    <div className="flex flex-col gap-3">
      <AddGrocery onAdd={addOwn} />

      {fromMeals.length === 0 && own.length === 0 ? (
        loading ? (
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
                and their ingredients show up here, or add things yourself.
              </>
            )}
          </p>
        )
      ) : (
        <>
          <div className="flex min-h-8 items-center justify-between gap-2 px-1">
            <p className={mutedClass}>
              {main.length} {main.length === 1 ? "item" : "items"}
              {planned.length > 0 &&
                ` for ${planned.length} ${planned.length === 1 ? "meal" : "meals"}`}
            </p>
            {tickedRows.length > 0 && (
              <div className="flex gap-1">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm rounded-full font-bold"
                  onClick={() => saveSettings({ checked_groceries: [] })}
                >
                  Untick all
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm rounded-full font-bold"
                  onClick={putAway}
                >
                  Put away {tickedRows.length}
                </button>
              </div>
            )}
          </div>
          {putAwayNote && (
            <p className="rounded-xl bg-success/15 px-3 py-2 text-sm font-semibold">
              {putAwayNote}{" "}
              <Link to="/meals/home" className="link">
                Check their use-by dates
              </Link>
            </p>
          )}
          {missing.length > 0 && (
            <p className="rounded-xl bg-warning/15 px-3 py-2 text-sm font-semibold">
              Not included yet, no recipe:{" "}
              {missing.map((m) => m.name).join(", ")}.{" "}
              <Link to="/meals" className="link">
                Get recipes
              </Link>
            </p>
          )}

          {sections}

          {home.length > 0 && (
            <Collapsible title="Already at home" count={home.length}>
              {home.map((i) => (
                <GroceryRow
                  key={i.key}
                  item={i}
                  checked={false}
                  onBuy={() =>
                    addKitchenItems([
                      {
                        name: i.item,
                        amount: i.amounts.join(" + "),
                        aisle: i.aisle,
                        place: "buy",
                        use_by: null,
                      },
                    ])
                  }
                />
              ))}
            </Collapsible>
          )}

          {staples.length > 0 && (
            <Collapsible
              title="Probably in your kitchen"
              count={staples.length}
            >
              {ordered(staples).map((i) => (
                <GroceryRow
                  key={i.key}
                  item={i}
                  checked={checked.has(i.key)}
                  onToggle={() => toggle(i.key)}
                />
              ))}
            </Collapsible>
          )}
        </>
      )}
    </div>
  );
}
