import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import NightForm from "./NightForm";
import type { SleepNight } from "../../hooks/useSleep";
import { bedMinutes } from "../../functions/sleep";
import { setCacheOwner } from "../../functions/userCache";

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
    // Woke at 7:00 and stayed 15 min, so got out of bed at 7:15.
    expect(screen.getByLabelText("Got out of bed")).toBeInTheDocument();
    // 8 hr from bedtime to waking, plus 15 min before getting up.
    expect(screen.getByText(/8 hr 15 min in bed/)).toBeInTheDocument();
  });

  it("puts Got out of bed after Before getting up", () => {
    render(
      <NightForm
        night={existing.night}
        existing={existing}
        lastTimes={lastTimes}
        onNightChange={() => {}}
        onSave={() => {}}
      />,
    );
    const before = screen.getByText("Before getting up");
    const out = screen.getByText("Got out of bed");
    expect(
      before.compareDocumentPosition(out) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.queryByText("Woke up")).toBeNull();
  });

  it("saves the wake time as got out of bed minus the minutes before", () => {
    const onSave = vi.fn();
    render(
      <NightForm
        night={existing.night}
        existing={existing}
        lastTimes={lastTimes}
        onNightChange={() => {}}
        onSave={onSave}
      />,
    );
    fireEvent.change(screen.getByLabelText("Got out of bed"), {
      target: { value: "7:30" },
    });
    fireEvent.change(screen.getByLabelText("Before getting up, in minutes"), {
      target: { value: "40" },
    });
    // 7:30 got up, 40 min before: woke at 6:50. In bed 11 PM to 7:30.
    expect(screen.getByText(/8 hr 30 min in bed/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Update night" }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ woke_at: 6 * 60 + 50, out_of_bed_minutes: 40 }),
    );
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

  it("undoes unsaved changes back to the saved night", () => {
    localStorage.clear();
    setCacheOwner("u1");
    render(
      <NightForm
        night={existing.night}
        existing={existing}
        lastTimes={lastTimes}
        onNightChange={() => {}}
        onSave={() => {}}
      />,
    );
    expect(screen.queryByRole("button", { name: "Undo changes" })).toBeNull();
    fireEvent.change(screen.getByLabelText("How rested from 0 to 10"), {
      target: { value: "3" },
    });
    fireEvent.change(screen.getByLabelText("Notes"), {
      target: { value: "coffee late" },
    });
    expect(
      Object.keys(localStorage).some((k) => k.includes("draft_sleep:")),
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Undo changes" }));
    expect(screen.getByLabelText("How rested from 0 to 10")).toHaveValue("7");
    expect(screen.getByLabelText("Notes")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Saved" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Undo changes" })).toBeNull();
    expect(
      Object.keys(localStorage).some((k) => k.includes("draft_sleep:")),
    ).toBe(false);
  });

  it("undoes a new night back to its starting values", () => {
    localStorage.clear();
    setCacheOwner("u1");
    render(
      <NightForm
        night="2026-11-19"
        lastTimes={lastTimes}
        onNightChange={() => {}}
        onSave={() => {}}
      />,
    );
    fireEvent.change(screen.getByLabelText("How rested from 0 to 10"), {
      target: { value: "9" },
    });
    fireEvent.change(screen.getByLabelText("Bedtime"), {
      target: { value: "1:00 AM" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Undo changes" }));
    expect(screen.getByLabelText("How rested from 0 to 10")).toHaveValue("");
    expect(screen.getByLabelText("Bedtime")).toHaveValue("11:00 PM");
  });
});

describe("bedMinutes", () => {
  it("adds time before getting up and wraps past midnight", () => {
    expect(bedMinutes(23 * 60, 7 * 60)).toBe(480);
    expect(bedMinutes(23 * 60, 7 * 60, 20)).toBe(500);
  });
});
