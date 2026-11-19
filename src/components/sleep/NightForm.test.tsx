import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import NightForm from "./NightForm";
import type { SleepNight } from "../../hooks/useSleep";
import { bedMinutes } from "../../functions/sleep";

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1" } }),
}));

const lastTimes = {
  bedtime: 23 * 60,
  woke_at: 7 * 60,
  fall_asleep_minutes: 10,
  get_ready_minutes: 30,
  tech_free_minutes: 60,
  out_of_bed_minutes: 0,
};

const existing: SleepNight = {
  id: "n1",
  night: "2026-11-18",
  quality: 7,
  bedtime: 23 * 60,
  woke_at: 7 * 60,
  fall_asleep_minutes: 10,
  get_ready_minutes: 45,
  tech_free_minutes: 90,
  out_of_bed_minutes: 15,
  awake_minutes: 0,
  notes: "",
};

describe("NightForm", () => {
  it("shows get-ready and tech-free as minutes before bed", () => {
    render(
      <NightForm
        night={existing.night}
        existing={existing}
        lastTimes={lastTimes}
        onNightChange={() => {}}
        onSave={() => {}}
      />,
    );
    expect(screen.getByLabelText("Get ready for bed, in minutes")).toHaveValue(
      "45",
    );
    expect(screen.getByLabelText("Tech free, in minutes")).toHaveValue("90");
    expect(screen.getByText("At 10:15 PM")).toBeInTheDocument();
    expect(screen.getByText("At 9:30 PM")).toBeInTheDocument();
    expect(screen.getByLabelText("Before getting up, in minutes")).toHaveValue(
      "15",
    );
    // 8 hr from bedtime to waking, plus 15 min before getting up.
    expect(screen.getByText(/8 hr 15 min in bed/)).toBeInTheDocument();
  });

  it("saves the minutes, and empty optional fields as null or 0", () => {
    const onSave = vi.fn();
    render(
      <NightForm
        night="2026-11-19"
        lastTimes={{
          ...lastTimes,
          get_ready_minutes: null,
          tech_free_minutes: null,
        }}
        onNightChange={() => {}}
        onSave={onSave}
      />,
    );
    fireEvent.change(screen.getByLabelText("How rested from 0 to 10"), {
      target: { value: "8" },
    });
    fireEvent.change(screen.getByLabelText("Tech free, in minutes"), {
      target: { value: "40" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save night" }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        get_ready_minutes: null,
        tech_free_minutes: 40,
        out_of_bed_minutes: 0,
      }),
    );
  });
});

describe("bedMinutes", () => {
  it("adds time before getting up and wraps past midnight", () => {
    expect(bedMinutes(23 * 60, 7 * 60)).toBe(480);
    expect(bedMinutes(23 * 60, 7 * 60, 20)).toBe(500);
  });
});
