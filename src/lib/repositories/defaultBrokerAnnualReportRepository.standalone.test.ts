/**
 * フェーズ5-1-3b: `@/lib/repositories/defaultBrokerAnnualReportRepository`の
 * スタンドアロン版差し替え実装
 * (`defaultBrokerAnnualReportRepository.standalone.ts`)を検証する。
 *
 * ブラウザ向け(OPFSベース)の`openClientDb`実装が無いため、現時点では各メソッドが
 * 分かりやすいエラーを投げるプレースホルダーであることのみを検証する
 * (`createClientBrokerAnnualReportRepository`自体の挙動は
 * `brokerAnnualReportRepository.test.ts`で別途検証済み)。
 */
import { describe, expect, it } from "vitest";
import { brokerAnnualReportRepository } from "./defaultBrokerAnnualReportRepository.standalone";

describe("defaultBrokerAnnualReportRepository (standalone)", () => {
  it("findByTaxYearIdは未結線であることを示すエラーを投げる", async () => {
    await expect(brokerAnnualReportRepository.findByTaxYearId(1)).rejects.toThrow(
      /未結線/,
    );
  });

  it("upsertは未結線であることを示すエラーを投げる", async () => {
    await expect(
      brokerAnnualReportRepository.upsert({
        taxYearId: 1,
        broker: "SBI証券",
        accountType: "SPECIFIC_WITHHOLDING",
        proceedsJpy: "1000000",
        acquisitionCostJpy: "800000",
        dividendJpy: "5000",
      }),
    ).rejects.toThrow(/未結線/);
  });

  it("deleteは未結線であることを示すエラーを投げる", async () => {
    await expect(brokerAnnualReportRepository.delete(1)).rejects.toThrow(/未結線/);
  });

  it("upsertManyは未結線であることを示すエラーを投げる", async () => {
    await expect(brokerAnnualReportRepository.upsertMany([])).rejects.toThrow(
      /未結線/,
    );
  });
});
