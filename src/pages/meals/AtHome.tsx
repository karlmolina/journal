import { useState } from "react";
import { Link } from "react-router-dom";
import Chip from "../../components/Chip";
import { labelClass, mutedClass } from "../../components/meals/MealParts";
import { fieldClass } from "../../components/styles";
import useDraft, { clearDraft } from "../../hooks/useDraft";
import { useMealsData, type Meal } from "../../hooks/useMeals";
import {
  addDays,
  daysLeft,
  guessUseBy,
  isSoon,
  localDate,
  mealsUsing,
  parseKitchenText,
  dateLabel,
  type KitchenItem,
} from "../../functions/kitchen";

const QUICK_DATES: [string, number][] = [
  ["Today", 0],
  ["3 days", 3],
  ["1 week", 7],
  ["2 weeks", 14],
  ["1 month", 30],
];

function DateBadge({ useBy, today }: { useBy: string | null; today: string }) {
  if (!useBy)
    return (
      <span className="shrink-0 text-sm font-semibold text-base-content/45 dark:text-base-content/65">
        No date
      </span>
    );
  const n = daysLeft(useBy, today);
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${
        n < 0
          ? "bg-error/15 text-error"
          : n <= 1
            ? "bg-warning/25"
            : n <= 3
              ? "bg-warning/12"
              : "text-base-content/55 dark:text-base-content/75"
      }`}
    >
      {dateLabel(useBy, today)}
    </span>
  );
}

// One thing at home. Tap to change its amount or date, or mark it used up.
function HomeRow({
  item,
  meals,
  planned,
  today,
  open,
  onOpen,
}: {
  item: KitchenItem;
  meals: Meal[];
  planned: Set<string>;
  today: string;
  open: boolean;
  onOpen: (open: boolean) => void;
}) {
  const { updateKitchenItems, removeKitchenItems } = useMealsData();
  const [amount, setAmount] = useState(item.amount);
  const using = isSoon(item, today) ? mealsUsing(item.name, meals) : [];
  const save = (patch: Partial<KitchenItem>) =>
    updateKitchenItems([item.id], patch);

  return (
    <li className="rounded-2xl bg-base-content/5 dark:bg-base-content/9">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
        onClick={() => onOpen(!open)}
        aria-expanded={open}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold">{item.name}</span>
          {item.amount && (
            <span className="block text-sm font-medium text-base-content/60 dark:text-base-content/75">
              {item.amount}
            </span>
          )}
        </span>
        <DateBadge useBy={item.use_by} today={today} />
      </button>
      {using.length > 0 && !open && (
        <p className="-mt-1 px-3 pb-2.5 text-sm font-medium text-base-content/60 dark:text-base-content/75">
          Use in{" "}
          {using.map((m, i) => (
            <span key={m.id}>
              {i > 0 && ", "}
              <Link to={`/meals/library/${m.id}`} className="link font-bold">
                {m.name}
              </Link>
              {planned.has(m.id) && " (planned)"}
            </span>
          ))}
        </p>
      )}
      {open && (
        <div className="flex flex-col gap-2.5 px-3 pb-3">
          <label className="flex flex-col gap-1">
            <span className={labelClass}>Amount</span>
            <input
              className={fieldClass}
              placeholder="Like 1 bag or 500 g"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onBlur={() => {
                if (amount.trim() !== item.amount)
                  save({ amount: amount.trim() });
              }}
            />
          </label>
          <div className="flex flex-col gap-1">
            <span className={labelClass}>Use by</span>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_DATES.map(([label, days]) => {
                const date = addDays(today, days);
                return (
                  <Chip
                    key={label}
                    selected={item.use_by === date}
                    onClick={() => save({ use_by: date })}
                  >
                    {label}
                  </Chip>
                );
              })}
              <Chip
                selected={item.use_by === null}
                onClick={() => save({ use_by: null })}
              >
                No date
              </Chip>
            </div>
            <input
              type="date"
              className={fieldClass}
              value={item.use_by ?? ""}
              onChange={(e) => save({ use_by: e.target.value || null })}
              aria-label="Use-by date"
            />
          </div>
          {using.length > 0 && (
            <p className={mutedClass}>
              Use in {using.map((m) => m.name).join(", ")}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-primary btn-sm rounded-full font-bold"
              onClick={() =>
                removeKitchenItems([item.id], `Used up ${item.name}`)
              }
            >
              Used it up
            </button>
            <button
              type="button"
              className="btn btn-sm rounded-full font-bold bg-base-content/8 border-0 shadow-none"
              onClick={() => {
                save({ place: "buy", use_by: null });
                onOpen(false);
              }}
            >
              Out, buy more
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm rounded-full font-bold"
              onClick={() =>
                removeKitchenItems([item.id], `Threw out ${item.name}`)
              }
            >
              Threw it out
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

// What's in the kitchen, soonest to go off first, so food gets used before
// it's wasted. Bought groceries land here from the grocery list.
export default function AtHome() {
  const { kitchen, meals, plan, loading, addKitchenItems } = useMealsData();
  const [text, setText] = useDraft("home-add", "text", "");
  const [openId, setOpenId] = useState<string | null>(null);
  const today = localDate();

  const home = kitchen.filter((k) => k.place === "home");
  const soon = home.filter((k) => isSoon(k, today));
  const later = home.filter((k) => k.use_by && !isSoon(k, today));
  const undated = home.filter((k) => !k.use_by);
  const planned = new Set(plan.map((p) => p.meal_id));

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    const { name, amount, aisle } = parseKitchenText(text);
    setText("");
    clearDraft("home-add");
    await addKitchenItems([
      {
        name,
        amount,
        aisle,
        place: "home",
        use_by: guessUseBy(name, aisle, today),
      },
    ]);
  };

  const list = (title: string, items: KitchenItem[]) =>
    items.length > 0 && (
      <section className="flex flex-col gap-1.5">
        <h2 className="px-2 text-xs font-bold uppercase tracking-wider text-base-content/50 dark:text-base-content/70">
          {title}
        </h2>
        <ul className="flex flex-col gap-1.5">
          {items.map((k) => (
            <HomeRow
              key={`${k.id}:${k.amount}`}
              item={k}
              meals={meals}
              planned={planned}
              today={today}
              open={openId === k.id}
              onOpen={(o) => setOpenId(o ? k.id : null)}
            />
          ))}
        </ul>
      </section>
    );

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={add} className="flex flex-col gap-1.5">
        <div className="flex gap-2">
          <input
            className={fieldClass}
            placeholder="Add food you have, like 1 bag spinach"
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-label="Add food you have at home"
          />
          <button
            type="submit"
            className="btn btn-primary rounded-full font-bold shrink-0"
            disabled={!text.trim()}
          >
            Add
          </button>
        </div>
        <p className={`px-1 ${mutedClass}`}>
          Fresh food gets a guessed use-by date. Tap it to change.
        </p>
      </form>

      {home.length === 0 ? (
        loading ? (
          <div className="flex justify-center py-8 text-base-content/40 dark:text-base-content/70">
            <span className="loading loading-spinner loading-md"></span>
          </div>
        ) : (
          <p className="py-6 text-center text-sm font-medium text-base-content/55 dark:text-base-content/70">
            Nothing here yet. Add what's in your fridge, or tick groceries and
            press Put away on the{" "}
            <Link to="/meals/groceries" className="link font-bold">
              grocery list
            </Link>
            .
          </p>
        )
      ) : (
        <>
          {list("Use soon", soon)}
          {soon.length > 0 && (
            <Link
              to="/meals"
              className="btn rounded-full font-bold bg-base-content/8 border-0 shadow-none"
            >
              Find meals that use them
            </Link>
          )}
          {list("Later", later)}
          {list("No date", undated)}
        </>
      )}
    </div>
  );
}
