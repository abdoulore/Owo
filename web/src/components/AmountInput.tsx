interface AmountInputProps {
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  symbol?: string;
}

// Big amount entry. The input auto-sizes to its content (width in ch), so the symbol
// and the number stay locked together and grow outward from the center, instead of
// the number floating in a fixed-width box. tabular-nums keeps digit widths steady
// while typing; it uses the sans display face (no slashed zero) not the mono face.
export function AmountInput({ value, onChange, autoFocus, symbol = "$" }: AmountInputProps) {
  const shown = value.length > 0 ? value : "0";
  return (
    <div className="flex items-center justify-center tabular-nums text-ink">
      <span className="text-5xl font-medium text-faint">{symbol}</span>
      <input
        type="text"
        inputMode="decimal"
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ""))}
        placeholder="0"
        style={{ width: `${shown.length}ch` }}
        className="bg-transparent text-6xl font-medium outline-none placeholder:text-faint"
      />
    </div>
  );
}
