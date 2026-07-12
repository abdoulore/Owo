import { useParams } from "react-router-dom";

// TODO(Phase 3): fetch link metadata, handle pending-not-funded / already-claimed /
// expired / invalid states, Google login if needed, claim button, success animation.
// Before triggering login, set sessionStorage "owo.returnTo" to the full claim path
// INCLUDING the #secret fragment so AuthCallback routes the recipient back here.
// api.claim()'s `recipient` must be the recipient's own smart account address
// (lib/zerodev.ts getSmartAccountAddress()), not their Magic EOA — the escrow
// pays out to whatever address is passed, and history/claims key off the same
// smart-account identity used on the sender side.
export function Claim() {
  const { linkId } = useParams();

  return (
    <main>
      <h1>Claim {linkId}</h1>
    </main>
  );
}
