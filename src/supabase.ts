import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  {
    global: {
      // Deletes wait behind an Undo toast and are sent as the page is hidden;
      // keepalive lets that request finish if the tab is closing.
      fetch: (input, init) =>
        fetch(
          input,
          init?.method === "DELETE" ? { ...init, keepalive: true } : init,
        ),
    },
  },
);
