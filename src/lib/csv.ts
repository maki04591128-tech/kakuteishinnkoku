<<<<<<< HEAD
<<<<<<<< HEAD:src/lib/csv.ts
=======
>>>>>>> origin/claude/wonderful-edison-xzm3zs
/**
 * RFC4180に近い簡易CSVパーサー。
 * ダブルクォートで囲まれたフィールド内のカンマ・改行・エスケープされた
 * ダブルクォート("")に対応する。マネーフォワード MEや各暗号資産取引所の
 * CSVエクスポートは基本的にこの形式に従う。
 */
export function parseCsvRows(text: string): string[][] {
  // BOM除去 + 改行コード統一
  const normalized = text.replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];

    if (inQuotes) {
      if (char === '"') {
        if (normalized[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  // 末尾に改行が無い最終行を回収
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}
<<<<<<< HEAD
========
// マネーフォワード MEのCSVも共通の簡易CSVパーサーを使う。
// 実装は src/lib/csv.ts に集約し、既存の import 元(./csv)を壊さないよう再エクスポートする。
export { parseCsvRows } from "../csv";
>>>>>>>> origin/claude/wonderful-edison-xzm3zs:src/lib/moneyforward/csv.ts
=======

/**
 * カンマ区切り・全角数字混じりの金額文字列をDecimal互換の文字列に正規化する。
 * 解釈できない場合はnullを返す。
 */
export function normalizeNumericString(value: string | undefined): string | null {
  if (value === undefined) return null;
  const trimmed = value.replace(/,/g, "").trim();
  if (trimmed === "") return null;
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return null;
  return trimmed;
}

/**
 * "2024/01/15 12:34:56" "2024-01-15T12:34:56" "2024-01-15" などの
 * 表記ゆれを吸収する日時パーサー。解釈できない場合はnullを返す。
 */
export function parseFlexibleDateTime(value: string | undefined): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  const match = trimmed.match(
    /^(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})(?:[T ](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/,
  );
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match;
  const date = new Date(
    Number(y),
    Number(mo) - 1,
    Number(d),
    h ? Number(h) : 0,
    mi ? Number(mi) : 0,
    s ? Number(s) : 0,
  );
  if (Number.isNaN(date.getTime())) return null;
  return date;
}
>>>>>>> origin/claude/wonderful-edison-xzm3zs
