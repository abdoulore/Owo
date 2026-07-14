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

/// Display-only Naira conversion. Hardcoded rate, no oracle: this is the authenticity
/// hook (diaspora sending home thinks in Naira), never used for on-chain math.
const NGN_PER_USD = 1600n;

export function formatNairaFromUsdc(baseUnits: bigint): string {
  const negative = baseUnits < 0n;
  const abs = negative ? -baseUnits : baseUnits;
  // baseUnits has 6 decimals; NGN = usd * rate, rounded to whole naira.
  const naira = (abs * NGN_PER_USD) / BigInt(10 ** USDC_DECIMALS);
  const grouped = Number(naira).toLocaleString("en-US");
  return negative ? `-${grouped}` : grouped;
}

/// Formats an amount in the viewer's chosen display currency. Sign prefix (+/-) is the
/// caller's job; this returns the symbol + number only.
export function formatMoney(baseUnits: bigint, naira: boolean): string {
  return naira ? `₦${formatNairaFromUsdc(baseUnits)}` : `$${formatUsdcAmount(baseUnits)}`;
}

/// Parses a human-entered Naira amount into USDC base units, at the same display-only
/// rate. All bigint, no floats: naira is taken to 2dp (kobo) then scaled down by the
/// rate. e.g. "50000" -> 31_250000 base units ($31.25 at 1600/$).
export function parseNairaToUsdc(input: string): bigint {
  const trimmed = input.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) throw new Error("Enter a valid amount");

  const [whole, fraction = ""] = trimmed.split(".");
  const nairaKobo = BigInt(whole + fraction.padEnd(2, "0").slice(0, 2)); // naira * 100
  // usdcBase = (nairaKobo / 100) / rate * 1e6 = nairaKobo * 1e6 / (100 * rate)
  const usdcBase = (nairaKobo * BigInt(10 ** USDC_DECIMALS)) / (100n * NGN_PER_USD);
  if (usdcBase <= 0n) throw new Error("Amount must be greater than zero");

  return usdcBase;
}
