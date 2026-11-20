// Food you keep track of yourself on the Meals tab: things to buy that aren't
// from a planned recipe, and what's at home with the date it should be used
// by, so food about to go off gets eaten first.
import {
  guessAisle,
  itemKey,
  toAisle,
  type Aisle,
  type Ingredient,
} from "./meals";

export type KitchenPlace = "buy" | "home";

export interface KitchenItem {
  id: string;
  name: string;
  // Free text like "2 lb" or "1 bag".
  amount: string;
  aisle: Aisle;
  place: KitchenPlace;
  // "YYYY-MM-DD", or null for no date.
  use_by: string | null;
  created_at: string;
}

// Within this many days an item is one to use soon.
export const SOON_DAYS = 3;

const pad = (n: number) => String(n).padStart(2, "0");

// Today (or `d`) as "YYYY-MM-DD" in local time.
export function localDate(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(date: string, days: number) {
  const [y, m, d] = date.split("-").map(Number);
  return localDate(new Date(y, m - 1, d + days));
}

const dayNumber = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
};

// Days from `today` until `useBy`: 0 is today, negative is past it.
export function daysLeft(useBy: string, today = localDate()) {
  return Math.round(dayNumber(useBy) - dayNumber(today));
}

export function dateLabel(useBy: string, today = localDate()) {
  const n = daysLeft(useBy, today);
  if (n < -1) return `${-n} days past`;
  if (n === -1) return "Past it since yesterday";
  if (n === 0) return "Use today";
  if (n === 1) return "Use by tomorrow";
  if (n < 7) return `${n} days left`;
  if (n < 14) return "1 week left";
  if (n < 60) return `${Math.floor(n / 7)} weeks left`;
  return `${Math.round(n / 30)} months left`;
}

export const isSoon = (item: KitchenItem, today = localDate()) =>
  item.place === "home" &&
  item.use_by !== null &&
  daysLeft(item.use_by, today) <= SOON_DAYS;

// How long fresh food usually keeps, as a starting use-by date when it's
// put away. Shelf-stable aisles get no date.
const KEEPS: [RegExp, number][] = [
  [
    /\b(berries|strawberr|raspberr|blueberr|herbs?|basil|cilantro|parsley|mint|dill|spinach|lettuce|salad|arugula|rocket|mushrooms?|avocados?)\b/,
    4,
  ],
  [
    /\b(bananas?|tomato(es)?|zucchini|courgettes?|bread|buns?|rolls?|baguette)\b/,
    5,
  ],
  [/\b(onions?|garlic|potato(es)?|sweet potato(es)?|squash|pumpkin)\b/, 30],
  [/\b(carrots?|cabbage|apples?|lemons?|limes?|oranges?)\b/, 14],
  [/\b(fish|salmon|tuna|cod|shrimp|prawns|mince|ground)\b/, 2],
  [/\b(hard cheese|cheddar|parmesan|butter|eggs?)\b/, 21],
];
const AISLE_KEEPS: Partial<Record<Aisle, number>> = {
  Produce: 7,
  "Meat & fish": 3,
  "Dairy & eggs": 7,
  Bakery: 5,
};

export function guessUseBy(name: string, aisle: Aisle, today = localDate()) {
  if (aisle === "Pantry" || aisle === "Spices" || aisle === "Frozen")
    return null;
  const text = name.toLowerCase();
  const days = KEEPS.find(([re]) => re.test(text))?.[1] ?? AISLE_KEEPS[aisle];
  return days === undefined ? null : addDays(today, days);
}

// Whether two names are the same food: "Spinach" and "baby spinach", or
// "eggs" and "large eggs", but not "chicken" and "chicken broth".
export function sameFood(a: string, b: string) {
  const ka = itemKey(a);
  const kb = itemKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  const wa = ka.split(" ");
  const wb = kb.split(" ");
  const [short, long] = wa.length <= wb.length ? [wa, wb] : [wb, wa];
  // The last word names the food; the ones before only describe it.
  return short.at(-1) === long.at(-1) && short.every((w) => long.includes(w));
}

// The at-home item that covers an ingredient, if any. Food past its date
// doesn't count.
export function atHome(
  name: string,
  items: KitchenItem[],
  today = localDate(),
) {
  return items.find(
    (i) =>
      i.place === "home" &&
      (i.use_by === null || daysLeft(i.use_by, today) >= 0) &&
      sameFood(i.name, name),
  );
}

// Meals whose recipe uses this food.
export function mealsUsing<M extends { ingredients: Ingredient[] }>(
  name: string,
  meals: M[],
) {
  return meals.filter((m) => m.ingredients.some((i) => sameFood(i.item, name)));
}

// "2 lb chicken thighs" typed in the add box: the food, and the amount when
// one leads.
export function parseKitchenText(text: string) {
  const t = text.trim().replace(/\s+/g, " ");
  const m = t.match(
    /^((?:\d+(?:[./]\d+)?|[¼½¾⅓⅔⅛])(?:\s*(?:x|cups?|tbsp|tsp|lbs?|oz|g|kg|ml|l|cans?|jars?|bags?|boxes|box|packs?|packages?|bunch(?:es)?|heads?|loaf|loaves|dozen|bottles?|cartons?|pints?|quarts?|gallons?)\b)?)\s+(.+)$/i,
  );
  const name = (m ? m[2] : t).replace(/^of\s+/i, "");
  return {
    name: name.charAt(0).toUpperCase() + name.slice(1),
    amount: m ? m[1] : "",
    aisle: guessAisle(name),
  };
}

export const kitchenAisle = (text: string) => toAisle(text) ?? "Other";

// Soonest date first, then ones with no date by name.
export function byUseBy(a: KitchenItem, b: KitchenItem) {
  if (a.use_by && b.use_by) return a.use_by.localeCompare(b.use_by);
  if (a.use_by) return -1;
  if (b.use_by) return 1;
  return a.name.localeCompare(b.name);
}
