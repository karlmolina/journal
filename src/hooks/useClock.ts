import { useEffect, useState } from "react";

// The nearest instant to `t` when a clock started at `origin` ticks over.
export const onGrid = (t: number, origin: number) =>
  origin + Math.round((t - origin) / 1000) * 1000;

// The current time, updated right as each second ticks over for a clock
// started at `origin`. Every clock on the page reads this one value and
// counts from times on the same grid, so their seconds change together.
export default function useClock(origin: number) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    let id: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const t = Date.now();
      const into = (((t - origin) % 1000) + 1000) % 1000;
      // A few ms late so the tick lands just past the boundary.
      id = setTimeout(() => {
        setNow(Date.now());
        schedule();
      }, 1000 - into + 5);
    };
    setNow(Date.now());
    schedule();
    return () => clearTimeout(id);
  }, [origin]);
  return now;
}
