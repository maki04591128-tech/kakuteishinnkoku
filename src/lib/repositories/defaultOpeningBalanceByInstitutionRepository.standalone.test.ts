/**
 * フェーズ5-1-3b: `@/lib/repositories/defaultOpeningBalanceByInstitutionRepository`の
 * スタンドアロン版差し替え実装
 * (`defaultOpeningBalanceByInstitutionRepository.standalone.ts`)を検証する。
 *
 * ブラウザ向け(OPFSベース)の`openClientDb`実装が無いため、現時点では各メソッドが
 * 分かりやすいエラーを投げるプレースホルダーであることのみを検証する
 * (`createClientOpeningBalanceByInstitutionRepository`自体の挙動は
 * `openingBalanceByInstitutionRepository.test.ts`で別途検証済み)。
 */
import { describe, expect, it } from "vitest";
import { openingBalanceByInstitutionRepository } from "./defaultOpeningBalanceByInstitutionRepository.standalone";

describe("defaultOpeningBalanceByInstitutionRepository (standalone)", () => {
  it("findByTaxYearIdは未結線であることを示すエラーを投げる", async () => {
    await expect(
      openingBalanceByInstitutionRepository.findByTaxYearId(1),
    ).rejects.toThrow(/未結線/);
  });

  it("upsertは未結線であることを示すエラーを投げる", async () => {
    await expect(
      openingBalanceByInstitutionRepository.upsert({
        taxYearId: 1,
        assetClass: "CRYPTO",
        symbol: "BTC",
        institution: "bitFlyer",
        quantity: "1.5",
      }),
    ).rejects.toThrow(/未結線/);
  });

  it("deleteは未結線であることを示すエラーを投げる", async () => {
    await expect(
      openingBalanceByInstitutionRepository.delete(1),
    ).rejects.toThrow(/未結線/);
  });
});
