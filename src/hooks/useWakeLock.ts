import { useEffect } from "react";

// Keeps the screen from dimming and locking while `active` is true, so a
// recipe or a workout stays readable with messy or busy hands. The browser
// drops the lock whenever the page is hidden, so it's taken again when the
// page comes back. Does nothing where the Screen Wake Lock API isn't there.
export default function useWakeLock(active = true) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let stopped = false;
    const acquire = async () => {
      if (document.visibilityState !== "visible" || (lock && !lock.released))
        return;
      try {
        const next = await navigator.wakeLock.request("screen");
        if (stopped) next.release().catch(() => {});
        else lock = next;
      } catch {
        // Refused (low battery, no user gesture yet, …): the screen just
        // sleeps as usual.
      }
    };
    acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", acquire);
      lock?.release().catch(() => {});
    };
  }, [active]);
}
