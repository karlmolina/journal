import type { Workout } from "../hooks/useWorkouts";

// Workouts without sets, like yoga, logged once they're over.

// Offered first, before what you've logged yourself.
const COMMON = ["Yoga", "Run", "Walk", "Bike", "Swim", "Hike"];

const pad = (n: number) => String(n).padStart(2, "0");
export const localDate = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const localTime = (d: Date) =>
  `${pad(d.getHours())}:${pad(d.getMinutes())}`;

// What to offer as chips: the common ones, then your own, most recent first.
export function activityChoices(history: Workout[]) {
  const seen = new Set(COMMON.map((a) => a.toLowerCase()));
  const own: string[] = [];
  for (const w of history) {
    const a = w.activity?.trim();
    if (a && !seen.has(a.toLowerCase())) {
      seen.add(a.toLowerCase());
      own.push(a);
    }
  }
  return [...COMMON, ...own];
}

// The saved times from the form's fields: it ended on that day at that time
// and lasted that many minutes.
export function activityTimes(date: string, time: string, minutes: number) {
  const end = new Date(`${date}T${time}`);
  if (Number.isNaN(end.getTime())) return null;
  return {
    started_at: new Date(end.getTime() - minutes * 60_000).toISOString(),
    ended_at: end.toISOString(),
  };
}
