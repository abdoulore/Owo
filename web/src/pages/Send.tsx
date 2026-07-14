import { useState } from "react";
import { keccak256, toHex, type Hex } from "viem";
import { CheckCircle, Copy, ShareNetwork, WarningCircle } from "@phosphor-icons/react";
import { api } from "../lib/api";
import { parseUsdcAmount } from "../lib/money";
import { getUserEmail, isLoggedIn, loginWithGoogle } from "../lib/magic";
import { getSmartAccountAddress, sendPayment } from "../lib/zerodev";
import { Screen } from "../components/Screen";
import { Button } from "../components/Button";
import { AmountInput } from "../components/AmountInput";

export function Send() {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "working" | "error" | "session-expired">("idle");
  const [error, setError] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  let parsedAmount: bigint | null = null;
  try {
    parsedAmount = amount ? parseUsdcAmount(amount) : null;
  } catch {
    parsedAmount = null;
  }

  async function handleCreateLink() {
    // Session may have lapsed while the user sat idle on this screen (expired
    // Magic session). Catch it here rather than letting the ZeroDev call fail
    // with a confusing error.
    if (!(await isLoggedIn())) {
      setStatus("session-expired");
      return;
    }

    setStatus("working");
    setError(null);

    try {
      const amountBaseUnits = parseUsdcAmount(amount);

      const secretBytes = crypto.getRandomValues(new Uint8Array(32));
      const secret = toHex(secretBytes) as Hex;
      const claimHash = keccak256(secret);

      const [senderAddress, senderDisplay] = await Promise.all([
        getSmartAccountAddress(),
        getUserEmail(),
      ]);

      const { linkId, expiry } = await api.createLink({
        amount: amountBaseUnits.toString(),
        note: note || undefined,
        senderAddress,
        senderDisplay: senderDisplay ?? undefined,
        claimHash,
      });

      const { claimId, fundTx } = await sendPayment({ amount: amountBaseUnits, claimHash, expiry });

      await api.markFunded(linkId, { claimIdOnchain: claimId, fundTx });

      setShareLink(`${window.location.origin}/c/${linkId}#${secret.slice(2)}`);
      setStatus("idle");
    } catch (err) {
      setError((err as Error).message);
      setStatus("error");
    }
  }

  async function handleCopy() {
    if (!shareLink) return;
    await navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleShare() {
    if (!shareLink) return;
    if (navigator.share) {
      await navigator.share({ text: `Sent you $${amount} on Owó`, url: shareLink }).catch(() => {});
    } else {
      await handleCopy();
    }
  }

  if (status === "session-expired") {
    return (
      <Screen withNav>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <WarningCircle className="text-zinc-400 dark:text-zinc-500" size={40} />
          <p className="text-base text-zinc-500 dark:text-zinc-400">
            Your session expired. Sign in again to continue.
          </p>
        </div>
        <Button
          onClick={() => {
            sessionStorage.setItem("owo.returnTo", "/send");
            loginWithGoogle();
          }}
        >
          Sign in again
        </Button>
      </Screen>
    );
  }

  if (shareLink) {
    return (
      <Screen withNav>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <CheckCircle className="text-accent dark:text-accent-dark" size={48} weight="fill" />
          <p className="text-lg text-zinc-600 dark:text-zinc-400">
            ${amount} is ready to send
          </p>
          <div className="w-full truncate rounded-[1.25rem] bg-zinc-100 px-4 py-3 text-sm text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
            {shareLink}
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={handleCopy} className="flex-1">
            <Copy size={18} weight="bold" />
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button onClick={handleShare} className="flex-1">
            <ShareNetwork size={18} weight="bold" />
            Share
          </Button>
        </div>
      </Screen>
    );
  }

  return (
    <Screen withNav>
      <h1 className="text-center text-lg font-medium text-zinc-900 dark:text-zinc-50">
        Send money
      </h1>

      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <AmountInput value={amount} onChange={setAmount} autoFocus />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note (optional)"
          className="w-full max-w-[24ch] rounded-full bg-zinc-100 px-4 py-3 text-center text-sm text-zinc-700 outline-none placeholder:text-zinc-400 dark:bg-zinc-900 dark:text-zinc-200 dark:placeholder:text-zinc-600"
        />
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
          <WarningCircle size={18} weight="bold" />
          <span>{error}</span>
        </div>
      )}

      <Button
        disabled={!parsedAmount || status === "working"}
        loading={status === "working"}
        onClick={handleCreateLink}
      >
        {status === "working" ? "Sending…" : "Continue"}
      </Button>
    </Screen>
  );
}
