import { describe, expect, it } from "vitest";
import { parseCsvRows } from "./csv";

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
