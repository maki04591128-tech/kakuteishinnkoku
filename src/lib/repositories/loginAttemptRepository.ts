/**
 * フェーズ1(リポジトリパターン導入): `src/lib/auth/loginRateLimit.ts`が直接
 * `prisma.loginAttempt`を呼んでいた処理をこのインターフェース経由に置き換える。
 * 挙動は既存のPrisma実装と完全に一致させる。
 */
import { prisma } from "../db";

export interface LoginAttemptRepository {
  findRecentAttemptTimestamps(ipAddress: string, since: Date): Promise<Date[]>;
  createAttempt(ipAddress: string): Promise<void>;
  deleteOlderThan(cutoff: Date): Promise<void>;
  deleteByIpAddress(ipAddress: string): Promise<void>;
}

export function createPrismaLoginAttemptRepository(): LoginAttemptRepository {
  return {
    async findRecentAttemptTimestamps(ipAddress: string, since: Date): Promise<Date[]> {
      const attempts = await prisma.loginAttempt.findMany({
        where: { ipAddress, createdAt: { gt: since } },
        select: { createdAt: true },
      });
      return attempts.map((a) => a.createdAt);
    },

    async createAttempt(ipAddress: string): Promise<void> {
      await prisma.loginAttempt.create({ data: { ipAddress } });
    },

    async deleteOlderThan(cutoff: Date): Promise<void> {
      await prisma.loginAttempt.deleteMany({ where: { createdAt: { lt: cutoff } } });
    },

    async deleteByIpAddress(ipAddress: string): Promise<void> {
      await prisma.loginAttempt.deleteMany({ where: { ipAddress } });
    },
  };
}
