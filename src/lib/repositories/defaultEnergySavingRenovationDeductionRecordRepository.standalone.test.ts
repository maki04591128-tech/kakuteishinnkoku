/**
 * フェーズ5-1-3b: `@/lib/repositories/defaultEnergySavingRenovationDeductionRecordRepository`の
 * スタンドアロン版差し替え実装
 * (`defaultEnergySavingRenovationDeductionRecordRepository.standalone.ts`)を検証する。
 *
 * ブラウザ向け(OPFSベース)の`openClientDb`実装が無いため、現時点では各メソッドが
 * 分かりやすいエラーを投げるプレースホルダーであることのみを検証する
 * (`createClientEnergySavingRenovationDeductionRecordRepository`自体の挙動は
 * `energySavingRenovationDeductionRecordRepository.test.ts`で別途検証済み)。
 */
import { describe, expect, it } from "vitest";
import { energySavingRenovationDeductionRecordRepository } from "./defaultEnergySavingRenovationDeductionRecordRepository.standalone";

describe("defaultEnergySavingRenovationDeductionRecordRepository (standalone)", () => {
  it("findByTaxYearIdは未結線であることを示すエラーを投げる", async () => {
    await expect(
      energySavingRenovationDeductionRecordRepository.findByTaxYearId(1),
    ).rejects.toThrow(/未結線/);
  });

  it("upsertは未結線であることを示すエラーを投げる", async () => {
    await expect(
      energySavingRenovationDeductionRecordRepository.upsert({
        taxYearId: 1,
        creditJpy: "150000",
      }),
    ).rejects.toThrow(/未結線/);
  });

  it("deleteByTaxYearIdは未結線であることを示すエラーを投げる", async () => {
    await expect(
      energySavingRenovationDeductionRecordRepository.deleteByTaxYearId(1),
    ).rejects.toThrow(/未結線/);
  });
});
