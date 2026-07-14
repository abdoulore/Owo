import { useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CircleNotch } from "@phosphor-icons/react";
import { isLoggedIn } from "../lib/magic";
import { Screen } from "./Screen";

// Guards /home, /send, /activity: covers both direct navigation without ever
// logging in, and a Magic session that expired since the last page load.
export function RequireAuth({ children }: { children: ReactNode }) {
  const [checked, setChecked] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    isLoggedIn().then((loggedIn) => {
      if (!loggedIn) {
        sessionStorage.setItem("owo.returnTo", location.pathname);
        navigate("/", { replace: true });
        return;
      }
      setChecked(true);
    });
  }, [navigate, location.pathname]);

  if (!checked) {
    return (
      <Screen>
        <div className="flex flex-1 items-center justify-center">
          <CircleNotch className="animate-spin text-faint" size={28} />
        </div>
      </Screen>
    );
  }

  return <>{children}</>;
}
