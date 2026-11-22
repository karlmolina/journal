import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ActivityForm from "./ActivityForm";
import WorkoutHistoryCard from "./WorkoutHistoryCard";
import { activityChoices, activityTimes } from "../../functions/activities";
import type { ActivityInput, Workout } from "../../hooks/useWorkouts";

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1" } }),
}));

const yoga: Workout = {
  id: "w1",
  started_at: "2026-11-20T17:00:00.000Z",
  ended_at: "2026-11-20T17:45:00.000Z",
  paused_at: null,
  paused_seconds: 0,
  notes: "Hip openers, long holds",
  activity: "Yoga",
  plan_id: null,
  plan_session: null,
  supersets: null,
  plan_changes: null,
  workout_sets: [],
};

describe("Logging another workout", () => {
  it("saves what it was, when it ended, how long and a description", async () => {
    const saved: ActivityInput[] = [];
    render(
      <ActivityForm
        choices={activityChoices([])}
        onCancel={() => {}}
        onSave={async (input) => {
          saved.push(input);
          return true;
        }}
      />,
    );
    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Yoga" }));
    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "2026-11-20" },
    });
    fireEvent.change(screen.getByLabelText("Finished at"), {
      target: { value: "09:30" },
    });
    const minutes = screen.getByLabelText("How long, in minutes");
    await userEvent.clear(minutes);
    await userEvent.type(minutes, "45");
    await userEvent.type(screen.getByLabelText("Description"), "Sun salutes");
    await userEvent.click(save);

    expect(saved).toEqual([
      {
        activity: "Yoga",
        ...activityTimes("2026-11-20", "09:30", 45),
        notes: "Sun salutes",
      },
    ]);
    const { started_at, ended_at } = saved[0];
    expect(Date.parse(ended_at) - Date.parse(started_at)).toBe(45 * 60_000);
  });

  it("starts from the logged workout when editing it", () => {
    render(
      <ActivityForm
        workout={yoga}
        choices={activityChoices([yoga])}
        onCancel={() => {}}
        onSave={async () => true}
      />,
    );
    expect(screen.getByDisplayValue("Yoga")).toBeInTheDocument();
    expect(screen.getByLabelText("How long, in minutes")).toHaveValue("45");
    expect(screen.getByLabelText("Description")).toHaveValue(
      "Hip openers, long holds",
    );
  });

  it("offers your own activities after the common ones, once each", () => {
    const climb = { ...yoga, id: "w2", activity: "Climbing" };
    expect(
      activityChoices([
        climb,
        { ...climb, id: "w3" },
        yoga,
        { ...yoga, activity: null },
      ]),
    ).toEqual(["Yoga", "Run", "Walk", "Bike", "Swim", "Hike", "Climbing"]);
  });

  it("shows in past workouts with its name and description, not sets", async () => {
    const edited: string[] = [];
    render(
      <WorkoutHistoryCard
        workout={yoga}
        onEdit={() => edited.push("w1")}
        onDelete={() => {}}
      />,
    );
    expect(screen.getByText("Yoga")).toBeInTheDocument();
    expect(screen.queryByText(/sets?$/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { expanded: false }));
    expect(screen.queryByText("No sets logged.")).not.toBeInTheDocument();
    expect(screen.queryByText("Workout time")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(edited).toEqual(["w1"]);
  });
});
