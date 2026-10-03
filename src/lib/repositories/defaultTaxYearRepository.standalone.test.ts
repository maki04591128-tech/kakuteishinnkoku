/**
 * フェーズ5-1-3b: `@/lib/repositories/defaultTaxYearRepository`の
 * スタンドアロン版差し替え実装(`defaultTaxYearRepository.standalone.ts`)を検証する。
 *
 * ブラウザ向け(OPFSベース)の`openClientDb`実装が無いため、現時点では各メソッドが
 * 分かりやすいエラーを投げるプレースホルダーであることのみを検証する
 * (`createClientTaxYearRepository`自体の挙動は`taxYearRepository.test.ts`で
 * 別途検証済み)。
 */
import { describe, expect, it } from "vitest";
import { taxYearRepository } from "./defaultTaxYearRepository.standalone";

describe("defaultTaxYearRepository (standalone)", () => {
  it("getOrCreateTaxYearは未結線であることを示すエラーを投げる", async () => {
    await expect(taxYearRepository.getOrCreateTaxYear(2025)).rejects.toThrow(
      /未結線/,
    );
  });

  it("findByYearは未結線であることを示すエラーを投げる", async () => {
    await expect(taxYearRepository.findByYear(2025)).rejects.toThrow(/未結線/);
  });

  it("listTaxYearsは未結線であることを示すエラーを投げる", async () => {
    await expect(taxYearRepository.listTaxYears()).rejects.toThrow(/未結線/);
  });

  it("updateCryptoCostMethodは未結線であることを示すエラーを投げる", async () => {
    await expect(
      taxYearRepository.updateCryptoCostMethod(1, "MOVING_AVERAGE"),
    ).rejects.toThrow(/未結線/);
  });
});
