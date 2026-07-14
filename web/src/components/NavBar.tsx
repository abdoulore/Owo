import { NavLink } from "react-router-dom";
import { House, PaperPlaneTilt, ClockCounterClockwise } from "@phosphor-icons/react";

// "Activity" not "Receipts": the app's whole thesis is that chains are invisible, so
// chain vocabulary stays out of the primary nav. The on-chain proof lives one tap
// deeper, inside a transaction's detail.
const items = [
  { to: "/home", label: "Home", icon: House },
  { to: "/send", label: "Send", icon: PaperPlaneTilt },
  { to: "/activity", label: "Activity", icon: ClockCounterClockwise },
];

export function NavBar() {
  return (
    <nav className="shrink-0 border-t border-line bg-cream/90 backdrop-blur">
      <div className="flex items-center justify-around px-2 py-2">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 rounded-2xl px-4 py-2 text-xs font-medium ${
                isActive ? "text-accent" : "text-faint"
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
