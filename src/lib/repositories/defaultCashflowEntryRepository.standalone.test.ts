/**
 * フェーズ5-1-3d-45: `@/lib/repositories/defaultCashflowEntryRepository`の
 * スタンドアロン版差し替え実装
 * (`defaultCashflowEntryRepository.standalone.ts`)を検証する。
 *
 * ブラウザ向け(OPFSベース)の`openClientDb`実装が無いため、現時点では各メソッドが
 * 分かりやすいエラーを投げるプレースホルダーであることのみを検証する
 * (`createClientCashflowEntryRepository`自体の挙動は
 * `cashflowEntryRepository.test.ts`で別途検証済み)。
 */
import { describe, expect, it } from "vitest";
import { cashflowEntryRepository } from "./defaultCashflowEntryRepository.standalone";

describe("defaultCashflowEntryRepository (standalone)", () => {
  it("importMoneyForwardCsvは未結線であることを示すエラーを投げる", async () => {
    await expect(
      cashflowEntryRepository.importMoneyForwardCsv({
        taxYearId: 1,
        fileName: "cashflow.csv",
        rows: [],
      }),
    ).rejects.toThrow(/未結線/);
  });
});
