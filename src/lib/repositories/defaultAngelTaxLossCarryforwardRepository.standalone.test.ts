/**
 * フェーズ5-1-3d-15: `@/lib/repositories/defaultAngelTaxLossCarryforwardRepository`の
 * スタンドアロン版差し替え実装
 * (`defaultAngelTaxLossCarryforwardRepository.standalone.ts`)を検証する。
 *
 * ブラウザ向け(OPFSベース)の`openClientDb`実装が無いため、現時点では各メソッドが
 * 分かりやすいエラーを投げるプレースホルダーであることのみを検証する
 * (`createClientAngelTaxLossCarryforwardRepository`自体の挙動は
 * `angelTaxLossCarryforwardRepository.test.ts`で別途検証済み)。
 */
import { describe, expect, it } from "vitest";
import { angelTaxLossCarryforwardRepository } from "./defaultAngelTaxLossCarryforwardRepository.standalone";

describe("defaultAngelTaxLossCarryforwardRepository (standalone)", () => {
  it("findByTaxYearIdは未結線であることを示すエラーを投げる", async () => {
    await expect(angelTaxLossCarryforwardRepository.findByTaxYearId(1)).rejects.toThrow(
      /未結線/,
    );
  });

  it("upsertは未結線であることを示すエラーを投げる", async () => {
    await expect(
      angelTaxLossCarryforwardRepository.upsert({
        taxYearId: 1,
        originYear: 2023,
        remainingAmountJpy: "150000",
      }),
    ).rejects.toThrow(/未結線/);
  });

  it("deleteは未結線であることを示すエラーを投げる", async () => {
    await expect(angelTaxLossCarryforwardRepository.delete(1)).rejects.toThrow(/未結線/);
  });
});
