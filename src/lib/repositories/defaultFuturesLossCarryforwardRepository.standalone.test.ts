/**
 * フェーズ5-3-3: `@/lib/repositories/defaultFuturesLossCarryforwardRepository`の
 * スタンドアロン版差し替え実装(`defaultFuturesLossCarryforwardRepository.standalone.ts`)が、
 * `../clientDb/standaloneClientDb.ts`経由で取得した`ClientDb`を
 * `createClientFuturesLossCarryforwardRepository`に正しく結線していることを検証する
 * (`createClientFuturesLossCarryforwardRepository`自体の挙動は
 * `futuresLossCarryforwardRepository.test.ts`で別途検証済みのため、ここでは委譲先の
 * `ClientDb`が共有・再利用されていることを中心に確認する。テスト構成は
 * `defaultForeignTaxCreditCarryforwardRepository.standalone.test.ts`(5-3-3)と同じ)。
 *
 * `../clientDb/standaloneClientDb`は内部で`new Worker(...)`
 * (`sqlite.browser.ts`)を使うため、このファイルではその下位層をモック化し、
 * Node/Vitest環境でも実行できるようにする。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ClientDb, SqlValue } from "../clientDb/sqlite";

const { openClientDbMock, applyClientDbSchemaMock, fakeDb } = vi.hoisted(() => {
  const row: Record<string, SqlValue> = {
    id: 1,
    tax_year_id: 1,
    origin_year: 2023,
    remaining_amount_jpy: "150000",
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-01T00:00:00.000Z",
  };
  const fakeDb: ClientDb = {
    run: vi.fn(async () => {}),
    all: vi.fn(async () => [row]),
    close: vi.fn(async () => {}),
  };
  return {
    openClientDbMock: vi.fn(async (): Promise<ClientDb> => fakeDb),
    applyClientDbSchemaMock: vi.fn(async () => {}),
    fakeDb,
  };
});

vi.mock("../clientDb/sqlite.browser", () => ({
  openClientDb: openClientDbMock,
}));
vi.mock("../clientDb/schema", () => ({
  applyClientDbSchema: applyClientDbSchemaMock,
}));

describe("defaultFuturesLossCarryforwardRepository (standalone)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("共有のClientDb接続を1回だけ開き、全メソッドで再利用する", async () => {
    const { futuresLossCarryforwardRepository } = await import(
      "./defaultFuturesLossCarryforwardRepository.standalone"
    );

    await futuresLossCarryforwardRepository.findByTaxYearId(1);
    await futuresLossCarryforwardRepository.upsert({
      taxYearId: 1,
      originYear: 2023,
      remainingAmountJpy: "150000",
    });
    await futuresLossCarryforwardRepository.delete(1);
    await futuresLossCarryforwardRepository.createMany([
      { taxYearId: 1, originYear: 2023, remainingAmountJpy: "150000" },
    ]);

    expect(openClientDbMock).toHaveBeenCalledTimes(1);
    expect(openClientDbMock).toHaveBeenCalledWith("kakuteishinnkoku.db");
    expect(applyClientDbSchemaMock).toHaveBeenCalledTimes(1);
    expect(applyClientDbSchemaMock).toHaveBeenCalledWith(fakeDb);
  });

  it("upsertは共有ClientDbに対してSQLを発行する", async () => {
    const { futuresLossCarryforwardRepository } = await import(
      "./defaultFuturesLossCarryforwardRepository.standalone"
    );

    await futuresLossCarryforwardRepository.upsert({
      taxYearId: 1,
      originYear: 2023,
      remainingAmountJpy: "150000",
    });

    expect(fakeDb.run).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO futures_loss_carryforward"),
      expect.arrayContaining([1, 2023, "150000"]),
    );
  });

  it("deleteは共有ClientDbに対してSQLを発行する", async () => {
    const { futuresLossCarryforwardRepository } = await import(
      "./defaultFuturesLossCarryforwardRepository.standalone"
    );

    await futuresLossCarryforwardRepository.delete(1);

    expect(fakeDb.run).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM futures_loss_carryforward"),
      [1],
    );
  });

  it("createManyは共有ClientDbに対してSQLを発行する", async () => {
    const { futuresLossCarryforwardRepository } = await import(
      "./defaultFuturesLossCarryforwardRepository.standalone"
    );

    await futuresLossCarryforwardRepository.createMany([
      { taxYearId: 1, originYear: 2023, remainingAmountJpy: "150000" },
    ]);

    expect(fakeDb.run).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO futures_loss_carryforward"),
      expect.arrayContaining([1, 2023, "150000"]),
    );
  });
});
