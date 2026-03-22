import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── Active format config ───────────────────────────────────────────────────────
// These are updated by SettingsContext when the user's preferences load.
// All callers of formatCurrency / formatDate automatically pick up the new values
// on their next render without requiring individual prop threading.

let _activeCurrency: string = "USD";
let _activeDateFormat: string = "MM/DD/YYYY";

export function setActiveCurrency(currency: string) {
  _activeCurrency = currency;
}

export function setActiveDateFormat(format: string) {
  _activeDateFormat = format;
}

export function getActiveCurrency(): string {
  return _activeCurrency;
}

export function getActiveDateFormat(): string {
  return _activeDateFormat;
}

// ── Currency formatting ────────────────────────────────────────────────────────

const CURRENCY_LOCALES: Record<string, string> = {
  USD: "en-US",
  GBP: "en-GB",
  EUR: "de-DE",
  CAD: "en-CA",
};

export function formatCurrency(amount: number, currency?: string): string {
  const cur = currency ?? _activeCurrency;
  const locale = CURRENCY_LOCALES[cur] ?? "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: cur,
  }).format(amount);
}

// ── Date formatting ────────────────────────────────────────────────────────────

export function formatDate(date: string | Date, format?: string): string {
  const fmt = format ?? _activeDateFormat;
  const d = typeof date === "string" ? new Date(date + "T00:00:00") : date;
  if (isNaN(d.getTime())) return String(date);

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = String(d.getFullYear());

  switch (fmt) {
    case "DD/MM/YYYY":
      return `${day}/${month}/${year}`;
    case "YYYY-MM-DD":
      return `${year}-${month}-${day}`;
    case "MM/DD/YYYY":
    default:
      return `${month}/${day}/${year}`;
  }
}
