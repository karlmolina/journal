import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Tags reported errors with the build they came from.
  define: {
    __BUILD__: JSON.stringify(
      process.env.GITHUB_SHA?.slice(0, 7) ?? new Date().toISOString(),
    ),
  },
  build: {
    rollupOptions: {
      plugins: [],
    },
  },
});
