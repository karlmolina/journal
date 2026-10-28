import { useCallback, useEffect, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "../supabase";
import { readUserCache, writeUserCache } from "../functions/userCache";
import { notDeleted, queueDelete } from "../functions/undoDelete";
import { reportError } from "../functions/reportError";
import type { Ingredient } from "../functions/meals";
import type { Recipe } from "../functions/mealPrompt";

export interface Meal {
  id: string;
  name: string;
  // How many people the recipe feeds.
  servings: number;
  total_minutes: number | null;
  ingredients: Ingredient[];
  steps: string[];
  source_url: string | null;
  created_at: string;
}

export interface PlannedMeal {
  id: string;
  meal_id: string;
  // How many people to cook for.
  servings: number;
  created_at: string;
}

export interface MealSettings {
  diets: string[];
  diet_notes: string;
  checked_groceries: string[];
}

const DEFAULT_SETTINGS: MealSettings = {
  diets: [],
  diet_notes: "",
  checked_groceries: [],
};

export const DEFAULT_SERVINGS = 2;

const MEAL_COLUMNS =
  "id, name, servings, total_minutes, ingredients, steps, source_url, created_at";

interface Cached {
  meals: Meal[];
  plan: PlannedMeal[];
  settings: MealSettings;
}

const CACHE_KEY = "meals";

const byName = (meals: Meal[]) =>
  [...meals].sort((a, b) => a.name.localeCompare(b.name));

// The meal library, the meals planned next and the Meals tab's settings, all
// loaded together since every page of the tab needs them.
export default function useMeals(userId?: string) {
  const [data, setData] = useState<Cached>(() =>
    userId
      ? readUserCache<Cached>(CACHE_KEY, userId, {
          meals: [],
          plan: [],
          settings: DEFAULT_SETTINGS,
        })
      : { meals: [], plan: [], settings: DEFAULT_SETTINGS },
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const latest = useRef(data);
  useEffect(() => {
    latest.current = data;
    if (userId) writeUserCache(CACHE_KEY, userId, data);
  }, [userId, data]);

  const fail = useCallback((message: string, err: unknown) => {
    reportError(err, message);
    setError(message);
  }, []);

  // Each load gets a number so an older one finishing late is ignored.
  const loads = useRef(0);
  const load = useCallback(async () => {
    if (!userId) return;
    const n = ++loads.current;
    const [meals, plan, settings] = await Promise.all([
      supabase.from("meals").select(MEAL_COLUMNS),
      supabase
        .from("meal_plan")
        .select("id, meal_id, servings, created_at")
        .order("created_at"),
      supabase
        .from("meal_settings")
        .select("diets, diet_notes, checked_groceries")
        .maybeSingle(),
    ]);
    if (n !== loads.current) return;
    setLoading(false);
    const err = meals.error ?? plan.error ?? settings.error;
    if (err) return fail("Couldn't load your meals.", err);
    const library = (meals.data as Meal[]).filter(notDeleted("meals"));
    const ids = new Set(library.map((m) => m.id));
    setData({
      meals: byName(library),
      plan: (plan.data as PlannedMeal[])
        .filter(notDeleted("meal_plan"))
        .filter((p) => ids.has(p.meal_id)),
      settings: (settings.data as MealSettings | null) ?? DEFAULT_SETTINGS,
    });
  }, [userId, fail]);

  // Loaded again whenever the app comes back into view, so changes made by
  // someone you share meals with show up.
  useEffect(() => {
    const counter = loads;
    load();
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      counter.current++;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  // A new meal in the library, and on the plan for `servings` people when
  // given. Returns the meal, or null when it couldn't be saved.
  const addMeal = useCallback(
    async (
      fields: Partial<Omit<Meal, "id" | "created_at">> & { name: string },
      planServings?: number,
    ) => {
      const meal: Meal = {
        servings: planServings ?? DEFAULT_SERVINGS,
        total_minutes: null,
        ingredients: [],
        steps: [],
        source_url: null,
        ...fields,
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
      };
      const planned: PlannedMeal | null = planServings
        ? {
            id: crypto.randomUUID(),
            meal_id: meal.id,
            servings: planServings,
            created_at: meal.created_at,
          }
        : null;
      setData((d) => ({
        ...d,
        meals: byName([...d.meals, meal]),
        plan: planned ? [...d.plan, planned] : d.plan,
      }));
      setError(null);
      const { error } = await supabase.from("meals").insert(meal);
      const planError =
        !error && planned
          ? (await supabase.from("meal_plan").insert(planned)).error
          : null;
      if (error || planError) {
        setData((d) => ({
          ...d,
          meals: error ? d.meals.filter((m) => m.id !== meal.id) : d.meals,
          plan: d.plan.filter((p) => p.id !== planned?.id),
        }));
        fail("Couldn't save that meal.", error ?? planError);
        return null;
      }
      return meal;
    },
    [fail],
  );

  const updateMeal = useCallback(
    async (id: string, patch: Partial<Omit<Meal, "id" | "created_at">>) => {
      const before = latest.current.meals.find((m) => m.id === id);
      if (!before) return false;
      setData((d) => ({
        ...d,
        meals: byName(
          d.meals.map((m) => (m.id === id ? { ...m, ...patch } : m)),
        ),
      }));
      setError(null);
      const { error } = await supabase
        .from("meals")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) {
        setData((d) => ({
          ...d,
          meals: byName(d.meals.map((m) => (m.id === id ? before : m))),
        }));
        fail("Couldn't save that meal.", error);
        return false;
      }
      return true;
    },
    [fail],
  );

  // Deleting a meal also takes it off the plan.
  const removeMeal = useCallback(
    (id: string) => {
      const { meals, plan } = latest.current;
      const meal = meals.find((m) => m.id === id);
      if (!meal) return;
      const planned = plan.filter((p) => p.meal_id === id);
      setData((d) => ({
        ...d,
        meals: d.meals.filter((m) => m.id !== id),
        plan: d.plan.filter((p) => p.meal_id !== id),
      }));
      setError(null);
      queueDelete({
        message: "Meal deleted",
        rows: [`meals:${id}`, ...planned.map((p) => `meal_plan:${p.id}`)],
        commit: () => supabase.from("meals").delete().eq("id", id),
        undo: () =>
          setData((d) =>
            d.meals.some((m) => m.id === id)
              ? d
              : {
                  ...d,
                  meals: byName([...d.meals, meal]),
                  plan: [...d.plan, ...planned].sort((a, b) =>
                    a.created_at.localeCompare(b.created_at),
                  ),
                },
          ),
        onError: (err) => fail("Couldn't delete that meal.", err),
      });
    },
    [fail],
  );

  const addToPlan = useCallback(
    async (mealId: string, servings: number) => {
      const planned: PlannedMeal = {
        id: crypto.randomUUID(),
        meal_id: mealId,
        servings,
        created_at: new Date().toISOString(),
      };
      setData((d) => ({ ...d, plan: [...d.plan, planned] }));
      setError(null);
      const { error } = await supabase.from("meal_plan").insert(planned);
      if (error) {
        setData((d) => ({
          ...d,
          plan: d.plan.filter((p) => p.id !== planned.id),
        }));
        fail("Couldn't add that to your plan.", error);
      }
    },
    [fail],
  );

  const setPlanServings = useCallback(
    async (id: string, servings: number) => {
      const before = latest.current.plan.find((p) => p.id === id);
      if (!before || before.servings === servings) return;
      setData((d) => ({
        ...d,
        plan: d.plan.map((p) => (p.id === id ? { ...p, servings } : p)),
      }));
      const { error } = await supabase
        .from("meal_plan")
        .update({ servings })
        .eq("id", id);
      if (error) {
        setData((d) => ({
          ...d,
          plan: d.plan.map((p) => (p.id === id ? before : p)),
        }));
        fail("Couldn't change the servings.", error);
      }
    },
    [fail],
  );

  // Takes a meal off the plan (made it, or changed your mind); it stays in
  // the library.
  const removeFromPlan = useCallback(
    (id: string, message = "Removed from plan") => {
      const planned = latest.current.plan.find((p) => p.id === id);
      if (!planned) return;
      setData((d) => ({ ...d, plan: d.plan.filter((p) => p.id !== id) }));
      setError(null);
      queueDelete({
        message,
        rows: [`meal_plan:${id}`],
        commit: () => supabase.from("meal_plan").delete().eq("id", id),
        undo: () =>
          setData((d) =>
            d.plan.some((p) => p.id === id)
              ? d
              : {
                  ...d,
                  plan: [...d.plan, planned].sort((a, b) =>
                    a.created_at.localeCompare(b.created_at),
                  ),
                },
          ),
        onError: (err) => fail("Couldn't update your plan.", err),
      });
    },
    [fail],
  );

  // Recipes from a chatbot reply, each for an existing meal or, when the bot
  // added one, a new meal on its own in the library.
  const importRecipes = useCallback(
    async (pairs: { recipe: Recipe; meal: { id: string } | null }[]) => {
      const results = await Promise.all(
        pairs.map(({ recipe, meal }) => {
          const fields = {
            servings: recipe.servings,
            total_minutes: recipe.total_minutes,
            ingredients: recipe.ingredients,
            steps: recipe.steps,
          };
          return meal
            ? updateMeal(meal.id, fields)
            : addMeal({ name: recipe.name, ...fields }).then(Boolean);
        }),
      );
      return results.every(Boolean);
    },
    [addMeal, updateMeal],
  );

  // Saving settings is best effort for diets; ticks on the grocery list are
  // put back if they don't save.
  const saveSettings = useCallback(
    async (patch: Partial<MealSettings>) => {
      if (!userId) return;
      const before = latest.current.settings;
      const next = { ...before, ...patch };
      setData((d) => ({ ...d, settings: next }));
      // No user_id: the row is the one for the meals you're using, which
      // may be someone else's you joined.
      const { error } = await supabase.from("meal_settings").upsert({
        ...next,
        updated_at: new Date().toISOString(),
      });
      if (error) {
        setData((d) => ({ ...d, settings: before }));
        fail("Couldn't save that.", error);
      }
    },
    [userId, fail],
  );

  return {
    reload: load,
    ...data,
    loading,
    error,
    dismissError: () => setError(null),
    addMeal,
    updateMeal,
    removeMeal,
    addToPlan,
    setPlanServings,
    removeFromPlan,
    importRecipes,
    saveSettings,
  };
}

export type MealsData = ReturnType<typeof useMeals>;

// The meals loaded by the Meals shell, for its pages.
export const useMealsData = () => useOutletContext<MealsData>();
