import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { completeGoogleLogin } from "../lib/magic";

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
      <main>
        <p>Something went wrong signing you in.</p>
        <button type="button" onClick={() => navigate("/", { replace: true })}>
          Try again
        </button>
      </main>
    );
  }

  return (
    <main>
      <p>Signing you in…</p>
    </main>
  );
}
