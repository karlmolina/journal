const DAY_MS = 24 * 60 * 60 * 1000;

const startOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

// Short, relative label for an entry: "Today · 7:18 PM", "Yesterday · 9:02 AM",
// "Friday, Oct 16 · 6:48 PM", with the year added for other years.
export default function formatDate(date: string | number | Date): string {
  const d = new Date(date);
  const now = new Date();
  const time = d.toLocaleString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  const days = Math.round((startOfDay(now) - startOfDay(d)) / DAY_MS);
  if (days === 0) return `Today · ${time}`;
  if (days === 1) return `Yesterday · ${time}`;

  const day = d.toLocaleString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: d.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
  return `${day} · ${time}`;
}

// The full date and time, for the timestamp's tooltip.
export const formatFullDate = (date: string | number | Date): string =>
  new Date(date).toLocaleString("en-US", {
    dateStyle: "full",
    timeStyle: "short",
  });
