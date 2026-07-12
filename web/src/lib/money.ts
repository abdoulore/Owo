const USDC_DECIMALS = 6;

/// Parses a human-entered dollar string ("25", "25.5") into USDC base units as a
/// bigint. String-based, not parseFloat — floats can't represent money exactly.
export function parseUsdcAmount(input: string): bigint {
  const trimmed = input.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) throw new Error("Enter a valid amount");

  const [whole, fraction = ""] = trimmed.split(".");
  if (fraction.length > USDC_DECIMALS) throw new Error("Too many decimal places");

  const paddedFraction = fraction.padEnd(USDC_DECIMALS, "0");
  const base = BigInt(whole + paddedFraction);
  if (base <= 0n) throw new Error("Amount must be greater than zero");

  return base;
}

/// Formats USDC base units back to a display string with up to 6 decimals, e.g.
/// 25000000n -> "25", 25500000n -> "25.5". Display-edge only — never used for math.
export function formatUsdcAmount(baseUnits: bigint): string {
  const negative = baseUnits < 0n;
  const abs = negative ? -baseUnits : baseUnits;

  const digits = abs.toString().padStart(USDC_DECIMALS + 1, "0");
  const whole = digits.slice(0, -USDC_DECIMALS);
  const fraction = digits.slice(-USDC_DECIMALS).replace(/0+$/, "");

  const formatted = fraction ? `${whole}.${fraction}` : whole;
  return negative ? `-${formatted}` : formatted;
}
