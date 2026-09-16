import { describe, expect, it } from "vitest";
import {
  LOGIN_LOCKOUT_MS,
  LOGIN_MAX_ATTEMPTS,
  LOGIN_WINDOW_MS,
  evaluateLoginRateLimit,
} from "./loginRateLimit";

describe("evaluateLoginRateLimit", () => {
  const now = 1_700_000_000_000;

  it("失敗回数が上限未満ならロックしない", () => {
    const timestamps = Array.from({ length: LOGIN_MAX_ATTEMPTS - 1 }, () => now);
    expect(evaluateLoginRateLimit(timestamps, now)).toEqual({
      locked: false,
      retryAfterMs: 0,
    });
  });

  it("直近ウィンドウ内で上限回数失敗するとロックする", () => {
    const timestamps = Array.from({ length: LOGIN_MAX_ATTEMPTS }, () => now);
    const result = evaluateLoginRateLimit(timestamps, now);
    expect(result.locked).toBe(true);
    expect(result.retryAfterMs).toBe(LOGIN_LOCKOUT_MS);
  });

  it("ウィンドウ外(古い)失敗はカウントしない", () => {
    const oldTimestamps = Array.from(
      { length: LOGIN_MAX_ATTEMPTS },
      () => now - LOGIN_WINDOW_MS - 1,
    );
    expect(evaluateLoginRateLimit(oldTimestamps, now)).toEqual({
      locked: false,
      retryAfterMs: 0,
    });
  });

  it("ロックアウト期間が経過すればロック解除される", () => {
    const timestamps = Array.from({ length: LOGIN_MAX_ATTEMPTS }, () => now);
    const afterLockout = now + LOGIN_LOCKOUT_MS + 1;
    expect(evaluateLoginRateLimit(timestamps, afterLockout)).toEqual({
      locked: false,
      retryAfterMs: 0,
    });
  });

  it("ロック中にさらに失敗すると解除時刻が最新の失敗時刻基準に更新される", () => {
    const baseTimestamps = Array.from({ length: LOGIN_MAX_ATTEMPTS }, () => now);
    const laterFailureAt = now + 5 * 60 * 1000;
    const timestamps = [...baseTimestamps, laterFailureAt];
    const result = evaluateLoginRateLimit(timestamps, laterFailureAt);
    expect(result.locked).toBe(true);
    expect(result.retryAfterMs).toBe(LOGIN_LOCKOUT_MS);
  });
});
