/**
 * フェーズ5-1-3b: `@/lib/repositories/defaultMultiHouseholdRenovationDeductionRecordRepository`の
 * スタンドアロン版差し替え実装
 * (`defaultMultiHouseholdRenovationDeductionRecordRepository.standalone.ts`)を検証する。
 *
 * ブラウザ向け(OPFSベース)の`openClientDb`実装が無いため、現時点では各メソッドが
 * 分かりやすいエラーを投げるプレースホルダーであることのみを検証する
 * (`createClientMultiHouseholdRenovationDeductionRecordRepository`自体の挙動は
 * `multiHouseholdRenovationDeductionRecordRepository.test.ts`で別途検証済み)。
 */
import { describe, expect, it } from "vitest";
import { multiHouseholdRenovationDeductionRecordRepository } from "./defaultMultiHouseholdRenovationDeductionRecordRepository.standalone";

describe("defaultMultiHouseholdRenovationDeductionRecordRepository (standalone)", () => {
  it("findByTaxYearIdは未結線であることを示すエラーを投げる", async () => {
    await expect(
      multiHouseholdRenovationDeductionRecordRepository.findByTaxYearId(1),
    ).rejects.toThrow(/未結線/);
  });

  it("upsertは未結線であることを示すエラーを投げる", async () => {
    await expect(
      multiHouseholdRenovationDeductionRecordRepository.upsert({
        taxYearId: 1,
        creditJpy: "150000",
      }),
    ).rejects.toThrow(/未結線/);
  });

  it("deleteByTaxYearIdは未結線であることを示すエラーを投げる", async () => {
    await expect(
      multiHouseholdRenovationDeductionRecordRepository.deleteByTaxYearId(1),
    ).rejects.toThrow(/未結線/);
  });
});
