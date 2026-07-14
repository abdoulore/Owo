import type { ButtonHTMLAttributes } from "react";
import { CircleNotch } from "@phosphor-icons/react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  loading?: boolean;
}

const variants = {
  primary: "bg-accent text-white shadow-sm shadow-accent/25 disabled:bg-sanddeep disabled:text-faint disabled:shadow-none",
  secondary: "bg-sand text-ink disabled:opacity-40",
  ghost: "bg-transparent text-accent disabled:opacity-40",
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
