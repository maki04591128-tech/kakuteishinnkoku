/**
 * フェーズ5-1-3b:
 * `@/lib/repositories/defaultCertifiedHousingConstructionCreditCarryforwardRepository`の
 * スタンドアロン版差し替え実装
 * (`defaultCertifiedHousingConstructionCreditCarryforwardRepository.standalone.ts`)を検証する。
 *
 * ブラウザ向け(OPFSベース)の`openClientDb`実装が無いため、現時点では各メソッドが
 * 分かりやすいエラーを投げるプレースホルダーであることのみを検証する
 * (`createClientCertifiedHousingConstructionCreditCarryforwardRepository`自体の挙動は
 * `certifiedHousingConstructionCreditCarryforwardRepository.test.ts`で別途検証済み)。
 */
import { describe, expect, it } from "vitest";
import { certifiedHousingConstructionCreditCarryforwardRepository } from "./defaultCertifiedHousingConstructionCreditCarryforwardRepository.standalone";

describe("defaultCertifiedHousingConstructionCreditCarryforwardRepository (standalone)", () => {
  it("findByTaxYearIdは未結線であることを示すエラーを投げる", async () => {
    await expect(
      certifiedHousingConstructionCreditCarryforwardRepository.findByTaxYearId(1),
    ).rejects.toThrow(/未結線/);
  });

  it("upsertは未結線であることを示すエラーを投げる", async () => {
    await expect(
      certifiedHousingConstructionCreditCarryforwardRepository.upsert({
        taxYearId: 1,
        originYear: 2023,
        remainingAmountJpy: "150000",
      }),
    ).rejects.toThrow(/未結線/);
  });

  it("deleteByTaxYearIdは未結線であることを示すエラーを投げる", async () => {
    await expect(
      certifiedHousingConstructionCreditCarryforwardRepository.deleteByTaxYearId(1),
    ).rejects.toThrow(/未結線/);
  });
});
