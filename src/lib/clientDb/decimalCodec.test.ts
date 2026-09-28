import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import {
  decodeDecimal,
  decodeNullableDecimal,
  encodeDecimal,
  encodeNullableDecimal,
} from "./decimalCodec";

describe("decimalCodec(フェーズ0-3: クライアントDBのDecimal型変換)", () => {
  it("高精度な値でも往復して完全に一致する(Prisma+SQLiteのREAL格納では失われる精度)", () => {
    const original = new Decimal("0.123456789012345678");
    const encoded = encodeDecimal(original);
    expect(decodeDecimal(encoded).equals(original)).toBe(true);
  });

  it("指数表記を使わずTEXT格納向けの文字列になる", () => {
    expect(encodeDecimal(new Decimal("0.0000001"))).toBe("0.0000001");
    expect(encodeDecimal(new Decimal("12345678.123456789"))).toBe(
      "12345678.123456789",
    );
  });

  it("整数値・0もそのまま往復する", () => {
    expect(decodeDecimal(encodeDecimal(new Decimal(0))).equals(0)).toBe(true);
    expect(decodeDecimal(encodeDecimal(new Decimal(100))).equals(100)).toBe(
      true,
    );
  });

  it("null許容版はnullをそのまま通す", () => {
    expect(encodeNullableDecimal(null)).toBeNull();
    expect(decodeNullableDecimal(null)).toBeNull();
  });

  it("null許容版は非null値では通常版と同じ結果になる", () => {
    const value = new Decimal("42.5");
    expect(encodeNullableDecimal(value)).toBe(encodeDecimal(value));
    expect(decodeNullableDecimal("42.5")?.equals(value)).toBe(true);
  });
});
