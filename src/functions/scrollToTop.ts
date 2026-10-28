// Brings the current exercise's card (or the set just finished) to the top
// of the screen in one glide (a jump with reduced motion). Cards swap, the rest card comes and goes and
// sets fold away right as you tap, so it waits for the page to hold still
// before picking where to go. Asked again before then, the latest ask wins.
// Only a glide that ends well off target (the page changed on the way) gets
// one more, and touching the page cancels it all.
let stopScrolling: (() => void) | null = null;
// Mid-glide, so nothing else should move the page: any instant scroll, even
// a fraction of a pixel, stops the glide where it is.
let gliding = false;
export const isGliding = () => gliding;
export default function scrollToTop(target: () => HTMLElement | null) {
  stopScrolling?.();
  const behavior = matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
  let frame = 0;
  let timer = 0;
  const stop = () => {
    stopScrolling = null;
    gliding = false;
    cancelAnimationFrame(frame);
    clearTimeout(timer);
    removeEventListener("touchstart", stop);
    removeEventListener("wheel", stop);
  };
  stopScrolling = stop;
  addEventListener("touchstart", stop, { passive: true });
  addEventListener("wheel", stop, { passive: true });
  // How far the card is from where it should be, and whether the page can
  // still scroll that way.
  const offset = () => {
    const el = target();
    if (!el?.isConnected) return null;
    const r = el.getBoundingClientRect();
    const off = r.top - parseFloat(getComputedStyle(el).scrollMarginTop || "0");
    const atBottom = innerHeight + scrollY >= document.body.scrollHeight - 1;
    return (off > 0 && atBottom) || (off < 0 && scrollY <= 0) ? 0 : off;
  };
  const glide = (corrected: boolean) => {
    const off = offset();
    if (off === null || Math.abs(off) <= 2) return stop();
    gliding = true;
    target()!.scrollIntoView({ behavior, block: "start" });
    // Wait for the glide to end, then look once more.
    let lastY = NaN;
    const ended = () => {
      if (scrollY !== lastY) {
        lastY = scrollY;
        timer = setTimeout(ended, 100);
        return;
      }
      const left = offset();
      if (!corrected && left !== null && Math.abs(left) > 24) glide(true);
      else stop();
    };
    timer = setTimeout(ended, 100);
  };
  // Hold off until the card and the page keep the same place and size for a
  // few frames, or a third of a second has gone by.
  const started = performance.now();
  let last = "";
  let still = 0;
  const wait = () => {
    const el = target();
    const now = el
      ? `${el.getBoundingClientRect().top + scrollY}:${document.body.scrollHeight}`
      : "";
    still = now === last ? still + 1 : 0;
    last = now;
    if (still >= 3 || performance.now() - started > 350) glide(false);
    else frame = requestAnimationFrame(wait);
  };
  frame = requestAnimationFrame(wait);
}
