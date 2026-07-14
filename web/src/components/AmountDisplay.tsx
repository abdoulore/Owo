export function AmountDisplay({ value, size = "lg" }: { value: string; size?: "lg" | "md" }) {
  return (
    <span
      className={`tabular-nums font-medium text-ink ${
        size === "lg" ? "text-6xl" : "text-2xl"
      }`}
    >
      ${value}
    </span>
  );
}
