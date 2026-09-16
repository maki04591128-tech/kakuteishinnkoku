import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isAuthEnabled, verifySessionToken } from "./session";

describe("isAuthEnabled", () => {
  const originalPassword = process.env.AUTH_PASSWORD;

  afterEach(() => {
    if (originalPassword === undefined) {
      delete process.env.AUTH_PASSWORD;
    } else {
      process.env.AUTH_PASSWORD = originalPassword;
    }
  });

  it("AUTH_PASSWORDが設定されていればtrue", () => {
    process.env.AUTH_PASSWORD = "secret";
    expect(isAuthEnabled()).toBe(true);
  });

  it("AUTH_PASSWORDが未設定ならfalse", () => {
    delete process.env.AUTH_PASSWORD;
    expect(isAuthEnabled()).toBe(false);
  });
});

describe("verifySessionToken", () => {
  const originalSecret = process.env.SESSION_SECRET;

  beforeEach(() => {
    process.env.SESSION_SECRET = "test-session-secret";
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.SESSION_SECRET;
    } else {
      process.env.SESSION_SECRET = originalSecret;
    }
  });

  it("トークンが無い場合はfalse", async () => {
    expect(await verifySessionToken(undefined)).toBe(false);
  });

  it("不正なトークンの場合はfalse", async () => {
    expect(await verifySessionToken("not-a-valid-jwt")).toBe(false);
  });

  it("別の鍵で署名されたトークンはfalse", async () => {
    const { SignJWT } = await import("jose");
    const wrongKeyToken = await new SignJWT({ authenticated: true })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode("a-different-secret-key"));
    expect(await verifySessionToken(wrongKeyToken)).toBe(false);
  });

  it("期限切れのトークンはfalse", async () => {
    const { SignJWT } = await import("jose");
    const expiredToken = await new SignJWT({ authenticated: true })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 8)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60 * 60 * 24)
      .sign(new TextEncoder().encode(process.env.SESSION_SECRET!));
    expect(await verifySessionToken(expiredToken)).toBe(false);
  });

  it("正しい鍵で署名された有効なトークンはtrue", async () => {
    const { SignJWT } = await import("jose");
    const validToken = await new SignJWT({ authenticated: true })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode(process.env.SESSION_SECRET!));
    expect(await verifySessionToken(validToken)).toBe(true);
  });
});
