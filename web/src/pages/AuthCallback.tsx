import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CircleNotch, WarningCircle } from "@phosphor-icons/react";
import { completeGoogleLogin } from "../lib/magic";
import { Screen } from "../components/Screen";
import { Button } from "../components/Button";

// Magic redirects here after Google login. Completing the flow consumes the
// one-time credential in the URL, so it must run exactly once (StrictMode
// double-mounts effects in dev, hence the ref guard).
export function AuthCallback() {
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    completeGoogleLogin()
      .then((address) => {
        console.log("[auth] logged in, wallet:", address);
        const returnTo = sessionStorage.getItem("owo.returnTo") ?? "/home";
        sessionStorage.removeItem("owo.returnTo");
        navigate(returnTo, { replace: true });
      })
      .catch((err) => {
        console.error("[auth] login failed:", err);
        setFailed(true);
      });
  }, [navigate]);

  if (failed) {
    return (
      <Screen>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <WarningCircle className="text-faint" size={40} />
          <p className="text-base text-muted">Something went wrong signing you in.</p>
        </div>
        <Button variant="secondary" onClick={() => navigate("/", { replace: true })}>
          Try again
        </Button>
      </Screen>
    );
  }

  return (
    <Screen>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <CircleNotch className="animate-spin text-accent" size={32} />
        <p className="text-base text-muted">Signing you in…</p>
      </div>
    </Screen>
  );
}
