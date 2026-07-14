import { HandCoins } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import { loginWithGoogle } from "../lib/magic";
import { Screen } from "../components/Screen";
import { Button } from "../components/Button";

export function Landing() {
  const reduceMotion = useReducedMotion();

  return (
    <Screen>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_50%_38%,rgba(5,150,105,0.16),transparent_60%)] dark:bg-[radial-gradient(circle_at_50%_38%,rgba(16,185,129,0.14),transparent_60%)]"
      />

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-1 flex-col items-center justify-center gap-5 text-center"
      >
        <div className="flex size-20 items-center justify-center rounded-full bg-accent/10 dark:bg-accent-dark/10">
          <HandCoins className="text-accent dark:text-accent-dark" size={40} weight="fill" />
        </div>
        <h1 className="text-5xl font-medium tracking-tight text-zinc-900 dark:text-zinc-50">
          Owó
        </h1>
        <p className="max-w-[30ch] text-base text-zinc-500 dark:text-zinc-400">
          Send money like a message. No wallets, no gas, no jargon.
        </p>
      </motion.div>

      <Button onClick={loginWithGoogle}>Continue with Google</Button>
    </Screen>
  );
}
