// The sleep log as compact text to paste into a chatbot: a short legend, then
// one terse line per night, so even a long log fits a phone's clipboard.
import type { SleepNight } from "../hooks/useSleep";
import { bedMinutes, sleepMinutes } from "./sleep";

const pad = (n: number) => n.toString().padStart(2, "0");

// 23:05, 24-hour so AM/PM doesn't take space.
const clock = (minutes: number) => {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
};

// 7:45 for 7 hr 45 min.
const hm = (minutes: number) => {
  const m = Math.round(minutes);
  return `${Math.floor(m / 60)}:${pad(m % 60)}`;
};

const asleep = (n: SleepNight) =>
  sleepMinutes(n.bedtime, n.woke_at, n.fall_asleep_minutes + n.awake_minutes);
const inBed = (n: SleepNight) =>
  bedMinutes(n.bedtime, n.woke_at, n.out_of_bed_minutes);

// 11-18 23:00-07:15 7 7:50/8:15 f10 a5 o15 g30 t60 | notes
export function exportLine(n: SleepNight) {
  const parts = [
    n.night.slice(5),
    `${clock(n.bedtime)}-${clock(n.woke_at + n.out_of_bed_minutes)}`,
    String(n.quality),
    `${hm(asleep(n))}/${hm(inBed(n))}`,
  ];
  if (n.fall_asleep_minutes > 0) parts.push(`f${n.fall_asleep_minutes}`);
  if (n.awake_minutes > 0) parts.push(`a${n.awake_minutes}`);
  if (n.out_of_bed_minutes > 0) parts.push(`o${n.out_of_bed_minutes}`);
  if (n.get_ready_minutes !== null) parts.push(`g${n.get_ready_minutes}`);
  if (n.tech_free_minutes !== null) parts.push(`t${n.tech_free_minutes}`);
  const notes = n.notes.replace(/\s+/g, " ").trim();
  return parts.join(" ") + (notes ? ` | ${notes}` : "");
}

// Nights come newest first, as useSleep keeps them.
export function sleepExport(nights: SleepNight[]) {
  if (nights.length === 0) return "";
  const sorted = [...nights].sort((a, b) => b.night.localeCompare(a.night));
  const avg = (f: (n: SleepNight) => number) =>
    sorted.reduce((sum, n) => sum + f(n), 0) / sorted.length;
  const lines = [
    `My sleep log: ${sorted.length} night${sorted.length === 1 ? "" : "s"}, ${sorted[sorted.length - 1].night} to ${sorted[0].night}, newest first.`,
    "Each line: date bed-up rested asleep/inbed [f a o g t] | notes",
    "date: MM-DD of the evening the night began (a year line starts each year). bed: bedtime, up: got out of bed (24h).",
    "rested: how rested I felt on waking, 0 exhausted to 10 fully restored. asleep, inbed: h:mm.",
    "Minutes: f to fall asleep, a awake in the night, o awake in bed before getting up (all 0 if missing); g started getting ready, t screens off, before bedtime (not logged if missing).",
    `Average: rested ${avg((n) => n.quality).toFixed(1)}, asleep ${hm(avg(asleep))}, in bed ${hm(avg(inBed))}`,
  ];
  let year = "";
  for (const n of sorted) {
    if (n.night.slice(0, 4) !== year) {
      year = n.night.slice(0, 4);
      lines.push(year);
    }
    lines.push(exportLine(n));
  }
  return lines.join("\n");
}
