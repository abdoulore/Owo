import type { ReactNode } from "react";

// Page content area. Width and viewport height are owned by the app shell (App.tsx);
// this just fills the shell's scrollable region and pads the content. min-h-full so
// short pages still fill the height, letting pages vertically center with flex-1.
// The withNav prop is kept for call-site compatibility; the nav is now a real block
// in the shell, so no bottom padding is needed to clear it.
export function Screen({ children }: { children: ReactNode; withNav?: boolean }) {
  return <div className="flex min-h-full flex-1 flex-col px-5 py-8">{children}</div>;
}
