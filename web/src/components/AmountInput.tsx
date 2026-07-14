interface AmountInputProps {
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
}

// Big tappable numeral entry, mono font so digits don't jitter width as the
// user types. No card, no border -- the amount itself is the whole screen.
export function AmountInput({ value, onChange, autoFocus }: AmountInputProps) {
  return (
    <div className="flex items-center justify-center gap-1 font-mono text-zinc-900 dark:text-zinc-50">
      <span className="text-4xl font-medium text-zinc-400 dark:text-zinc-600">$</span>
      <input
        type="text"
        inputMode="decimal"
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => {
          const next = e.target.value.replace(/[^\d.]/g, "");
          onChange(next);
        }}
        placeholder="0"
        className="w-full max-w-[10ch] bg-transparent text-center text-6xl font-medium outline-none placeholder:text-zinc-300 dark:placeholder:text-zinc-700"
      />
    </div>
  );
}
