/**
 * フェーズ5-1-3b: `@/lib/repositories/defaultDonationTaxCreditRecordRepository`の
 * スタンドアロン版差し替え実装
 * (`defaultDonationTaxCreditRecordRepository.standalone.ts`)を検証する。
 *
 * ブラウザ向け(OPFSベース)の`openClientDb`実装が無いため、現時点では各メソッドが
 * 分かりやすいエラーを投げるプレースホルダーであることのみを検証する
 * (`createClientDonationTaxCreditRecordRepository`自体の挙動は
 * `donationTaxCreditRecordRepository.test.ts`で別途検証済み)。
 */
import { describe, expect, it } from "vitest";
import { donationTaxCreditRecordRepository } from "./defaultDonationTaxCreditRecordRepository.standalone";

describe("defaultDonationTaxCreditRecordRepository (standalone)", () => {
  it("findByTaxYearIdは未結線であることを示すエラーを投げる", async () => {
    await expect(donationTaxCreditRecordRepository.findByTaxYearId(1)).rejects.toThrow(
      /未結線/,
    );
  });

  it("upsertは未結線であることを示すエラーを投げる", async () => {
    await expect(
      donationTaxCreditRecordRepository.upsert({
        taxYearId: 1,
        totalTaxCreditJpy: "150000",
        residentTaxBasicDeductionJpy: "30000",
      }),
    ).rejects.toThrow(/未結線/);
  });

  it("deleteByTaxYearIdは未結線であることを示すエラーを投げる", async () => {
    await expect(donationTaxCreditRecordRepository.deleteByTaxYearId(1)).rejects.toThrow(
      /未結線/,
    );
  });
});
