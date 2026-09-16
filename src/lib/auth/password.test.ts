import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { verifyPassword } from "./password";

describe("verifyPassword", () => {
  const originalPassword = process.env.AUTH_PASSWORD;

  beforeEach(() => {
    process.env.AUTH_PASSWORD = "correct-horse-battery-staple";
  });

  afterEach(() => {
    if (originalPassword === undefined) {
      delete process.env.AUTH_PASSWORD;
    } else {
      process.env.AUTH_PASSWORD = originalPassword;
    }
  });

  it("正しいパスワードならtrueを返す", () => {
    expect(verifyPassword("correct-horse-battery-staple")).toBe(true);
  });

  it("誤ったパスワードならfalseを返す", () => {
    expect(verifyPassword("wrong-password")).toBe(false);
  });

  it("長さが異なるパスワードでもfalseを返す(例外を投げない)", () => {
    expect(verifyPassword("short")).toBe(false);
    expect(verifyPassword("")).toBe(false);
    expect(verifyPassword("a".repeat(200))).toBe(false);
  });

  it("AUTH_PASSWORD未設定の場合は常にfalseを返す", () => {
    delete process.env.AUTH_PASSWORD;
    expect(verifyPassword("correct-horse-battery-staple")).toBe(false);
  });
});
