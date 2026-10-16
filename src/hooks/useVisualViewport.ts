import { useEffect } from "react";

// `100dvh` doesn't shrink when the on-screen keyboard opens (iOS Safari, and
// Android Chrome by default), so a full-height layout ends up taller than the
// visible area and the browser scrolls the whole page to reveal the focused
// input. Mirror the visual viewport into CSS variables so a fixed layout can
// size and position itself to exactly what's on screen.
export default function useVisualViewport() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    const update = () => {
      // Leave pinch-zoom alone; only track keyboard-driven changes.
      if (Math.abs(vv.scale - 1) > 0.01) return;
      root.style.setProperty("--vv-height", `${vv.height}px`);
      root.style.setProperty("--vv-top", `${vv.offsetTop}px`);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      root.style.removeProperty("--vv-height");
      root.style.removeProperty("--vv-top");
    };
  }, []);
}
