/**
 * フェーズ5-1-3d-17: `@/lib/repositories/defaultHomeSaleLossCarryforwardRepository`の
 * スタンドアロン版差し替え実装
 * (`defaultHomeSaleLossCarryforwardRepository.standalone.ts`)を検証する。
 *
 * ブラウザ向け(OPFSベース)の`openClientDb`実装が無いため、現時点では各メソッドが
 * 分かりやすいエラーを投げるプレースホルダーであることのみを検証する
 * (`createClientHomeSaleLossCarryforwardRepository`自体の挙動は
 * `homeSaleLossCarryforwardRepository.test.ts`で別途検証済み)。
 */
import { describe, expect, it } from "vitest";
import { homeSaleLossCarryforwardRepository } from "./defaultHomeSaleLossCarryforwardRepository.standalone";

describe("defaultHomeSaleLossCarryforwardRepository (standalone)", () => {
  it("findByTaxYearIdは未結線であることを示すエラーを投げる", async () => {
    await expect(homeSaleLossCarryforwardRepository.findByTaxYearId(1)).rejects.toThrow(
      /未結線/,
    );
  });

  it("upsertは未結線であることを示すエラーを投げる", async () => {
    await expect(
      homeSaleLossCarryforwardRepository.upsert({
        taxYearId: 1,
        originYear: 2023,
        remainingAmountJpy: "150000",
      }),
    ).rejects.toThrow(/未結線/);
  });

  it("deleteは未結線であることを示すエラーを投げる", async () => {
    await expect(homeSaleLossCarryforwardRepository.delete(1)).rejects.toThrow(/未結線/);
  });

  it("createManyは未結線であることを示すエラーを投げる", async () => {
    await expect(
      homeSaleLossCarryforwardRepository.createMany([
        { taxYearId: 1, originYear: 2023, remainingAmountJpy: "150000" },
      ]),
    ).rejects.toThrow(/未結線/);
  });
});
