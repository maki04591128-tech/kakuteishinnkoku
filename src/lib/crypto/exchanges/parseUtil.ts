import { Decimal } from "decimal.js";

/** "YYYY/MM/DD HH:mm:ss" や "YYYY-MM-DDTHH:mm:ss" など取引所CSVでよく使われる日時表記を解釈する */
export function parseExchangeDateTime(value: string): Date | null {
  const trimmed = value.trim();
  const match = trimmed.match(
    /^(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/,
  );
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match;
  const date = new Date(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    s ? Number(s) : 0,
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseExchangeDecimal(value: string | undefined): Decimal | null {
  if (value === undefined) return null;
  const normalized = value.replace(/,/g, "").trim();
  if (normalized === "") return null;
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  return new Decimal(normalized);
}
