/**
 * フェーズ5-1-3b: `@/lib/repositories/defaultEmploymentIncomeRecordRepository`の
 * スタンドアロン版差し替え実装(`defaultEmploymentIncomeRecordRepository.standalone.ts`)
 * を検証する。
 *
 * ブラウザ向け(OPFSベース)の`openClientDb`実装が無いため、現時点では各メソッドが
 * 分かりやすいエラーを投げるプレースホルダーであることのみを検証する
 * (`createClientEmploymentIncomeRecordRepository`自体の挙動は
 * `employmentIncomeRecordRepository.test.ts`で別途検証済み)。
 */
import { describe, expect, it } from "vitest";
import { employmentIncomeRecordRepository } from "./defaultEmploymentIncomeRecordRepository.standalone";

describe("defaultEmploymentIncomeRecordRepository (standalone)", () => {
  it("findByTaxYearIdは未結線であることを示すエラーを投げる", async () => {
    await expect(employmentIncomeRecordRepository.findByTaxYearId(1)).rejects.toThrow(
      /未結線/,
    );
  });

  it("upsertは未結線であることを示すエラーを投げる", async () => {
    await expect(
      employmentIncomeRecordRepository.upsert({ taxYearId: 1, grossSalaryJpy: "5000000" }),
    ).rejects.toThrow(/未結線/);
  });

  it("deleteByTaxYearIdは未結線であることを示すエラーを投げる", async () => {
    await expect(employmentIncomeRecordRepository.deleteByTaxYearId(1)).rejects.toThrow(
      /未結線/,
    );
  });
});
