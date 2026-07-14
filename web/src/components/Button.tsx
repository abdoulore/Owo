import type { ButtonHTMLAttributes } from "react";
import { CircleNotch } from "@phosphor-icons/react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  loading?: boolean;
}

const variants = {
  primary:
    "bg-accent text-white dark:bg-accent-dark dark:text-zinc-950 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-500",
  secondary:
    "bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-50 disabled:opacity-40",
  ghost: "bg-transparent text-accent dark:text-accent-dark disabled:opacity-40",
};

export function Button({
  variant = "primary",
  loading = false,
  disabled,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex h-14 w-full items-center justify-center gap-2 whitespace-nowrap px-6 text-base font-medium transition-transform active:scale-[0.98] disabled:pointer-events-none ${variants[variant]} ${className}`}
      {...rest}
    >
      {loading && <CircleNotch className="animate-spin" size={20} weight="bold" />}
      {children}
    </button>
  );
}
