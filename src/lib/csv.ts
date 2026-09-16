import * as iconv from "iconv-lite";

/**
 * 取り込みCSVファイルの文字コード変換。
 *
 * 暗号資産取引所のCSVは概ねUTF-8だが、マネーフォワードの一部エクスポートや
 * 証券会社の年間取引報告書CSV等、Shift_JIS(CP932)で出力される日本の
 * 金融系CSVは珍しくない。Shift_JISのファイルを誤ってUTF-8として読むと
 * 文字化けし、ヘッダー名が一致せず「必須カラムが見つからない」等の
 * エラーになってしまう。まずUTF-8として厳密デコードを試み、不正な
 * バイト列で失敗した場合のみShift_JISとして読み直す
 * (正しいUTF-8のテキストがShift_JISとしても偶然デコードに成功することは
 * 稀ではないが、その逆に多バイトのShift_JIS文字列が偶然UTF-8として妥当な
 * バイト列になることはほぼ無いため、この判定順序で実用上問題ない)。
 */
export async function decodeCsvFile(file: File): Promise<string> {
  return decodeCsvBuffer(await file.arrayBuffer());
}

export function decodeCsvBuffer(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return iconv.decode(Buffer.from(buffer), "Shift_JIS");
  }
}

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
