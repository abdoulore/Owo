export function AmountDisplay({ value, size = "lg" }: { value: string; size?: "lg" | "md" }) {
  return (
    <span
      className={`font-mono font-medium text-zinc-900 dark:text-zinc-50 ${
        size === "lg" ? "text-5xl" : "text-2xl"
      }`}
    >
      ${value}
    </span>
  );
}
