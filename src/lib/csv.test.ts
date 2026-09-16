import * as iconv from "iconv-lite";
import { describe, expect, it } from "vitest";
import { decodeCsvBuffer, parseCsvRows } from "./csv";

describe("parseCsvRows", () => {
  it("単純なカンマ区切り行を分解する", () => {
    expect(parseCsvRows("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("ダブルクォート内のカンマを1つのフィールドとして扱う", () => {
    expect(parseCsvRows('a,"b,c",d')).toEqual([["a", "b,c", "d"]]);
  });

  it('エスケープされたダブルクォート("")を1つの"に変換する', () => {
    expect(parseCsvRows('a,"say ""hi""",c')).toEqual([['a', 'say "hi"', "c"]]);
  });

  it("先頭のBOMを除去する", () => {
    expect(parseCsvRows("﻿a,b")).toEqual([["a", "b"]]);
  });

  it("末尾に改行が無くても最終行を取得する", () => {
    expect(parseCsvRows("a,b\nc,d")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("空行を無視する", () => {
    expect(parseCsvRows("a,b\n\nc,d\n")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });
});

describe("decodeCsvBuffer", () => {
  it("UTF-8のバイト列をそのままデコードする", () => {
    const text = "日付,銘柄\n2026/01/01,BTC";
    const buffer = new TextEncoder().encode(text).buffer;
    expect(decodeCsvBuffer(buffer)).toBe(text);
  });

  it("Shift_JIS(CP932)のバイト列を検出してデコードする", () => {
    const text = "日付,銘柄,数量\n2026/01/01,ビットコイン,1.5";
    const sjisBuffer = iconv.encode(text, "Shift_JIS");
    const arrayBuffer = new Uint8Array(sjisBuffer).buffer;
    expect(decodeCsvBuffer(arrayBuffer)).toBe(text);
  });

  it("UTF-8のBOM付きファイルもデコードできる(BOMはTextDecoderにより除去される)", () => {
    const text = "日付,銘柄\n2026/01/01,BTC";
    const withBom = "﻿" + text;
    const buffer = new TextEncoder().encode(withBom).buffer;
    expect(decodeCsvBuffer(buffer)).toBe(text);
  });
});
