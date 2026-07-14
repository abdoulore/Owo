import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CreditCard, WarningCircle } from "@phosphor-icons/react";
import { api } from "../lib/api";
import { isLoggedIn } from "../lib/magic";
import { getSmartAccountAddress } from "../lib/zerodev";
import { Button } from "./Button";

// The backend faucet mints this much; kept in sync so the button never promises
// an amount the top-up doesn't deliver.
const TOPUP_USD = 100;

interface AddMoneySheetProps {
  open: boolean;
  onClose: () => void;
  onAdded: () => Promise<void> | void;
  onSessionExpired: () => void;
}

// The first-fund moment. Reads as a payment-app "add cash" sheet, not a testnet
// faucet: no crypto vocabulary anywhere. The mock card is the honesty signal (a
// demo funding source, in payment-app language) standing in for a real card or
// on-ramp in production.
export function AddMoneySheet({ open, onClose, onAdded, onSessionExpired }: AddMoneySheetProps) {
  const reduceMotion = useReducedMotion();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    setError(null);

    if (!(await isLoggedIn())) {
      onClose();
      onSessionExpired();
      return;
    }

    setAdding(true);
    try {
      const address = await getSmartAccountAddress();
      await api.faucet(address);
      await onAdded();
      onClose();
    } catch {
      setError("Couldn't add money right now. Try again.");
    } finally {
      setAdding(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-20 flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className="absolute inset-0 bg-black/40" onClick={adding ? undefined : onClose} />

          <motion.div
            className="relative w-full max-w-md rounded-t-[2rem] bg-zinc-50 px-5 pb-8 pt-3 dark:bg-zinc-950"
            initial={reduceMotion ? false : { y: "100%" }}
            animate={{ y: 0 }}
            exit={reduceMotion ? undefined : { y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
          >
            <div className="mx-auto mb-6 h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-700" />

            <h2 className="text-center text-lg font-medium text-zinc-900 dark:text-zinc-50">
              Add money
            </h2>

            <div className="my-6 text-center font-mono text-5xl font-medium text-zinc-900 dark:text-zinc-50">
              ${TOPUP_USD}
            </div>

            <div className="mb-6 flex items-center gap-3 rounded-[1.25rem] bg-zinc-100 px-4 py-3 dark:bg-zinc-900">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-800">
                <CreditCard className="text-zinc-500 dark:text-zinc-400" size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">Demo card</p>
                <p className="font-mono text-xs text-zinc-400 dark:text-zinc-500">•••• 4242</p>
              </div>
              <span className="shrink-0 rounded-full bg-zinc-200 px-2 py-0.5 text-[11px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                Demo
              </span>
            </div>

            {error && (
              <div className="mb-4 flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                <WarningCircle size={18} weight="bold" />
                <span>{error}</span>
              </div>
            )}

            <Button loading={adding} onClick={handleAdd}>
              {adding ? "Adding…" : `Add $${TOPUP_USD}`}
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
