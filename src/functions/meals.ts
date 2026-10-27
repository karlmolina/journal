// Ingredients, scaling and the grocery list for the Meals tab. An ingredient
// is kept as parts (2 | cups | rice | rinsed) so it can be scaled to however
// many people a planned meal is for, and merged with the same item from
// other meals on the grocery list.

export interface Ingredient {
  // Null for "salt, to taste" and the like.
  qty: number | null;
  // A short standard unit like "cup" or "lb", or "" for a count.
  unit: string;
  item: string;
  // After the comma: "diced", "to taste".
  note: string;
  aisle: Aisle;
}

export const AISLES = [
  "Produce",
  "Meat & fish",
  "Dairy & eggs",
  "Bakery",
  "Pantry",
  "Spices",
  "Frozen",
  "Other",
] as const;
export type Aisle = (typeof AISLES)[number];

// Unit spellings, each mapped to the one the app shows.
const UNITS: Record<string, string> = {
  cup: "cup",
  cups: "cup",
  c: "cup",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  tbsp: "tbsp",
  tbs: "tbsp",
  tbl: "tbsp",
  T: "tbsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  tsp: "tsp",
  t: "tsp",
  pound: "lb",
  pounds: "lb",
  lb: "lb",
  lbs: "lb",
  ounce: "oz",
  ounces: "oz",
  oz: "oz",
  gram: "g",
  grams: "g",
  g: "g",
  kilogram: "kg",
  kilograms: "kg",
  kg: "kg",
  milliliter: "ml",
  milliliters: "ml",
  millilitre: "ml",
  millilitres: "ml",
  ml: "ml",
  liter: "l",
  liters: "l",
  litre: "l",
  litres: "l",
  l: "l",
  clove: "clove",
  cloves: "clove",
  can: "can",
  cans: "can",
  tin: "can",
  tins: "can",
  jar: "jar",
  jars: "jar",
  bunch: "bunch",
  bunches: "bunch",
  pinch: "pinch",
  pinches: "pinch",
  slice: "slice",
  slices: "slice",
  package: "package",
  packages: "package",
  pkg: "package",
  stalk: "stalk",
  stalks: "stalk",
  sprig: "sprig",
  sprigs: "sprig",
  head: "head",
  heads: "head",
  pint: "pint",
  pints: "pint",
  quart: "quart",
  quarts: "quart",
};

const FRACTIONS: Record<string, number> = {
  "¼": 0.25,
  "½": 0.5,
  "¾": 0.75,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "⅛": 0.125,
};

// "1", "1.5", "1/2", "1 1/2", "1½", "½".
const NUMBER = String.raw`(?:\d+\/\d+|\d+(?:\.\d+)?(?:\s+\d+\/\d+|\s*[¼½¾⅓⅔⅛])?|[¼½¾⅓⅔⅛])`;
const QTY = new RegExp(
  String.raw`^(${NUMBER})(?:\s*(?:-|–|to)\s*(${NUMBER}))?\s*`,
);

function parseNumber(text: string) {
  let total = 0;
  for (const part of text.trim().split(/\s+|(?=[¼½¾⅓⅔⅛])/)) {
    if (FRACTIONS[part]) total += FRACTIONS[part];
    else if (part.includes("/")) {
      const [a, b] = part.split("/").map(Number);
      total += b ? a / b : 0;
    } else total += Number(part);
  }
  return Number.isFinite(total) && total > 0 ? total : null;
}

// Keywords for guessing the aisle of an ingredient that came without one.
// Checked in order, so "chicken broth" is pantry before "chicken" is meat.
const AISLE_WORDS: [Aisle, RegExp][] = [
  ["Frozen", /\bfrozen\b/],
  [
    "Pantry",
    /\b(broth|stock|canned|paste|sauce|vinegar|oil|flour|sugar|rice|pasta|noodles?|spaghetti|penne|lentils|beans|chickpeas|oats|quinoa|couscous|honey|syrup|mustard|ketchup|mayo|mayonnaise|breadcrumbs|panko|coconut milk|cornstarch|baking|yeast|nuts?|almonds|peanut|cashews|walnuts|chocolate|cocoa|tortillas?|crackers|salsa|tahini|miso|tomatoes, canned|crushed tomatoes|diced tomatoes)\b/,
  ],
  [
    "Spices",
    /\b(salt|pepper(?!s)|peppercorns|cumin|paprika|cinnamon|oregano|thyme|chili powder|chilli powder|curry|turmeric|garam masala|nutmeg|cayenne|bay lea(f|ves)|coriander|cardamom|cloves? ground|ground|dried|seasoning|flakes|allspice|vanilla)\b/,
  ],
  [
    "Meat & fish",
    /\b(chicken|beef|pork|lamb|turkey|bacon|sausages?|ham|steak|mince|fish|salmon|tuna|cod|shrimp|prawns|tofu|tempeh|chorizo|prosciutto)\b/,
  ],
  [
    "Dairy & eggs",
    /\b(milk|cream|butter|cheese|cheddar|parmesan|mozzarella|feta|yogh?urt|eggs?|ghee|ricotta|sour cream|halloumi)\b/,
  ],
  ["Bakery", /\b(bread|buns?|rolls?|baguette|pita|naan|bagels?|brioche)\b/],
  [
    "Produce",
    /\b(onions?|garlic|ginger|tomato(es)?|potato(es)?|carrots?|celery|peppers|bell pepper|chil(l)?i(es)?|jalapeños?|lettuce|spinach|kale|cabbage|broccoli|cauliflower|zucchini|courgettes?|eggplant|aubergine|mushrooms?|cucumbers?|avocados?|lemons?|limes?|apples?|bananas?|berries|herbs?|basil|parsley|cilantro|mint|dill|rosemary|scallions?|green onions?|shallots?|leeks?|squash|pumpkin|sweet potato(es)?|corn|peas|green beans|asparagus|fruit|oranges?)\b/,
  ],
];

