// Imports a recipe from a web page through the recipe-from-link function,
// which reads the recipe data most recipe sites embed. When a page has none
// (or can't be reached), the meal is still added with its link, and the
// chatbot prompt asks the bot to use that recipe.
import { supabase } from "../supabase";
import { parseIngredient, parseIsoDuration, type Ingredient } from "./meals";
import { reportError } from "./reportError";

export interface LinkRecipe {
  name: string;
  servings: number | null;
  total_minutes: number | null;
  ingredients: Ingredient[];
  steps: string[];
}

interface Reply {
  found?: boolean;
  title?: string;
  name?: string;
  servings?: number | null;
  total_time?: string | null;
  cook_time?: string | null;
  prep_time?: string | null;
  ingredients?: string[];
  steps?: string[];
}

export const looksLikeUrl = (text: string) =>
  /^(https?:\/\/|www\.)\S+$/i.test(text.trim());

export function normalizeUrl(text: string) {
  const t = text.trim();
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

// "https://site.com/recipes/chicken-tikka-masala/" -> "Chicken tikka masala".
export function nameFromUrl(url: string) {
  try {
    const u = new URL(url);
    const slug = u.pathname
      .split("/")
      .filter((p) => p && !/^\d+$/.test(p))
      .at(-1);
    const words = (slug ?? "")
      .replace(/\.[a-z]+$/i, "")
      .replace(/[-_+]+/g, " ")
      .replace(/\b(recipe|recipes)\b/gi, "")
      .trim();
    const name = words || u.hostname.replace(/^www\./, "");
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  } catch {
    return url;
  }
}

// Page titles often end with the site's name: "Best Lasagna | Site".
const cleanTitle = (title: string) =>
  title
    .split(/\s+[|–—-]\s+/)[0]
    .replace(/\s+recipe$/i, "")
    .trim();

export async function recipeFromLink(
  url: string,
): Promise<{ recipe: LinkRecipe | null; name: string }> {
  const { data, error } = await supabase.functions.invoke<Reply>(
    "recipe-from-link",
    { body: { url } },
  );
  if (error) {
    reportError(error, "recipeFromLink");
    return { recipe: null, name: nameFromUrl(url) };
  }
  const name = cleanTitle(data?.name || data?.title || "") || nameFromUrl(url);
  if (!data?.found) return { recipe: null, name };

  const ingredients = (data.ingredients ?? [])
    .map((line) => parseIngredient(line))
    .filter((i): i is Ingredient => i !== null);
  const total =
    parseIsoDuration(data.total_time) ??
    ((parseIsoDuration(data.prep_time) ?? 0) +
      (parseIsoDuration(data.cook_time) ?? 0) ||
      null);
  if (ingredients.length === 0) return { recipe: null, name };
  return {
    name,
    recipe: {
      name,
      servings: data.servings ?? null,
      total_minutes: total && total <= 2000 ? total : null,
      ingredients,
      steps: data.steps ?? [],
    },
  };
}
