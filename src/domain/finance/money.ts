/**
 * Money is stored and computed in integer minor units (cents for USD) with
 * its currency, never as floating-point dollars. These helpers are the only
 * place amounts cross between text and minor units. ADR-0010.
 */

export type Money = { minor: number; currency: string };

/** Minor-unit exponent per currency. Mirrors public.currencies. */
export const CURRENCY_EXPONENTS: Record<string, number> = { USD: 2, CAD: 2, EUR: 2, GBP: 2 };

/** Currencies enabled for new contracts. Mirrors public.currencies.enabled. */
export const ENABLED_CURRENCIES = ["USD"] as const;

function exponentOf(currency: string): number {
  const exponent = CURRENCY_EXPONENTS[currency];
  if (exponent === undefined) throw new Error(`Unsupported currency ${currency}`);
  return exponent;
}

/**
 * Parse a typed amount ("12,500", "$12,500.50", "-3000") into minor units.
 * Returns null when the text is not a valid amount for the currency. Never
 * goes through floating point: the digits are joined as a string.
 */
export function parseMoney(
  text: string,
  currency = "USD",
  { allowNegative = false }: { allowNegative?: boolean } = {},
): number | null {
  const exponent = exponentOf(currency);
  const cleaned = text.trim().replace(/[$,\s]/g, "");
  const match = /^(-)?(\d+)(?:\.(\d*))?$/.exec(cleaned);
  if (!match) return null;
  const [, sign, whole, fraction = ""] = match;
  if (sign && !allowNegative) return null;
  if (fraction.length > exponent) return null;
  const digits = `${whole}${fraction.padEnd(exponent, "0")}`.replace(/^0+(?=\d)/, "");
  const value = Number(digits);
  if (!Number.isSafeInteger(value)) return null;
  return sign ? -value : value;
}

/** Minor units as a plain decimal string for form inputs ("12500.50"). */
export function toDecimalString(minor: number, currency = "USD"): string {
  const exponent = exponentOf(currency);
  const sign = minor < 0 ? "-" : "";
  const digits = Math.abs(minor)
    .toString()
    .padStart(exponent + 1, "0");
  if (exponent === 0) return `${sign}${digits}`;
  return `${sign}${digits.slice(0, -exponent)}.${digits.slice(-exponent)}`;
}

const formatters = new Map<string, Intl.NumberFormat>();

/** Display an amount: formatMoney(1250050, "USD") → "$12,500.50". */
export function formatMoney(minor: number, currency = "USD"): string {
  const exponent = exponentOf(currency);
  let formatter = formatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: exponent,
      maximumFractionDigits: exponent,
    });
    formatters.set(currency, formatter);
  }
  // Intl formats from a decimal string exactly (no binary rounding).
  return formatter.format(toDecimalString(minor, currency) as unknown as number);
}

/** Signed display for change orders: "+$5,000.00" / "−$3,000.00". */
export function formatSignedMoney(minor: number, currency = "USD"): string {
  if (minor === 0) return formatMoney(0, currency);
  return `${minor > 0 ? "+" : "−"}${formatMoney(Math.abs(minor), currency)}`;
}