export function guessAisle(item: string): Aisle {
  const text = item.toLowerCase();
  return AISLE_WORDS.find(([, re]) => re.test(text))?.[0] ?? "Other";
}

export const toAisle = (text: string | undefined): Aisle | null => {
  const t = (text ?? "").trim().toLowerCase();
  if (!t) return null;
  return (
    AISLES.find((a) => a.toLowerCase() === t) ??
    AISLES.find(
      (a) => a.toLowerCase().split(/\s*&\s*/)[0] === t.split(/[\s&]/)[0],
    ) ??
    null
  );
};

// Things most kitchens already have. They go in a collapsed section of the
// grocery list instead of the main one.
const STAPLES =
  /^(salt|kosher salt|sea salt|black pepper|pepper|salt and pepper|salt & pepper|ground black pepper|water|olive oil|extra virgin olive oil|vegetable oil|cooking oil|canola oil|oil|neutral oil|sugar|white sugar|flour|all-purpose flour|plain flour|cooking spray|ice)$/;

export const isStaple = (item: string) =>
  STAPLES.test(item.trim().toLowerCase());

// One ingredient line, like "1 1/2 cups rice, rinsed" or "Salt, to taste".
export function parseIngredient(
  line: string,
  aisle?: Aisle | null,
): Ingredient | null {
  let text = line
    .trim()
    .replace(/^(?:[-*•+]|\d+[.)])\s+/, "")
    .replace(/\*\*|__/g, "")
    .trim();
  if (!text) return null;

  let qty: number | null = null;
  const q = text.match(QTY);
  if (q) {
    // A range like "2-3" buys the larger amount.
    qty = parseNumber(q[2] ?? q[1]);
    text = text.slice(q[0].length);
  }

  // "(14 oz) can tomatoes": keep notes in parentheses out of the item name.
  const parens: string[] = [];
  text = text
    .replace(/\s*\(([^)]*)\)/g, (_, inner: string) => {
      parens.push(inner.trim());
      return "";
    })
    .trim();
  let unit = "";
  const u = text.match(/^([A-Za-z]+)\.?(?=\s|$)/);
  if (u && qty !== null) {
    const key = Object.hasOwn(UNITS, u[1]) ? u[1] : u[1].toLowerCase();
    // Single letters are only units in their exact case (T vs t).
    if (Object.hasOwn(UNITS, key) && (key.length > 1 || u[1] === key)) {
      unit = UNITS[key];
      text = text
        .slice(u[0].length)
        .trim()
        .replace(/^of\s+/i, "");
    }
  }

  const comma = text.indexOf(",");
  const item = (comma >= 0 ? text.slice(0, comma) : text).trim();
  const note = [
    ...parens,
    ...(comma >= 0 ? [text.slice(comma + 1).trim()] : []),
  ]
    .filter(Boolean)
    .join(", ");
  if (!item) return null;
  return { qty, unit, item, note, aisle: aisle ?? guessAisle(item) };
}

// Amounts read best as kitchen fractions: ½ cup, 1 ¼ lb, 3 eggs.
export function formatQty(n: number) {
  if (n >= 20) return String(Math.round(n));
  const whole = Math.floor(n);
  const parts: [number, string][] = [
    [0, ""],
    [0.125, "⅛"],
    [0.25, "¼"],
    [1 / 3, "⅓"],
    [0.5, "½"],
    [2 / 3, "⅔"],
    [0.75, "¾"],
    [1, ""],
  ];
  const rest = n - whole;
  const [value, glyph] = parts.reduce((best, p) =>
    Math.abs(p[0] - rest) < Math.abs(best[0] - rest) ? p : best,
  );
  // Too far from a kitchen fraction (like 0.4 kg): one decimal.
  if (Math.abs(value - rest) > 0.04) return String(Math.round(n * 10) / 10);
  const w = whole + (value === 1 ? 1 : 0);
  if (!glyph) return String(w || 0);
  return w ? `${w} ${glyph}` : glyph;
}

