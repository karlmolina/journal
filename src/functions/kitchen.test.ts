import { describe, expect, it } from "vitest";
import {
  addDays,
  atHome,
  daysLeft,
  dateLabel,
  guessUseBy,
  isSoon,
  mealsUsing,
  parseKitchenText,
  sameFood,
  type KitchenItem,
} from "./kitchen";

const item = (over: Partial<KitchenItem>): KitchenItem => ({
  id: "1",
  name: "Spinach",
  amount: "",
  aisle: "Produce",
  place: "home",
  use_by: null,
  created_at: "2026-11-20T00:00:00Z",
  ...over,
});

describe("dates", () => {
  it("counts days across months", () => {
    expect(addDays("2026-11-29", 3)).toBe("2026-12-02");
    expect(daysLeft("2026-12-02", "2026-11-29")).toBe(3);
    expect(daysLeft("2026-11-27", "2026-11-29")).toBe(-2);
  });

  it("labels use-by dates", () => {
    const today = "2026-11-20";
    expect(dateLabel("2026-11-20", today)).toBe("Use today");
    expect(dateLabel("2026-11-21", today)).toBe("Use by tomorrow");
    expect(dateLabel("2026-11-23", today)).toBe("3 days left");
    expect(dateLabel("2026-11-18", today)).toBe("2 days past");
  });

  it("finds food to use soon", () => {
    const today = "2026-11-20";
    expect(isSoon(item({ use_by: "2026-11-23" }), today)).toBe(true);
    expect(isSoon(item({ use_by: "2026-11-24" }), today)).toBe(false);
    expect(isSoon(item({ use_by: null }), today)).toBe(false);
    expect(isSoon(item({ use_by: "2026-11-20", place: "buy" }), today)).toBe(
      false,
    );
  });

  it("guesses a use-by for fresh food only", () => {
    expect(guessUseBy("Spinach", "Produce", "2026-11-20")).toBe("2026-11-24");
    expect(guessUseBy("Salmon fillets", "Meat & fish", "2026-11-20")).toBe(
      "2026-11-22",
    );
    expect(guessUseBy("Ground cumin", "Spices", "2026-11-20")).toBeNull();
    expect(guessUseBy("Rice", "Pantry", "2026-11-20")).toBeNull();
  });
});

describe("matching food", () => {
  it("matches the same food described differently", () => {
    expect(sameFood("Spinach", "baby spinach")).toBe(true);
    expect(sameFood("eggs", "Large eggs")).toBe(true);
    expect(sameFood("Onions", "onion")).toBe(true);
    expect(sameFood("chicken", "chicken broth")).toBe(false);
    expect(sameFood("milk", "oat milk")).toBe(true);
  });

  it("only counts food at home that isn't past its date", () => {
    const today = "2026-11-20";
    const fresh = item({ use_by: "2026-11-22" });
    const old = item({ id: "2", use_by: "2026-11-19" });
    expect(atHome("baby spinach", [fresh], today)).toBe(fresh);
    expect(atHome("baby spinach", [old], today)).toBeUndefined();
    expect(atHome("baby spinach", [item({ place: "buy" })], today)).toBe(
      undefined,
    );
  });

  it("finds meals that use a food", () => {
    const meals = [
      {
        name: "Saag",
        ingredients: [
          {
            qty: 1,
            unit: "lb",
            item: "baby spinach",
            note: "",
            aisle: "Produce" as const,
          },
        ],
      },
      { name: "Toast", ingredients: [] },
    ];
    expect(mealsUsing("Spinach", meals).map((m) => m.name)).toEqual(["Saag"]);
  });
});

describe("parseKitchenText", () => {
  it("splits a leading amount from the food", () => {
    expect(parseKitchenText("2 lb apples")).toEqual({
      name: "Apples",
      amount: "2 lb",
      aisle: "Produce",
    });
    expect(parseKitchenText("1 bag of spinach")).toMatchObject({
      name: "Spinach",
      amount: "1 bag",
    });
    expect(parseKitchenText("milk")).toMatchObject({
      name: "Milk",
      amount: "",
    });
    expect(parseKitchenText("3 eggs")).toMatchObject({
      name: "Eggs",
      amount: "3",
    });
  });
});
