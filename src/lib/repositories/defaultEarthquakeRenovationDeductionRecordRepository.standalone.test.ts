/**
 * フェーズ5-1-3b: `@/lib/repositories/defaultEarthquakeRenovationDeductionRecordRepository`の
 * スタンドアロン版差し替え実装
 * (`defaultEarthquakeRenovationDeductionRecordRepository.standalone.ts`)を検証する。
 *
 * ブラウザ向け(OPFSベース)の`openClientDb`実装が無いため、現時点では各メソッドが
 * 分かりやすいエラーを投げるプレースホルダーであることのみを検証する
 * (`createClientEarthquakeRenovationDeductionRecordRepository`自体の挙動は
 * `earthquakeRenovationDeductionRecordRepository.test.ts`で別途検証済み)。
 */
import { describe, expect, it } from "vitest";
import { earthquakeRenovationDeductionRecordRepository } from "./defaultEarthquakeRenovationDeductionRecordRepository.standalone";

describe("defaultEarthquakeRenovationDeductionRecordRepository (standalone)", () => {
  it("findByTaxYearIdは未結線であることを示すエラーを投げる", async () => {
    await expect(
      earthquakeRenovationDeductionRecordRepository.findByTaxYearId(1),
    ).rejects.toThrow(/未結線/);
  });

  it("upsertは未結線であることを示すエラーを投げる", async () => {
    await expect(
      earthquakeRenovationDeductionRecordRepository.upsert({
        taxYearId: 1,
        creditJpy: "150000",
      }),
    ).rejects.toThrow(/未結線/);
  });

  it("deleteByTaxYearIdは未結線であることを示すエラーを投げる", async () => {
    await expect(
      earthquakeRenovationDeductionRecordRepository.deleteByTaxYearId(1),
    ).rejects.toThrow(/未結線/);
  });
});
