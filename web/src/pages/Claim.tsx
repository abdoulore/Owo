import { useParams } from "react-router-dom";

// TODO(Phase 3): fetch link metadata, handle pending-not-funded / already-claimed /
// expired / invalid states, Google login if needed, claim button, success animation.
// Before triggering login, set sessionStorage "owo.returnTo" to the full claim path
// INCLUDING the #secret fragment so AuthCallback routes the recipient back here.
export function Claim() {
  const { linkId } = useParams();

  return (
    <main>
      <h1>Claim {linkId}</h1>
    </main>
  );
}
