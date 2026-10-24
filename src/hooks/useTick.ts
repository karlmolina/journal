import { useEffect, useState } from "react";

// Re-renders every `ms` while `running` is true, for live clocks.
export default function useTick(running: boolean, ms = 1000) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setTick((t) => t + 1), ms);
    return () => clearInterval(id);
  }, [running, ms]);
}
