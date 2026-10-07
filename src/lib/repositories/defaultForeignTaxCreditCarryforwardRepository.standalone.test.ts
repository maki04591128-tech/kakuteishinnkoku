/**
 * フェーズ5-1-3d-16: `@/lib/repositories/defaultForeignTaxCreditCarryforwardRepository`の
 * スタンドアロン版差し替え実装
 * (`defaultForeignTaxCreditCarryforwardRepository.standalone.ts`)を検証する。
 *
 * ブラウザ向け(OPFSベース)の`openClientDb`実装が無いため、現時点では各メソッドが
 * 分かりやすいエラーを投げるプレースホルダーであることのみを検証する
 * (`createClientForeignTaxCreditCarryforwardRepository`自体の挙動は
 * `foreignTaxCreditCarryforwardRepository.test.ts`で別途検証済み)。
 */
import { describe, expect, it } from "vitest";
import { foreignTaxCreditCarryforwardRepository } from "./defaultForeignTaxCreditCarryforwardRepository.standalone";

describe("defaultForeignTaxCreditCarryforwardRepository (standalone)", () => {
  it("findByTaxYearIdは未結線であることを示すエラーを投げる", async () => {
    await expect(foreignTaxCreditCarryforwardRepository.findByTaxYearId(1)).rejects.toThrow(
      /未結線/,
    );
  });

  it("upsertは未結線であることを示すエラーを投げる", async () => {
    await expect(
      foreignTaxCreditCarryforwardRepository.upsert({
        taxYearId: 1,
        originYear: 2023,
        remainingAmountJpy: "150000",
      }),
    ).rejects.toThrow(/未結線/);
  });

  it("deleteは未結線であることを示すエラーを投げる", async () => {
    await expect(foreignTaxCreditCarryforwardRepository.delete(1)).rejects.toThrow(/未結線/);
  });

  it("createManyは未結線であることを示すエラーを投げる", async () => {
    await expect(
      foreignTaxCreditCarryforwardRepository.createMany([
        { taxYearId: 1, originYear: 2023, remainingAmountJpy: "150000" },
      ]),
    ).rejects.toThrow(/未結線/);
  });
});
