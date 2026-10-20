const pad = (n: number) => n.toString().padStart(2, "0");

// Stopwatch style: 4:05, 1:02:03.
export function formatClock(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

// Summary style: 45 min, 1 hr 5 min.
export function formatDuration(totalSeconds: number) {
  const minutes = Math.round(totalSeconds / 60);
  if (minutes < 1) return `${totalSeconds} sec`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

// Accepts "45" (seconds), "1:30" or "1:02:03"; null when it doesn't parse.
export function parseClock(text: string): number | null {
  const parts = text.trim().split(":");
  if (parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
  const seconds = parts.reduce((total, p) => total * 60 + Number(p), 0);
  return seconds > 0 ? seconds : null;
}
