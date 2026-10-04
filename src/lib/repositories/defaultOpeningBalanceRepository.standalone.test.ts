/**
 * フェーズ5-1-3b: `@/lib/repositories/defaultOpeningBalanceRepository`の
 * スタンドアロン版差し替え実装
 * (`defaultOpeningBalanceRepository.standalone.ts`)を検証する。
 *
 * ブラウザ向け(OPFSベース)の`openClientDb`実装が無いため、現時点では各メソッドが
 * 分かりやすいエラーを投げるプレースホルダーであることのみを検証する
 * (`createClientOpeningBalanceRepository`自体の挙動は
 * `openingBalanceRepository.test.ts`で別途検証済み)。
 */
import { describe, expect, it } from "vitest";
import { openingBalanceRepository } from "./defaultOpeningBalanceRepository.standalone";

describe("defaultOpeningBalanceRepository (standalone)", () => {
  it("findByTaxYearIdは未結線であることを示すエラーを投げる", async () => {
    await expect(openingBalanceRepository.findByTaxYearId(1)).rejects.toThrow(
      /未結線/,
    );
  });

  it("upsertは未結線であることを示すエラーを投げる", async () => {
    await expect(
      openingBalanceRepository.upsert({
        taxYearId: 1,
        assetClass: "INVESTMENT",
        symbol: "1234",
        isNisa: false,
        isListed: true,
        quantity: "100",
        costBasisJpy: "500000",
      }),
    ).rejects.toThrow(/未結線/);
  });

  it("deleteは未結線であることを示すエラーを投げる", async () => {
    await expect(openingBalanceRepository.delete(1)).rejects.toThrow(
      /未結線/,
    );
  });

  it("createManyは未結線であることを示すエラーを投げる", async () => {
    await expect(openingBalanceRepository.createMany([])).rejects.toThrow(
      /未結線/,
    );
  });
});
