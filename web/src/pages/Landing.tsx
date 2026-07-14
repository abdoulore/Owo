import { HandCoins } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import { loginWithGoogle } from "../lib/magic";
import { Screen } from "../components/Screen";
import { Button } from "../components/Button";

export function Landing() {
  const reduceMotion = useReducedMotion();

  return (
    <Screen>
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-1 flex-col items-center justify-center gap-5 text-center"
      >
        <div className="flex size-20 items-center justify-center rounded-full bg-accent-soft">
          <HandCoins className="text-accent" size={40} weight="fill" />
        </div>
        <h1 className="text-5xl font-semibold tracking-tight text-ink">Owó</h1>
        <p className="max-w-[26ch] text-lg text-muted">
          Send money to anyone, like a message. No wallets, no fees, no jargon.
        </p>
      </motion.div>

      <Button onClick={loginWithGoogle}>Continue with Google</Button>
    </Screen>
  );
}
