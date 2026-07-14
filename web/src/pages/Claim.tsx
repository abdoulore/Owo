import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import {
  CheckCircle,
  CircleNotch,
  HourglassMedium,
  LinkBreak,
  WarningCircle,
} from "@phosphor-icons/react";
import { api, type LinkMetadata } from "../lib/api";
import { formatUsdcAmount } from "../lib/money";
import { getUserAddress, isLoggedIn, loginWithGoogle } from "../lib/magic";
import { getSmartAccountAddress } from "../lib/zerodev";
import { celebrateClaim } from "../lib/confetti";
import { Screen } from "../components/Screen";
import { Button } from "../components/Button";
import { AmountDisplay } from "../components/AmountDisplay";

type ViewState =
  | { kind: "loading" }
  | { kind: "invalid" }
  | { kind: "needs-login"; link: LinkMetadata }
  | { kind: "not-ready"; link: LinkMetadata }
  | { kind: "ready"; link: LinkMetadata }
  | { kind: "claiming"; link: LinkMetadata }
  | { kind: "success"; link: LinkMetadata }
  | { kind: "unclaimable"; link: LinkMetadata; reason: string };

function MoneyCard({ link, children }: { link: LinkMetadata; children?: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
      <AmountDisplay value={formatUsdcAmount(BigInt(link.amount))} />
      {link.senderDisplay && (
        <p className="text-base text-zinc-500 dark:text-zinc-400">From {link.senderDisplay}</p>
      )}
      {link.note && (
        <p className="max-w-[28ch] text-sm text-zinc-400 dark:text-zinc-500">"{link.note}"</p>
      )}
      {children}
    </div>
  );
}

export function Claim() {
  const { linkId } = useParams();
  // The secret lives only in the URL fragment -- never sent to the server except
  // transiently in the claim request itself, and never included in any React Router
  // param or server request used to fetch link metadata.
  const secret = window.location.hash.slice(1);
  const reduceMotion = useReducedMotion();
  const navigate = useNavigate();
  const celebrated = useRef(false);

  const [state, setState] = useState<ViewState>({ kind: "loading" });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (state.kind === "success" && !celebrated.current) {
      celebrated.current = true;
      if (!reduceMotion) celebrateClaim();
    }
  }, [state.kind, reduceMotion]);

  async function load() {
    if (!linkId || !/^[0-9a-fA-F]{64}$/.test(secret)) {
      setState({ kind: "invalid" });
      return;
    }

    let link: LinkMetadata;
    try {
      link = await api.getLink(linkId);
    } catch {
      setState({ kind: "invalid" });
      return;
    }

    if (link.status === "claimed") {
      setState({ kind: "unclaimable", link, reason: "This link was already claimed." });
      return;
    }
    if (link.status === "reclaimed") {
      setState({ kind: "unclaimable", link, reason: "This link was cancelled by the sender." });
      return;
    }
    if (link.status === "expired") {
      setState({ kind: "unclaimable", link, reason: "This link has expired." });
      return;
    }
    if (link.status === "created") {
      setState({ kind: "not-ready", link });
      return;
    }

    const address = await getUserAddress();
    if (!address) {
      setState({ kind: "needs-login", link });
      return;
    }

    // Self-claim: the sender opened their own share link (testing it, or a stray
    // tap). Harmless on-chain (funds would just return to them), but confusing
    // enough as a UX edge case that the spec calls it out by name.
    const myAddress = await getSmartAccountAddress();
    if (myAddress.toLowerCase() === link.sender.toLowerCase()) {
      setState({
        kind: "unclaimable",
        link,
        reason: "This is your own link. Share it with someone else to send them money.",
      });
      return;
    }

    setState({ kind: "ready", link });
  }

  useEffect(() => {
    load().catch(() => setState({ kind: "invalid" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkId]);

  function handleLogin() {
    // Full path including the #secret fragment, so AuthCallback can send the
    // recipient right back here once Google sign-in completes.
    sessionStorage.setItem("owo.returnTo", `${window.location.pathname}${window.location.hash}`);
    loginWithGoogle();
  }

  async function handleClaim() {
    if (state.kind !== "ready") return;
    const link = state.link;

    // Session may have lapsed since the page loaded (idle tab, expired Magic
    // session). Catch it here rather than letting a doomed claim attempt throw
    // a confusing error deep inside the relayer call.
    if (!(await isLoggedIn())) {
      setState({ kind: "needs-login", link });
      return;
    }

    setState({ kind: "claiming", link });
    setError(null);

    try {
      const recipient = await getSmartAccountAddress();
      await api.claim({ linkId: linkId!, recipient, secret: `0x${secret}` });
      setState({ kind: "success", link });
    } catch (err) {
      setError((err as Error).message);
      setState({ kind: "ready", link });
    }
  }

  switch (state.kind) {
    case "loading":
      return (
        <Screen>
          <div className="flex flex-1 items-center justify-center">
            <CircleNotch className="animate-spin text-zinc-300 dark:text-zinc-700" size={28} />
          </div>
        </Screen>
      );

    case "invalid":
      return (
        <Screen>
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <LinkBreak className="text-zinc-400 dark:text-zinc-500" size={40} />
            <div>
              <h1 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
                This link doesn't work
              </h1>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Check that you copied the whole message.
              </p>
            </div>
          </div>
        </Screen>
      );

    case "not-ready":
      return (
        <Screen>
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <HourglassMedium className="text-zinc-400 dark:text-zinc-500" size={40} />
            <div>
              <h1 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
                Almost there
              </h1>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                This link is still being set up. Try again in a moment.
              </p>
            </div>
          </div>
          <Button variant="secondary" onClick={() => load()}>
            Refresh
          </Button>
        </Screen>
      );

    case "needs-login":
      return (
        <Screen>
          <MoneyCard link={state.link} />
          <Button onClick={handleLogin}>Continue with Google to claim</Button>
        </Screen>
      );

    case "ready":
    case "claiming":
      return (
        <Screen>
          <MoneyCard link={state.link} />
          {error && (
            <div className="mb-4 flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
              <WarningCircle size={18} weight="bold" />
              <span>{error}</span>
            </div>
          )}
          <Button
            disabled={state.kind === "claiming"}
            loading={state.kind === "claiming"}
            onClick={handleClaim}
          >
            {state.kind === "claiming" ? "Claiming…" : "Claim"}
          </Button>
        </Screen>
      );

    case "success":
      return (
        <Screen>
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <motion.div
              initial={reduceMotion ? false : { scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 16 }}
            >
              <CheckCircle className="text-accent dark:text-accent-dark" size={64} weight="fill" />
            </motion.div>
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              <AmountDisplay value={formatUsdcAmount(BigInt(state.link.amount))} />
            </motion.div>
            <motion.p
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="text-base text-zinc-500 dark:text-zinc-400"
            >
              It's in your Owó balance now.
            </motion.p>
          </div>
          <Button onClick={() => navigate("/home")}>Go to Owó</Button>
        </Screen>
      );

    case "unclaimable":
      return (
        <Screen>
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <WarningCircle className="text-zinc-400 dark:text-zinc-500" size={40} />
            <h1 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
              {state.reason}
            </h1>
          </div>
        </Screen>
      );
  }
}
