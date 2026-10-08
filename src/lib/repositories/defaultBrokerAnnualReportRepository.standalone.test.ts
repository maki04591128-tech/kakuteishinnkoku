/**
 * フェーズ5-3-3: `@/lib/repositories/defaultBrokerAnnualReportRepository`の
 * スタンドアロン版差し替え実装
 * (`defaultBrokerAnnualReportRepository.standalone.ts`)が、`../clientDb/
 * standaloneClientDb.ts`経由で取得した`ClientDb`を
 * `createClientBrokerAnnualReportRepository`に正しく結線していることを
 * 検証する(`createClientBrokerAnnualReportRepository`自体の挙動は
 * `brokerAnnualReportRepository.test.ts`で別途検証済みのため、ここでは
 * 委譲先の`ClientDb`が共有・再利用されていることを中心に確認する。テスト構成は
 * `defaultTaxYearRepository.standalone.test.ts`(5-3-2)と同じ)。
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
    broker: "SBI証券",
    account_type: "SPECIFIC_WITHHOLDING",
    proceeds_jpy: "1000000",
    acquisition_cost_jpy: "800000",
    dividend_jpy: "5000",
    memo: null,
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

describe("defaultBrokerAnnualReportRepository (standalone)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("共有のClientDb接続を1回だけ開き、全メソッドで再利用する", async () => {
    const { brokerAnnualReportRepository } = await import(
      "./defaultBrokerAnnualReportRepository.standalone"
    );

    await brokerAnnualReportRepository.findByTaxYearId(1);
    await brokerAnnualReportRepository.upsert({
      taxYearId: 1,
      broker: "SBI証券",
      accountType: "SPECIFIC_WITHHOLDING",
      proceedsJpy: "1000000",
      acquisitionCostJpy: "800000",
      dividendJpy: "5000",
    });
    await brokerAnnualReportRepository.delete(1);
    await brokerAnnualReportRepository.upsertMany([
      {
        taxYearId: 1,
        broker: "SBI証券",
        accountType: "SPECIFIC_WITHHOLDING",
        proceedsJpy: "1000000",
        acquisitionCostJpy: "800000",
        dividendJpy: "5000",
      },
    ]);

    expect(openClientDbMock).toHaveBeenCalledTimes(1);
    expect(openClientDbMock).toHaveBeenCalledWith("kakuteishinnkoku.db");
    expect(applyClientDbSchemaMock).toHaveBeenCalledTimes(1);
    expect(applyClientDbSchemaMock).toHaveBeenCalledWith(fakeDb);
  });

  it("upsertは共有ClientDbに対してSQLを発行する", async () => {
    const { brokerAnnualReportRepository } = await import(
      "./defaultBrokerAnnualReportRepository.standalone"
    );

    await brokerAnnualReportRepository.upsert({
      taxYearId: 1,
      broker: "SBI証券",
      accountType: "SPECIFIC_WITHHOLDING",
      proceedsJpy: "1000000",
      acquisitionCostJpy: "800000",
      dividendJpy: "5000",
    });

    expect(fakeDb.run).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO broker_annual_report"),
      expect.arrayContaining([
        1,
        "SBI証券",
        "SPECIFIC_WITHHOLDING",
        "1000000",
        "800000",
        "5000",
      ]),
    );
  });

  it("deleteは共有ClientDbに対してSQLを発行する", async () => {
    const { brokerAnnualReportRepository } = await import(
      "./defaultBrokerAnnualReportRepository.standalone"
    );

    await brokerAnnualReportRepository.delete(1);

    expect(fakeDb.run).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM broker_annual_report"),
      [1],
    );
  });

  it("upsertManyは各入力について共有ClientDbに対してSQLを発行する", async () => {
    const { brokerAnnualReportRepository } = await import(
      "./defaultBrokerAnnualReportRepository.standalone"
    );

    await brokerAnnualReportRepository.upsertMany([
      {
        taxYearId: 1,
        broker: "SBI証券",
        accountType: "SPECIFIC_WITHHOLDING",
        proceedsJpy: "1000000",
        acquisitionCostJpy: "800000",
        dividendJpy: "5000",
      },
      {
        taxYearId: 1,
        broker: "楽天証券",
        accountType: "GENERAL",
        proceedsJpy: "2000000",
        acquisitionCostJpy: "1500000",
        dividendJpy: "0",
      },
    ]);

    expect(fakeDb.run).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO broker_annual_report"),
      expect.arrayContaining([1, "SBI証券"]),
    );
    expect(fakeDb.run).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO broker_annual_report"),
      expect.arrayContaining([1, "楽天証券"]),
    );
  });
});
