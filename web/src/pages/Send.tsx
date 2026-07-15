import { useEffect, useState } from "react";
import { keccak256, toHex, type Hex } from "viem";
import { motion, useReducedMotion } from "motion/react";
import { CheckCircle, Copy, PencilSimple, ShareNetwork, WarningCircle } from "@phosphor-icons/react";
import { api } from "../lib/api";
import {
  parseUsdcAmount,
  parseNairaToUsdc,
  formatUsdcAmount,
  formatUsdcDisplay,
  formatNairaFromUsdc,
} from "../lib/money";
import { getUserEmail, isLoggedIn, loginWithGoogle } from "../lib/magic";
import { getSmartAccountAddress, sendPayment } from "../lib/zerodev";
import { displayNameFromEmail } from "../lib/identity";
import { Screen } from "../components/Screen";
import { Button } from "../components/Button";
import { AmountInput } from "../components/AmountInput";

const NAME_KEY = "owo.name";

export function Send() {
  const reduceMotion = useReducedMotion();
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"usd" | "ngn">("usd");
  const [note, setNote] = useState("");
  const [name, setName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [status, setStatus] = useState<"idle" | "working" | "error" | "session-expired">("idle");
  const [error, setError] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Pre-fill the sender name: a saved override, else the friendly name from the email.
  // Editable, so "Ore" can become "Dad" or "Uncle Tunde" without any setup screen.
  useEffect(() => {
    const saved = localStorage.getItem(NAME_KEY);
    if (saved) {
      setName(saved);
      return;
    }
    getUserEmail().then((email) => setName(displayNameFromEmail(email)));
  }, []);

  // The entered value is interpreted in the active currency; parsedAmount is always
  // the USDC base units that actually get sent.
  let parsedAmount: bigint | null = null;
  try {
    parsedAmount = amount ? (currency === "usd" ? parseUsdcAmount(amount) : parseNairaToUsdc(amount)) : null;
  } catch {
    parsedAmount = null;
  }

  function toggleCurrency() {
    const next = currency === "usd" ? "ngn" : "usd";
    if (parsedAmount) {
      setAmount(
        next === "usd"
          ? formatUsdcAmount(parsedAmount)
          : formatNairaFromUsdc(parsedAmount).replace(/,/g, "")
      );
    }
    setCurrency(next);
  }

  function saveName(next: string) {
    setName(next);
    if (next.trim()) localStorage.setItem(NAME_KEY, next.trim());
  }

  async function handleCreateLink() {
    if (!(await isLoggedIn())) {
      setStatus("session-expired");
      return;
    }
    if (!parsedAmount) return;

    setStatus("working");
    setError(null);

    try {
      const amountBaseUnits = parsedAmount;

      const secretBytes = crypto.getRandomValues(new Uint8Array(32));
      const secret = toHex(secretBytes) as Hex;
      const claimHash = keccak256(secret);

      const senderAddress = await getSmartAccountAddress();
      const senderDisplay = name.trim() || "Someone";

      const { linkId, expiry } = await api.createLink({
        amount: amountBaseUnits.toString(),
        note: note || undefined,
        senderAddress,
        senderDisplay,
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
    if (!shareLink || !parsedAmount) return;
    const dollars = formatUsdcDisplay(parsedAmount);
    if (navigator.share) {
      await navigator.share({ text: `Sent you $${dollars} on Owó`, url: shareLink }).catch(() => {});
    } else {
      await handleCopy();
    }
  }

  if (status === "session-expired") {
    return (
      <Screen withNav>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <WarningCircle className="text-faint" size={40} />
          <p className="text-base text-muted">Your session expired. Sign in again to continue.</p>
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
    const dollars = parsedAmount ? formatUsdcDisplay(parsedAmount) : "";
    return (
      <Screen withNav>
        <motion.div
          initial={reduceMotion ? false : { scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
          className="flex flex-1 flex-col items-center justify-center gap-4 text-center"
        >
          <CheckCircle className="text-accent" size={56} weight="fill" />
          <p className="text-xl font-semibold text-ink">${dollars} ready to send</p>
          <p className="max-w-[28ch] text-sm text-muted">
            Share the link with anyone. They tap once to claim it, with no app or wallet
            to set up.
          </p>
        </motion.div>
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

  const equivalent = parsedAmount
    ? currency === "usd"
      ? `≈ ₦${formatNairaFromUsdc(parsedAmount)}`
      : `≈ $${formatUsdcDisplay(parsedAmount)}`
    : null;

  // Quick-amount chips, in whichever currency the pad is set to.
  const presets = currency === "usd" ? [5, 10, 25, 50] : [5000, 10000, 25000, 50000];

  return (
    <Screen withNav>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium text-ink">Send money</h1>
        <button
          type="button"
          onClick={toggleCurrency}
          className="flex rounded-full bg-sand p-0.5 text-xs font-medium"
        >
          <span className={`rounded-full px-2.5 py-1 ${currency === "usd" ? "bg-accent text-white" : "text-muted"}`}>
            $
          </span>
          <span className={`rounded-full px-2.5 py-1 ${currency === "ngn" ? "bg-accent text-white" : "text-muted"}`}>
            ₦
          </span>
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <div className="flex flex-col items-center gap-1">
          <AmountInput
            value={amount}
            onChange={setAmount}
            autoFocus
            symbol={currency === "usd" ? "$" : "₦"}
          />
          {equivalent && <p className="text-sm text-muted">{equivalent}</p>}
        </div>

        <div className="flex w-full max-w-[26ch] gap-2">
          {presets.map((p) => {
            const val = String(p);
            const active = amount === val;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setAmount(val)}
                className={`flex-1 rounded-full py-2 text-sm font-medium transition-transform active:scale-[0.97] ${
                  active ? "bg-accent text-white" : "bg-sand text-ink"
                }`}
              >
                {currency === "usd" ? `$${p}` : `₦${p / 1000}k`}
              </button>
            );
          })}
        </div>

        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What's it for? (optional)"
          className="w-full max-w-[26ch] rounded-full bg-sand px-4 py-3 text-center text-sm text-ink outline-none placeholder:text-faint"
        />

        {editingName ? (
          <input
            value={name}
            autoFocus
            onChange={(e) => saveName(e.target.value)}
            onBlur={() => setEditingName(false)}
            onKeyDown={(e) => e.key === "Enter" && setEditingName(false)}
            placeholder="Your name"
            className="w-full max-w-[26ch] rounded-full bg-sand px-4 py-2.5 text-center text-sm text-ink outline-none placeholder:text-faint"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditingName(true)}
            className="flex items-center gap-1.5 text-sm text-muted"
          >
            They'll see this from <span className="font-medium text-ink">{name || "you"}</span>
            <PencilSimple size={14} weight="bold" className="text-faint" />
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 text-sm text-red-600">
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
