// Deterministic number formatting.
//
// Intl currency output differs between ICU builds (Node renders
// "250 Lekë", Chromium "ALL 250"), which breaks hydration of client
// components. So money and quantities are formatted by hand, identically on
// server and client. Units and statuses are translated via messages.

type LocaleFormat = { group: string; decimal: string };

const LOCALE_FORMATS: Record<string, LocaleFormat> = {
  sq: { group: " ", decimal: "," },
  en: { group: ",", decimal: "." },
};

/** Minor units per currency (ISO 4217); ALL has none in practice. */
const CURRENCY_DECIMALS: Record<string, number> = { ALL: 0 };

/** Currency label per locale; falls back to the ISO code. */
const CURRENCY_LABELS: Record<string, Partial<Record<string, string>>> = {
  ALL: { sq: "Lekë", en: "ALL" },
  EUR: { sq: "€", en: "€" },
};

function localeFormat(locale: string): LocaleFormat {
  return LOCALE_FORMATS[locale.split("-")[0]] ?? LOCALE_FORMATS.en;
}

function formatNumber(
  value: number,
  minDecimals: number,
  maxDecimals: number,
  locale: string,
): string {
  const { group, decimal } = localeFormat(locale);
  const negative = value < 0;
  const fixed = Math.abs(value).toFixed(maxDecimals);
  let [integer, fraction = ""] = fixed.split(".");
  fraction = fraction.replace(/0+$/, "").padEnd(minDecimals, "0");
  integer = integer.replace(/\B(?=(\d{3})+(?!\d))/g, group);
  return `${negative ? "-" : ""}${integer}${fraction ? decimal + fraction : ""}`;
}

/** "146 500 Lekë" (sq) / "146,500 ALL" (en). */
export function formatMoney(
  amount: number,
  currency: string,
  locale: string,
): string {
  const decimals = CURRENCY_DECIMALS[currency] ?? 2;
  const lang = locale.split("-")[0];
  const label = CURRENCY_LABELS[currency]?.[lang] ?? currency;
  return `${formatNumber(amount, decimals, decimals, locale)} ${label}`;
}

/** "2,5" (sq) / "2.5" (en), at most 3 decimals. */
export function formatQuantity(quantity: number, locale: string): string {
  return formatNumber(quantity, 0, 3, locale);
}
