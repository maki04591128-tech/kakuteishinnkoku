/**
 * フェーズ5-1-3d-18: `@/lib/repositories/defaultHomeReplacementLossCarryforwardRepository`の
 * スタンドアロン版差し替え実装
 * (`defaultHomeReplacementLossCarryforwardRepository.standalone.ts`)を検証する。
 *
 * ブラウザ向け(OPFSベース)の`openClientDb`実装が無いため、現時点では各メソッドが
 * 分かりやすいエラーを投げるプレースホルダーであることのみを検証する
 * (`createClientHomeReplacementLossCarryforwardRepository`自体の挙動は
 * `homeReplacementLossCarryforwardRepository.test.ts`で別途検証済み)。
 */
import { describe, expect, it } from "vitest";
import { homeReplacementLossCarryforwardRepository } from "./defaultHomeReplacementLossCarryforwardRepository.standalone";

describe("defaultHomeReplacementLossCarryforwardRepository (standalone)", () => {
  it("findByTaxYearIdは未結線であることを示すエラーを投げる", async () => {
    await expect(
      homeReplacementLossCarryforwardRepository.findByTaxYearId(1),
    ).rejects.toThrow(/未結線/);
  });

  it("upsertは未結線であることを示すエラーを投げる", async () => {
    await expect(
      homeReplacementLossCarryforwardRepository.upsert({
        taxYearId: 1,
        originYear: 2023,
        remainingAmountJpy: "150000",
      }),
    ).rejects.toThrow(/未結線/);
  });

  it("deleteは未結線であることを示すエラーを投げる", async () => {
    await expect(homeReplacementLossCarryforwardRepository.delete(1)).rejects.toThrow(
      /未結線/,
    );
  });

  it("createManyは未結線であることを示すエラーを投げる", async () => {
    await expect(
      homeReplacementLossCarryforwardRepository.createMany([
        { taxYearId: 1, originYear: 2023, remainingAmountJpy: "150000" },
      ]),
    ).rejects.toThrow(/未結線/);
  });
});
