import React, { useEffect, useLayoutEffect } from "react";
import { themeChange } from "theme-change";

// Keep <meta name="theme-color"> in step with the active theme's background so
// the mobile browser's status and navigation bars match the page.
function syncThemeColor() {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  const bg = getComputedStyle(document.documentElement).backgroundColor;
  if (bg) meta.setAttribute("content", toHex(bg));
}

// Computed colors come back as oklch()/lab(), which not every browser accepts
// for theme-color; round-trip through a canvas to get plain hex.
function toHex(color: string) {
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return color;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export default function ThemeRoot({ children }: { children: React.ReactNode }) {
  useLayoutEffect(() => {
    themeChange(false);
  }, []);

  useEffect(() => {
    syncThemeColor();
    const observer = new MutationObserver(syncThemeColor);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", syncThemeColor);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", syncThemeColor);
    };
  }, []);

  return <>{children}</>;
}
