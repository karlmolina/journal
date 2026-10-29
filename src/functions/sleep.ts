// Sleep scores, clock times and how long a night was. Times are minutes after
// midnight in the person's own day.

const DAY = 24 * 60;

// What each score means, so a 6 means the same thing every morning.
export const QUALITY_WORDS = [
  "No sleep at all",
  "Barely slept, up almost all night",
  "Awful: broken and restless",
  "Poor: woke up a lot, still tired",
  "Below par: groggy morning",
  "Okay: got by, nothing more",
  "Decent: a few wake-ups, mostly fine",
  "Good: slept well, slow to get going",
  "Great: deep sleep, woke up refreshed",
  "Excellent: straight through, full of energy",
  "Best sleep in ages, fully restored",
];

// The theme's warning yellow is hard to read on light backgrounds, so middling
// scores use a deeper amber there.
export const qualityText = (q: number) =>
  q <= 3
    ? "text-error"
    : q <= 6
      ? "text-amber-600 dark:text-warning"
      : "text-success";

export const qualityBg = (q: number) =>
  `${qualityText(q)} ${q <= 3 ? "bg-error/15" : q <= 6 ? "bg-warning/20" : "bg-success/15"}`;

// Wraps past midnight either way, so dragging bedtime down from 12:00 AM
// lands on 11:45 PM.
const wrap = (minutes: number) => ((minutes % DAY) + DAY) % DAY;

const pad = (n: number) => n.toString().padStart(2, "0");

// 11:30 PM
export function formatTime(minutes: number) {
  const m = wrap(minutes);
  const h = Math.floor(m / 60);
  return `${h % 12 || 12}:${pad(m % 60)} ${h < 12 ? "AM" : "PM"}`;
}

// Accepts "11:30 PM", "11pm", "23:30", "2330" or "7"; null when it doesn't
// parse.
export function parseTime(text: string): number | null {
  const match = text
    .trim()
    .match(/^(\d{1,2})(?::?(\d{2}))?\s*(?:([ap])\.?\s*m?\.?)?$/i);
  if (!match) return null;
  const [, hours, minutes = "0", half] = match;
  let h = Number(hours);
  const m = Number(minutes);
  if (m > 59) return null;
  if (half) {
    if (h < 1 || h > 12) return null;
    h = (h % 12) + (half.toLowerCase() === "p" ? 12 : 0);
  } else if (h > 23) return null;
  return h * 60 + m;
}

// Postgres sends times as "23:30:00" and takes "23:30".
export const fromDbTime = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};
export const toDbTime = (minutes: number) => {
  const m = wrap(minutes);
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
};

// A wake-up at or before bedtime is the next morning. Time spent awake in bed
// (falling asleep, awake in the night) doesn't count as sleep.
export const sleepMinutes = (bedtime: number, wokeAt: number, awake = 0) =>
  Math.max(0, wrap(wokeAt - bedtime) - awake);

export const MAX_FALL_ASLEEP = 720;

// Whole minutes, like "20" or "20 min"; null when it doesn't parse.
export function parseMinutes(text: string): number | null {
  const match = text.trim().match(/^(\d{1,3})\s*(?:m|min|mins|minutes?)?$/i);
  if (!match) return null;
  const n = Number(match[1]);
  return n <= MAX_FALL_ASLEEP ? n : null;
}

// 7 hr 45 min
export function formatSleep(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

export const localDate = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const today = () => localDate(new Date());

// The night you're most likely logging: last night until the evening, then
// tonight.
export function defaultNight(now = new Date()) {
  const d = new Date(now);
  if (d.getHours() < 18) d.setDate(d.getDate() - 1);
  return localDate(d);
}

// "Mon, Oct 26", read as a local date rather than UTC midnight.
export function formatNight(night: string) {
  const [y, m, d] = night.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
