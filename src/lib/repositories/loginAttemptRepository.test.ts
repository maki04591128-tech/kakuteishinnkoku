/**
 * フェーズ2-2: `createClientLoginAttemptRepository`(wa-sqlite実装)が
 * `LoginAttemptRepository`インターフェースを、Prisma実装
 * (`createPrismaLoginAttemptRepository`)と同じ挙動で満たすことを検証する。
 */
import { afterEach, describe, expect, it } from "vitest";
import { applyClientDbSchema } from "../clientDb/schema";
import { openClientDb, type ClientDb } from "../clientDb/sqlite";
import { createClientLoginAttemptRepository } from "./loginAttemptRepository";

describe("createClientLoginAttemptRepository", () => {
  const openDbs: ClientDb[] = [];

  async function setup(name: string) {
    const db = await openClientDb(name);
    openDbs.push(db);
    await applyClientDbSchema(db);
    return createClientLoginAttemptRepository(db);
  }

  afterEach(async () => {
    while (openDbs.length > 0) {
      await openDbs.pop()?.close();
    }
  });

  it("createAttemptで登録した試行がfindRecentAttemptTimestampsで取得できる", async () => {
    const repo = await setup("test-create.db");
    const before = new Date(Date.now() - 1000);
    await repo.createAttempt("192.0.2.1");
    const timestamps = await repo.findRecentAttemptTimestamps("192.0.2.1", before);
    expect(timestamps).toHaveLength(1);
    expect(timestamps[0]).toBeInstanceOf(Date);
  });

  it("findRecentAttemptTimestampsはsince以前の試行を含まない", async () => {
    const repo = await setup("test-since.db");
    await repo.createAttempt("192.0.2.1");
    const after = new Date(Date.now() + 1000);
    expect(await repo.findRecentAttemptTimestamps("192.0.2.1", after)).toEqual([]);
  });

  it("findRecentAttemptTimestampsは別IPアドレスの試行を含まない", async () => {
    const repo = await setup("test-ip.db");
    const before = new Date(Date.now() - 1000);
    await repo.createAttempt("192.0.2.1");
    expect(await repo.findRecentAttemptTimestamps("192.0.2.2", before)).toEqual([]);
  });

  it("deleteOlderThanでcutoffより古い試行のみ削除される", async () => {
    const repo = await setup("test-delete-old.db");
    const past = new Date(Date.now() - 1000);
    await repo.createAttempt("192.0.2.1");
    const cutoff = new Date(Date.now() + 1000);
    await repo.deleteOlderThan(cutoff);
    expect(await repo.findRecentAttemptTimestamps("192.0.2.1", past)).toEqual([]);
  });

  it("deleteOlderThanはcutoff以降の試行を削除しない", async () => {
    const repo = await setup("test-delete-keep.db");
    const past = new Date(Date.now() - 1000);
    await repo.createAttempt("192.0.2.1");
    const cutoff = new Date(Date.now() - 2000);
    await repo.deleteOlderThan(cutoff);
    expect(await repo.findRecentAttemptTimestamps("192.0.2.1", past)).toHaveLength(1);
  });

  it("deleteByIpAddressで指定IPアドレスの試行のみ削除される", async () => {
    const repo = await setup("test-delete-ip.db");
    const past = new Date(Date.now() - 1000);
    await repo.createAttempt("192.0.2.1");
    await repo.createAttempt("192.0.2.2");
    await repo.deleteByIpAddress("192.0.2.1");
    expect(await repo.findRecentAttemptTimestamps("192.0.2.1", past)).toEqual([]);
    expect(await repo.findRecentAttemptTimestamps("192.0.2.2", past)).toHaveLength(1);
  });
});
