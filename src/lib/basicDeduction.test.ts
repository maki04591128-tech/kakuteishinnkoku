import { describe, expect, it } from "vitest";
import { estimateBasicDeduction } from "./basicDeduction";

describe("estimateBasicDeduction", () => {
  it("令和6年分以前は合計所得金額2,400万円以下一律48万円/43万円", () => {
    const result = estimateBasicDeduction({ totalIncomeJpy: 5_000_000, year: 2024 });
    expect(result.incomeTaxAmountJpy.toNumber()).toBe(480_000);
    expect(result.residentTaxAmountJpy.toNumber()).toBe(430_000);
  });

  it("年分省略時は令和6年分以前(48万円/43万円)を適用する", () => {
    const result = estimateBasicDeduction({ totalIncomeJpy: 5_000_000 });
    expect(result.incomeTaxAmountJpy.toNumber()).toBe(480_000);
    expect(result.residentTaxAmountJpy.toNumber()).toBe(430_000);
  });

  it("令和7年分は合計所得金額132万円以下だと所得税95万円、住民税は変わらず43万円", () => {
    const result = estimateBasicDeduction({ totalIncomeJpy: 1_320_000, year: 2025 });
    expect(result.incomeTaxAmountJpy.toNumber()).toBe(950_000);
    expect(result.residentTaxAmountJpy.toNumber()).toBe(430_000);
  });

  it("令和7年分の所得税基礎控除の段階表(132万円超336万円以下は88万円等)", () => {
    expect(
      estimateBasicDeduction({ totalIncomeJpy: 3_360_000, year: 2025 }).incomeTaxAmountJpy.toNumber(),
    ).toBe(880_000);
    expect(
      estimateBasicDeduction({ totalIncomeJpy: 4_890_000, year: 2025 }).incomeTaxAmountJpy.toNumber(),
    ).toBe(680_000);
    expect(
      estimateBasicDeduction({ totalIncomeJpy: 6_550_000, year: 2025 }).incomeTaxAmountJpy.toNumber(),
    ).toBe(630_000);
  });

  it("令和7年分は合計所得金額655万円超2,350万円以下だと所得税58万円", () => {
    const result = estimateBasicDeduction({ totalIncomeJpy: 10_000_000, year: 2025 });
    expect(result.incomeTaxAmountJpy.toNumber()).toBe(580_000);
    expect(result.residentTaxAmountJpy.toNumber()).toBe(430_000);
  });

  it("令和8年度税制改正により令和8年分・9年分は132万円以下〜336万円超489万円以下がいずれも104万円に統一される", () => {
    for (const year of [2026, 2027]) {
      for (const totalIncomeJpy of [1_320_000, 3_360_000, 4_890_000]) {
        expect(
          estimateBasicDeduction({ totalIncomeJpy, year }).incomeTaxAmountJpy.toNumber(),
        ).toBe(1_040_000);
      }
      expect(
        estimateBasicDeduction({ totalIncomeJpy: 6_550_000, year }).incomeTaxAmountJpy.toNumber(),
      ).toBe(670_000);
      expect(
        estimateBasicDeduction({ totalIncomeJpy: 10_000_000, year }).incomeTaxAmountJpy.toNumber(),
      ).toBe(620_000);
      expect(
        estimateBasicDeduction({ totalIncomeJpy: 6_550_000, year }).residentTaxAmountJpy.toNumber(),
      ).toBe(430_000);
    }
  });

  it("令和10年分以後は132万円以下99万円、132万円超2,350万円以下62万円に統一される", () => {
    expect(
      estimateBasicDeduction({ totalIncomeJpy: 1_320_000, year: 2028 }).incomeTaxAmountJpy.toNumber(),
    ).toBe(990_000);
    for (const totalIncomeJpy of [1_320_001, 3_360_000, 4_890_000, 6_550_000, 10_000_000]) {
      expect(
        estimateBasicDeduction({ totalIncomeJpy, year: 2028 }).incomeTaxAmountJpy.toNumber(),
      ).toBe(620_000);
    }
  });

  it("令和12年分以後も一次情報未公表のため令和10年分の数値を暫定適用する", () => {
    const result = estimateBasicDeduction({ totalIncomeJpy: 1_320_000, year: 2030 });
    expect(result.incomeTaxAmountJpy.toNumber()).toBe(990_000);
  });

  it("高所得層側の逓減・消失は年分に関わらず所得税・住民税とも従来通り", () => {
    const result2350Over = estimateBasicDeduction({ totalIncomeJpy: 24_000_000, year: 2025 });
    expect(result2350Over.incomeTaxAmountJpy.toNumber()).toBe(480_000);
    expect(result2350Over.residentTaxAmountJpy.toNumber()).toBe(430_000);

    const result2400Over = estimateBasicDeduction({ totalIncomeJpy: 24_500_000, year: 2025 });
    expect(result2400Over.incomeTaxAmountJpy.toNumber()).toBe(320_000);
    expect(result2400Over.residentTaxAmountJpy.toNumber()).toBe(290_000);

    const result2450Over = estimateBasicDeduction({ totalIncomeJpy: 25_000_000, year: 2025 });
    expect(result2450Over.incomeTaxAmountJpy.toNumber()).toBe(160_000);
    expect(result2450Over.residentTaxAmountJpy.toNumber()).toBe(150_000);

    const result2500Over = estimateBasicDeduction({ totalIncomeJpy: 30_000_000, year: 2025 });
    expect(result2500Over.incomeTaxAmountJpy.toNumber()).toBe(0);
    expect(result2500Over.residentTaxAmountJpy.toNumber()).toBe(0);
  });

  it("合計所得金額が負の場合はエラー", () => {
    expect(() => estimateBasicDeduction({ totalIncomeJpy: -1 })).toThrow();
  });
});
