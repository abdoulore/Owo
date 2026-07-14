import { NavLink } from "react-router-dom";
import { House, PaperPlaneTilt, Receipt } from "@phosphor-icons/react";

const items = [
  { to: "/home", label: "Home", icon: House },
  { to: "/send", label: "Send", icon: PaperPlaneTilt },
  { to: "/receipts", label: "Receipts", icon: Receipt },
];

export function NavBar() {
  return (
    <nav className="shrink-0 border-t border-zinc-200 bg-zinc-50/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="flex items-center justify-around px-2 py-2">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 rounded-2xl px-4 py-2 text-xs font-medium ${
                isActive
                  ? "text-accent dark:text-accent-dark"
                  : "text-zinc-400 dark:text-zinc-500"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={22} weight={isActive ? "fill" : "regular"} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
