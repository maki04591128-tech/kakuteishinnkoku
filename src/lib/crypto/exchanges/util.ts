import { Decimal } from "decimal.js";

/**
 * "YYYY/MM/DD HH:MM:SS" "YYYY-MM-DD HH:MM:SS" "YYYY-MM-DDTHH:MM:SS..." 等、
 * 取引所CSVでよく使われる日時表記を受け付ける。タイムゾーン表記が無い場合は
 * ローカルタイム(=JST運用を想定)として解釈する。
 */
export function parseExchangeDateTime(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const match = trimmed.match(
    /^(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})[T ](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/,
  );
  if (match) {
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

  // ISO形式(Zやオフセット付き)はそのままDateへ委ねる
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** カンマ区切りの数値表記("1,234.5"等)を許容してDecimalへ変換する。解釈できなければnull。 */
export function parseDecimalField(value: string | undefined): Decimal | null {
  if (value === undefined) return null;
  const normalized = value.replace(/,/g, "").trim();
  if (normalized === "" || !/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  return new Decimal(normalized);
}
