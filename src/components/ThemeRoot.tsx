import React, { useLayoutEffect } from "react";
import { themeChange } from "theme-change";

export default function ThemeRoot({ children }: { children: React.ReactNode }) {
  useLayoutEffect(() => {
    themeChange(false);
  }, []);

  return <>{children}</>;
}
