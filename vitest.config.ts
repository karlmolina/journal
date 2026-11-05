import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Tests run in a fake browser (jsdom), without Tailwind: they check what the
// app does, not how it looks.
export default defineConfig({
  plugins: [react()],
  define: { __BUILD__: JSON.stringify("test") },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    // Never reached: the tests hand the app its data.
    env: {
      VITE_SUPABASE_URL: "https://test.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "test",
    },
  },
});
