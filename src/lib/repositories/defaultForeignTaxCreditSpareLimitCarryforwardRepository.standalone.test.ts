/**
 * フェーズ5-1-3d-16:
 * `@/lib/repositories/defaultForeignTaxCreditSpareLimitCarryforwardRepository`の
 * スタンドアロン版差し替え実装
 * (`defaultForeignTaxCreditSpareLimitCarryforwardRepository.standalone.ts`)を検証する。
 *
 * ブラウザ向け(OPFSベース)の`openClientDb`実装が無いため、現時点では各メソッドが
 * 分かりやすいエラーを投げるプレースホルダーであることのみを検証する
 * (`createClientForeignTaxCreditSpareLimitCarryforwardRepository`自体の挙動は
 * `foreignTaxCreditSpareLimitCarryforwardRepository.test.ts`で別途検証済み)。
 */
import { describe, expect, it } from "vitest";
import { foreignTaxCreditSpareLimitCarryforwardRepository } from "./defaultForeignTaxCreditSpareLimitCarryforwardRepository.standalone";

describe("defaultForeignTaxCreditSpareLimitCarryforwardRepository (standalone)", () => {
  it("findByTaxYearIdは未結線であることを示すエラーを投げる", async () => {
    await expect(
      foreignTaxCreditSpareLimitCarryforwardRepository.findByTaxYearId(1),
    ).rejects.toThrow(/未結線/);
  });

  it("upsertは未結線であることを示すエラーを投げる", async () => {
    await expect(
      foreignTaxCreditSpareLimitCarryforwardRepository.upsert({
        taxYearId: 1,
        originYear: 2023,
        remainingAmountJpy: "150000",
      }),
    ).rejects.toThrow(/未結線/);
  });

  it("deleteは未結線であることを示すエラーを投げる", async () => {
    await expect(foreignTaxCreditSpareLimitCarryforwardRepository.delete(1)).rejects.toThrow(
      /未結線/,
    );
  });

  it("createManyは未結線であることを示すエラーを投げる", async () => {
    await expect(
      foreignTaxCreditSpareLimitCarryforwardRepository.createMany([
        { taxYearId: 1, originYear: 2023, remainingAmountJpy: "150000" },
      ]),
    ).rejects.toThrow(/未結線/);
  });
});
