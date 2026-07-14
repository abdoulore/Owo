import type { ReactNode } from "react";

// Mobile-first page shell. min-h-dvh (not h-screen) so iOS Safari's address
// bar collapsing doesn't jump the layout. Bottom padding clears the nav bar.
export function Screen({ children, withNav = false }: { children: ReactNode; withNav?: boolean }) {
  return (
    <main
      className={`mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pt-8 ${
        withNav ? "pb-24" : "pb-8"
      }`}
    >
      {children}
    </main>
  );
}
