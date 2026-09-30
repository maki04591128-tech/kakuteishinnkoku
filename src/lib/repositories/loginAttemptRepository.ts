/**
 * フェーズ1(リポジトリパターン導入): `src/lib/auth/loginRateLimit.ts`が直接
 * `prisma.loginAttempt`を呼んでいた処理をこのインターフェース経由に置き換える。
 * 挙動は既存のPrisma実装と完全に一致させる。自宅サーバー版は
 * `createPrismaLoginAttemptRepository`を使い続け、スタンドアロン(Android)版は
 * フェーズ2で追加した`createClientLoginAttemptRepository`(wa-sqlite実装)を使う。
 */
import { prisma } from "../db";
import type { ClientDb } from "../clientDb/sqlite";

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

/**
 * スタンドアロン(Android)版向けのクライアントサイド実装(フェーズ2-2)。
 * `db`は呼び出し側で`applyClientDbSchema`済みの`ClientDb`を渡すこと。
 */
export function createClientLoginAttemptRepository(db: ClientDb): LoginAttemptRepository {
  return {
    async findRecentAttemptTimestamps(ipAddress: string, since: Date): Promise<Date[]> {
      const rows = await db.all(
        `SELECT created_at FROM login_attempt WHERE ip_address = ? AND created_at > ?`,
        [ipAddress, since.toISOString()],
      );
      return rows.map((row) => new Date(String(row.created_at)));
    },

    async createAttempt(ipAddress: string): Promise<void> {
      await db.run(`INSERT INTO login_attempt (ip_address, created_at) VALUES (?, ?)`, [
        ipAddress,
        new Date().toISOString(),
      ]);
    },

    async deleteOlderThan(cutoff: Date): Promise<void> {
      await db.run(`DELETE FROM login_attempt WHERE created_at < ?`, [cutoff.toISOString()]);
    },

    async deleteByIpAddress(ipAddress: string): Promise<void> {
      await db.run(`DELETE FROM login_attempt WHERE ip_address = ?`, [ipAddress]);
    },
  };
}
