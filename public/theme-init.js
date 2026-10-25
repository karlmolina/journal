// Apply the saved theme before first paint so the page (and the browser chrome
// that samples its colors) never flashes the light default. Kept as a file
// rather than an inline script because the CSP only allows script-src 'self'.
try {
  var t = localStorage.getItem("theme");
  if (t) document.documentElement.setAttribute("data-theme", t);
} catch (e) {}
