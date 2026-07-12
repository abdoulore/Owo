import { useParams } from "react-router-dom";

// TODO(Phase 3): fetch link metadata, handle pending-not-funded / already-claimed /
// expired / invalid states, Google login if needed, claim button, success animation.
export function Claim() {
  const { linkId } = useParams();

  return (
    <main>
      <h1>Claim {linkId}</h1>
    </main>
  );
}
