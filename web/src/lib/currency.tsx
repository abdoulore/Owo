import { createContext, useContext, useState, type ReactNode } from "react";

// App-wide display-currency preference ($ vs ₦), persisted so it survives reloads and
// stays consistent across every screen (toggling on Home also flips Activity, etc.).
// This is the viewing preference only; the Send screen's own toggle is a separate,
// per-payment choice of how you enter the amount.
const KEY = "owo.currency";

interface CurrencyCtx {
  naira: boolean;
  setNaira: (v: boolean) => void;
}

const CurrencyContext = createContext<CurrencyCtx | null>(null);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [naira, setNairaState] = useState(() => localStorage.getItem(KEY) === "ngn");

  const setNaira = (v: boolean) => {
    setNairaState(v);
    localStorage.setItem(KEY, v ? "ngn" : "usd");
  };

  return <CurrencyContext.Provider value={{ naira, setNaira }}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyCtx {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
}