const plural = (unit: string, qty: number) =>
  qty > 1 &&
  [
    "cup",
    "clove",
    "can",
    "jar",
    "slice",
    "package",
    "stalk",
    "sprig",
    "head",
    "pint",
    "quart",
    "pinch",
    "bunch",
  ].includes(unit)
    ? unit === "pinch" || unit === "bunch"
      ? `${unit}es`
      : `${unit}s`
    : unit;

export function amountText(qty: number | null, unit: string) {
  if (qty === null) return unit;
  return [formatQty(qty), plural(unit, qty)].filter(Boolean).join(" ");
}

// "1 ½ cups rice, rinsed", scaled by `factor`.
export function ingredientText(i: Ingredient, factor = 1) {
  const amount = amountText(i.qty === null ? null : i.qty * factor, i.unit);
  return `${amount ? `${amount} ` : ""}${i.item}${i.note ? `, ${i.note}` : ""}`;
}

const SIZES = new Set(["large", "medium", "small", "fresh", "ripe"]);

// Same item whatever the plural or case: "Onions" and "onion".
export function itemKey(item: string) {
  return (
    item
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, " ")
      .split(/\s+/)
      // "2 large eggs" and "eggs" are the same thing to buy.
      .filter((w) => w && !SIZES.has(w))
      .map((w) =>
        w.length > 3 && w.endsWith("oes")
          ? w.slice(0, -2)
          : w.length > 3 && w.endsWith("ies")
            ? `${w.slice(0, -3)}y`
            : w.length > 3 && w.endsWith("s") && !w.endsWith("ss")
              ? w.slice(0, -1)
              : w,
      )
      .join(" ")
  );
}

export interface GroceryItem {
  key: string;
  item: string;
  aisle: Aisle;
  // One amount per unit, like ["2 cups", "3 tbsp"]; empty for "to taste".
  amounts: string[];
  // Which planned meals use it.
  meals: string[];
  staple: boolean;
}

// Every ingredient of every planned meal, scaled to its servings, with the
// same item merged across meals and amounts added up per unit.
export function groceryList(
  planned: { name: string; factor: number; ingredients: Ingredient[] }[],
) {
  const byKey = new Map<
    string,
    {
      item: string;
      aisle: Aisle;
      units: Map<string, number | null>;
      meals: Set<string>;
    }
  >();
  for (const meal of planned)
    for (const i of meal.ingredients) {
      const key = itemKey(i.item);
      if (!key) continue;
      const entry = byKey.get(key) ?? {
        item: i.item,
        aisle: i.aisle,
        units: new Map(),
        meals: new Set(),
      };
      entry.meals.add(meal.name);
      if (i.qty !== null) {
        const total = entry.units.get(i.unit) ?? 0;
        entry.units.set(i.unit, (total ?? 0) + i.qty * meal.factor);
      } else if (i.unit && !entry.units.has(i.unit))
        entry.units.set(i.unit, null);
      byKey.set(key, entry);
    }

  const items: GroceryItem[] = [...byKey].map(([key, e]) => ({
    key,
    item: e.item.charAt(0).toUpperCase() + e.item.slice(1),
    aisle: e.aisle,
    amounts: [...e.units].map(([unit, qty]) => amountText(qty, unit)),
    meals: [...e.meals],
    staple: isStaple(e.item),
  }));
  items.sort(
    (a, b) =>
      AISLES.indexOf(a.aisle) - AISLES.indexOf(b.aisle) ||
      a.item.localeCompare(b.item),
  );
  return items;
}

export const hasRecipe = (m: { ingredients: Ingredient[] }) =>
  m.ingredients.length > 0;

export function formatMinutes(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? (m ? `${h} hr ${m} min` : `${h} hr`) : `${m} min`;
}

// "PT1H30M" from recipe pages.
export function parseIsoDuration(text: unknown) {
  if (typeof text !== "string") return null;
  const m = text.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i);
  if (!m) return null;
  const minutes =
    Number(m[1] ?? 0) * 1440 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  return minutes > 0 ? minutes : null;
}

export const DIETS = [
  "Vegetarian",
  "Vegan",
  "Pescatarian",
  "Gluten free",
  "Dairy free",
  "Nut free",
  "Low carb",
  "High protein",
];
