import { prisma } from "@/lib/db";

/// この回数分の失敗が直近のウィンドウ内で発生したらロックアウトする
export const LOGIN_MAX_ATTEMPTS = 5;
/// 失敗回数をカウントする期間(この期間より古い失敗は数えない)
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
/// ロックアウトの継続時間(直近の失敗時刻からこの時間が経過するまで拒否する)
export const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;

export interface LoginRateLimitStatus {
  locked: boolean;
  /// ロック中の場合、解除までの残り時間(ミリ秒)。ロックされていない場合は0。
  retryAfterMs: number;
}

/**
 * 失敗試行のタイムスタンプ一覧からロック状態を判定する純粋関数。
 * ロック中にさらに失敗するとロック解除時刻も後ろにずれる(直近の失敗時刻基準)。
 */
export function evaluateLoginRateLimit(
  failedAttemptTimestamps: number[],
  now: number,
): LoginRateLimitStatus {
  const recent = failedAttemptTimestamps.filter((t) => now - t < LOGIN_WINDOW_MS);
  if (recent.length < LOGIN_MAX_ATTEMPTS) {
    return { locked: false, retryAfterMs: 0 };
  }
  const lastAttempt = Math.max(...recent);
  const unlockAt = lastAttempt + LOGIN_LOCKOUT_MS;
  if (now < unlockAt) {
    return { locked: true, retryAfterMs: unlockAt - now };
  }
  return { locked: false, retryAfterMs: 0 };
}

export async function checkLoginRateLimit(ipAddress: string): Promise<LoginRateLimitStatus> {
  const now = Date.now();
  const attempts = await prisma.loginAttempt.findMany({
    where: { ipAddress, createdAt: { gt: new Date(now - LOGIN_WINDOW_MS) } },
    select: { createdAt: true },
  });
  return evaluateLoginRateLimit(
    attempts.map((a) => a.createdAt.getTime()),
    now,
  );
}

export async function recordFailedLoginAttempt(ipAddress: string): Promise<void> {
  await prisma.loginAttempt.create({ data: { ipAddress } });
  // ロック判定に不要になった古いレコードは都度削除し、テーブルの肥大化を防ぐ。
  await prisma.loginAttempt.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - LOGIN_WINDOW_MS - LOGIN_LOCKOUT_MS) } },
  });
}

export async function clearLoginAttempts(ipAddress: string): Promise<void> {
  await prisma.loginAttempt.deleteMany({ where: { ipAddress } });
}
