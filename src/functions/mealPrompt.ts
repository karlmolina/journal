// The prompt the Meals tab copies for any chatbot, and the reader for its
// reply. Like the workout Plan tab, both are short lines of text rather than
// JSON, because phone clipboards cut off long text:
//   ## Chicken tikka masala | 4 | 45
//   + 1 1/2 lb chicken thighs, cubed | Meat & fish
//   1. Stir the yogurt and spices together...
import { AISLES, parseIngredient, toAisle, type Ingredient } from "./meals";

const CHEF = `You're a home cook who writes clear, reliable recipes. Write a recipe for each meal below; I'll paste your reply into my meal planning app, which turns the ingredients into a grocery list.

Make each recipe for the number of people given. Keep to my diet. When a meal has a link, use that recipe if you can open it, otherwise write your own version. Use common ingredients from a regular grocery store.`;

const FORMAT = `Reply with only one code block in exactly this format, nothing else:

## Meal name | Servings | Total minutes
+ Amount Unit Ingredient, note | Aisle
1. Step

One "##" line per meal, using my meal names exactly, then its ingredients, then its numbered steps:
- Ingredients start with "+": the amount as a number like 2, 1.5 or 1/2, then a unit (cup, tbsp, tsp, lb, oz, g, kg, ml, clove, can...) or none for a count, then the ingredient, then anything like "diced" after a comma. "Salt, to taste" has no amount.
- Aisle is one of: ${AISLES.join(", ")}.
- Steps are short, in order, one per line.

Example:
## Garlic butter salmon | 2 | 25
+ 2 salmon fillets | Meat & fish
+ 2 tbsp butter | Dairy & eggs
+ 3 cloves garlic, minced | Produce
+ Salt, to taste | Spices
1. Season the salmon with salt.
2. Melt the butter in a pan over medium heat and cook the salmon 4 minutes a side.
3. Add the garlic for the last minute and spoon the butter over the fish.`;

export interface RecipeRequest {
  name: string;
  servings: number;
  source_url?: string | null;
}

export function buildMealPrompt({
  meals,
  diets,
  dietNotes,
}: {
  meals: RecipeRequest[];
  diets: string[];
  dietNotes: string;
}) {
  const diet = [...diets, ...(dietNotes.trim() ? [dietNotes.trim()] : [])].join(
    "; ",
  );
  return [
    CHEF,
    FORMAT,
    `My diet: ${diet || "no restrictions"}`,
    `Meals:\n${meals
      .map(
        (m) =>
          `- ${m.name} (for ${m.servings})${m.source_url ? `, recipe at ${m.source_url}` : ""}`,
      )
      .join("\n")}`,
  ].join("\n\n");
}

export interface Recipe {
  name: string;
  servings: number;
  total_minutes: number | null;
  ingredients: Ingredient[];
  steps: string[];
}

export type RecipeImport =
  | { ok: true; recipes: Recipe[] }
  | { ok: false; errors: string[] };

// The recipes inside the reply: the code block that has "##" meals, or the
// whole reply when the bot left out the fences.
function recipeText(text: string) {
  const blocks = [...text.matchAll(/```[^\n]*\n?([\s\S]*?)(?:```|$)/g)].map(
    (m) => m[1],
  );
  return blocks.find((b) => /^\s*##/m.test(b)) ?? text;
}

// Strips markdown emphasis bots like to add.
const clean = (line: string) => line.replace(/\*\*|__/g, "").trim();

// Reads a reply in the format above. Lines that aren't part of the format
// (a bot's "Enjoy!") are skipped; anything that would break a recipe is
// listed so it can be pasted back to the bot.
export function parseMealReply(reply: string): RecipeImport {
  if (!reply.trim()) return { ok: false, errors: ["Paste the reply first."] };
  const recipes: Recipe[] = [];
  const errors: string[] = [];

  for (const raw of recipeText(reply).split(/\r?\n/)) {
    const line = clean(raw);
    if (!line) continue;
    if (/^##(?!#)/.test(line)) {
      const [name, servings, minutes] = line
        .replace(/^##\s*/, "")
        .split("|")
        .map((p) => p.trim());
      const serves = parseInt(servings ?? "", 10);
      const mins = parseInt(minutes ?? "", 10);
      const at = name || `Meal ${recipes.length + 1}`;
      if (!name) errors.push(`${at}: the name is missing.`);
      if (!(serves > 0 && serves <= 50))
        errors.push(`${at}: servings should be a number.`);
      recipes.push({
        name: name ?? "",
        servings: serves > 0 && serves <= 50 ? serves : 1,
        total_minutes: mins > 0 && mins <= 2000 ? mins : null,
        ingredients: [],
        steps: [],
      });
      continue;
    }
    const recipe = recipes.at(-1);
    if (!recipe) continue;
    if (/^[+]/.test(line)) {
      const pipe = line.lastIndexOf("|");
      const aisle = pipe >= 0 ? toAisle(line.slice(pipe + 1)) : null;
      const text = (
        pipe >= 0 && aisle ? line.slice(1, pipe) : line.slice(1)
      ).trim();
      const ingredient = parseIngredient(text, aisle);
      if (ingredient) recipe.ingredients.push(ingredient);
    } else if (/^(\d+[.)]|[-*•])\s+/.test(line)) {
      recipe.steps.push(line.replace(/^(\d+[.)]|[-*•])\s+/, ""));
    }
  }

  if (recipes.length === 0)
    return {
      ok: false,
      errors: [
        /^\s*[{[]/.test(recipeText(reply))
          ? "That's JSON. Copy a new prompt and send it, so the bot answers in the app's format."
          : "Couldn't find any meals (lines starting with \"##\"). Paste the bot's whole reply.",
      ],
    };
  for (const r of recipes) {
    if (r.ingredients.length === 0)
      errors.push(
        `${r.name || "A meal"} has no ingredients (lines starting with "+"). The reply may have been cut off.`,
      );
    if (r.steps.length === 0)
      errors.push(`${r.name || "A meal"} has no numbered steps.`);
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, recipes };
}

// Pairs each imported recipe with the meal it's for: by name when the bot
// kept it, otherwise in order among the meals still waiting. Recipes left
// over (the bot added a meal) come back as new.
export function matchRecipes<T extends { id: string; name: string }>(
  recipes: Recipe[],
  waiting: T[],
) {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const left = [...waiting];
  const pairs: { recipe: Recipe; meal: T | null }[] = recipes.map((recipe) => {
    const i = left.findIndex((m) => norm(m.name) === norm(recipe.name));
    return { recipe, meal: i >= 0 ? left.splice(i, 1)[0] : null };
  });
  for (const p of pairs) if (!p.meal && left.length) p.meal = left.shift()!;
  return pairs;
}
