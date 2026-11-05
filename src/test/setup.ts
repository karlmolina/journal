import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// What jsdom leaves out that the app reaches for.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }),
});
window.scrollTo = () => {};
window.scrollBy = () => {};
Element.prototype.scrollIntoView = () => {};
class NoObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
window.ResizeObserver ??= NoObserver as unknown as typeof ResizeObserver;
window.IntersectionObserver ??=
  NoObserver as unknown as typeof IntersectionObserver;

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.useRealTimers();
});
