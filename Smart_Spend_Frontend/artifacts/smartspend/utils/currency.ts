const EXCHANGE_RATES: Record<string, number> = {
  INR: 1,
  USD: 0.012,
  EUR: 0.011,
  GBP: 0.0095,
  JPY: 1.77,
  AED: 0.044,
  SGD: 0.016,
  CAD: 0.016,
  AUD: 0.019,
};

export const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  AED: "د.إ",
  SGD: "S$",
  CAD: "CA$",
  AUD: "A$",
};

export function getCurrencySymbol(currency?: string): string {
  return CURRENCY_SYMBOLS[(currency || "INR").toUpperCase()] || "₹";
}

export function convertFromINR(amountInINR: number, targetCurrency?: string): number {
  const rate = EXCHANGE_RATES[(targetCurrency || "INR").toUpperCase()] ?? 1;
  return amountInINR * rate;
}

export function formatCurrency(amountInINR: number, currency?: string): string {
  const cur = (currency || "INR").toUpperCase();
  const symbol = getCurrencySymbol(cur);
  const converted = convertFromINR(amountInINR, cur);
  if (cur === "JPY") {
    return `${symbol}${Math.round(converted).toLocaleString()}`;
  }
  if (converted >= 1000) {
    return `${symbol}${converted.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  }
  return `${symbol}${converted.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
