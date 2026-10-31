// Apply the saved theme before first paint so the page (and the browser chrome
// that samples its colors) never flashes the light default. Kept as a file
// rather than an inline script because the CSP only allows script-src 'self'.
try {
  var t = localStorage.getItem("theme");
  if (t) document.documentElement.setAttribute("data-theme", t);
  // Point at the manifest for this theme, so an installed app's system bars
  // match it (ThemeRoot keeps this in step when the theme changes).
  var m = document.querySelector('link[rel="manifest"]');
  if (m)
    m.setAttribute(
      "href",
      "/manifests/" +
        (t || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")) +
        ".webmanifest",
    );
} catch (e) {}
