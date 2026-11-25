import { useLayoutEffect, type RefObject } from "react";

// Marks `ref` as the page's bottom bar: its height goes into --bottom-dock on
// the root element, so corner buttons (notes for Claude) sit above it instead
// of over it.
export default function useBottomDock(ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const update = () =>
      root.style.setProperty("--bottom-dock", `${el.offsetHeight + 4}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--bottom-dock");
    };
  }, [ref]);
}
