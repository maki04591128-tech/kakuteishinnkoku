/**
 * フェーズ5-3-3: `@/lib/repositories/defaultCashflowEntryRepository`の
 * スタンドアロン版差し替え実装
 * (`defaultCashflowEntryRepository.standalone.ts`)が、`../clientDb/
 * standaloneClientDb.ts`経由で取得した`ClientDb`を
 * `createClientCashflowEntryRepository`に正しく結線していることを
 * 検証する(`createClientCashflowEntryRepository`自体の挙動は
 * `cashflowEntryRepository.test.ts`で別途検証済みのため、ここでは
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
  const all = vi.fn(async (sql: string): Promise<Record<string, SqlValue>[]> => {
    if (sql.includes("last_insert_rowid")) {
      return [{ id: 1 }];
    }
    return [];
  });
  const fakeDb: ClientDb = {
    run: vi.fn(async () => {}),
    all,
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

describe("defaultCashflowEntryRepository (standalone)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("共有のClientDb接続を1回だけ開き、全メソッドで再利用する", async () => {
    const { cashflowEntryRepository } = await import(
      "./defaultCashflowEntryRepository.standalone"
    );

    await cashflowEntryRepository.importMoneyForwardCsv({
      taxYearId: 1,
      fileName: "cashflow.csv",
      rows: [
        {
          date: new Date("2025-01-01T00:00:00.000Z"),
          content: "給与",
          amountJpy: "300000",
          direction: "INCOME",
          largeCategory: "収入",
          middleCategory: "給与",
          institution: "三菱UFJ銀行",
          memo: null,
          isCalculationTarget: true,
        },
      ],
    });
    await cashflowEntryRepository.importMoneyForwardCsv({
      taxYearId: 1,
      fileName: "cashflow2.csv",
      rows: [],
    });

    expect(openClientDbMock).toHaveBeenCalledTimes(1);
    expect(openClientDbMock).toHaveBeenCalledWith("kakuteishinnkoku.db");
    expect(applyClientDbSchemaMock).toHaveBeenCalledTimes(1);
    expect(applyClientDbSchemaMock).toHaveBeenCalledWith(fakeDb);
  });

  it("importMoneyForwardCsvは共有ClientDbに対してSQLを発行する", async () => {
    const { cashflowEntryRepository } = await import(
      "./defaultCashflowEntryRepository.standalone"
    );

    await cashflowEntryRepository.importMoneyForwardCsv({
      taxYearId: 1,
      fileName: "cashflow.csv",
      rows: [
        {
          date: new Date("2025-01-01T00:00:00.000Z"),
          content: "給与",
          amountJpy: "300000",
          direction: "INCOME",
          largeCategory: "収入",
          middleCategory: "給与",
          institution: "三菱UFJ銀行",
          memo: null,
          isCalculationTarget: true,
        },
      ],
    });

    expect(fakeDb.run).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO import_batch"),
      expect.arrayContaining([1, "moneyforward_cashflow", "cashflow.csv"]),
    );
    expect(fakeDb.run).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO cashflow_entry"),
      expect.arrayContaining(["給与", "300000", "INCOME", "三菱UFJ銀行"]),
    );
  });
});
