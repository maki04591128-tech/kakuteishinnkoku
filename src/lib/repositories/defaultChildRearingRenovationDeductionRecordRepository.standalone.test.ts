/**
 * フェーズ5-1-3b: `@/lib/repositories/defaultChildRearingRenovationDeductionRecordRepository`の
 * スタンドアロン版差し替え実装
 * (`defaultChildRearingRenovationDeductionRecordRepository.standalone.ts`)を検証する。
 *
 * ブラウザ向け(OPFSベース)の`openClientDb`実装が無いため、現時点では各メソッドが
 * 分かりやすいエラーを投げるプレースホルダーであることのみを検証する
 * (`createClientChildRearingRenovationDeductionRecordRepository`自体の挙動は
 * `childRearingRenovationDeductionRecordRepository.test.ts`で別途検証済み)。
 */
import { describe, expect, it } from "vitest";
import { childRearingRenovationDeductionRecordRepository } from "./defaultChildRearingRenovationDeductionRecordRepository.standalone";

describe("defaultChildRearingRenovationDeductionRecordRepository (standalone)", () => {
  it("findByTaxYearIdは未結線であることを示すエラーを投げる", async () => {
    await expect(
      childRearingRenovationDeductionRecordRepository.findByTaxYearId(1),
    ).rejects.toThrow(/未結線/);
  });

  it("upsertは未結線であることを示すエラーを投げる", async () => {
    await expect(
      childRearingRenovationDeductionRecordRepository.upsert({ taxYearId: 1, creditJpy: "150000" }),
    ).rejects.toThrow(/未結線/);
  });

  it("deleteByTaxYearIdは未結線であることを示すエラーを投げる", async () => {
    await expect(
      childRearingRenovationDeductionRecordRepository.deleteByTaxYearId(1),
    ).rejects.toThrow(/未結線/);
  });
});
