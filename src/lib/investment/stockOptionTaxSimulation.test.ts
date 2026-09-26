import { describe, expect, it } from "vitest";
import { simulateStockOptionTax } from "./stockOptionTaxSimulation";

function baseInput() {
  return {
    companyType: "LISTED_5Y_OR_MORE" as const,
    grantContractPricePerShareJpy: 1_000,
    exercisePricePerShareJpy: 1_000,
    fairMarketValueAtExercisePerShareJpy: 3_000,
    salePricePerShareJpy: 5_000,
    shares: 1_000,
    grantDate: "2020-01-01",
    exerciseDate: "2023-01-02",
    otherRequirementsConfirmed: true,
    otherTaxableIncomeJpy: 5_000_000,
  };
}

describe("simulateStockOptionTax", () => {
  it("税制適格の要件をすべて満たす場合、権利行使時は課税されず売却時のみ課税される", () => {
    const result = simulateStockOptionTax(baseInput());

    expect(result.qualifiedShares.toNumber()).toBe(1_000);
    expect(result.nonQualifiedShares.toNumber()).toBe(0);
    expect(result.nonQualifiedExerciseGainJpy.toNumber()).toBe(0);
    expect(result.exerciseNationalTaxIncreaseJpy.toNumber()).toBe(0);
    expect(result.exerciseResidentTaxIncreaseJpy.toNumber()).toBe(0);

    // 売却時: (5,000 - 1,000) × 1,000株 = 4,000,000円が譲渡所得
    expect(result.sale?.qualifiedGainJpy.toNumber()).toBe(4_000_000);
    expect(result.sale?.nonQualifiedGainJpy.toNumber()).toBe(0);
    expect(result.sale?.totalTaxableGainJpy.toNumber()).toBe(4_000_000);
    expect(result.sale?.nationalTaxJpy.toNumber()).toBeCloseTo(4_000_000 * 0.15315, 0);
    expect(result.sale?.residentTaxJpy.toNumber()).toBe(200_000);
  });

  it("権利行使価額が付与契約締結時の価額を下回る場合は税制非適格になる", () => {
    const result = simulateStockOptionTax({
      ...baseInput(),
      grantContractPricePerShareJpy: 2_000,
      exercisePricePerShareJpy: 1_000,
    });

    expect(result.meetsExercisePriceRequirement).toBe(false);
    expect(result.qualifiedShares.toNumber()).toBe(0);
    expect(result.nonQualifiedShares.toNumber()).toBe(1_000);
    // 権利行使益: (3,000 - 1,000) × 1,000株 = 2,000,000円
    expect(result.nonQualifiedExerciseGainJpy.toNumber()).toBe(2_000_000);
    expect(result.exerciseNationalTaxIncreaseJpy.toNumber()).toBeGreaterThan(0);
    expect(result.exerciseResidentTaxIncreaseJpy.toNumber()).toBe(200_000);

    // 売却時(非適格分): (5,000 - 3,000) × 1,000株 = 2,000,000円
    expect(result.sale?.nonQualifiedGainJpy.toNumber()).toBe(2_000_000);
    expect(result.sale?.qualifiedGainJpy.toNumber()).toBe(0);
  });

  it("権利行使期間(決議日後2年〜10年)を外れる場合は税制非適格になる", () => {
    const tooEarly = simulateStockOptionTax({
      ...baseInput(),
      grantDate: "2022-01-01",
      exerciseDate: "2023-01-01",
    });
    expect(tooEarly.meetsExercisePeriodRequirement).toBe(false);
    expect(tooEarly.qualifiedShares.toNumber()).toBe(0);

    const tooLate = simulateStockOptionTax({
      ...baseInput(),
      grantDate: "2005-01-01",
      exerciseDate: "2023-01-01",
    });
    expect(tooLate.meetsExercisePeriodRequirement).toBe(false);
    expect(tooLate.qualifiedShares.toNumber()).toBe(0);
  });

  it("設立5年未満の非上場会社は権利行使期間の上限が15年になる", () => {
    const result = simulateStockOptionTax({
      ...baseInput(),
      companyType: "UNLISTED_UNDER_5Y",
      grantDate: "2010-01-01",
      exerciseDate: "2023-01-01",
    });
    expect(result.meetsExercisePeriodRequirement).toBe(true);
  });

  it("その他の要件確認が false の場合は税制非適格になる", () => {
    const result = simulateStockOptionTax({
      ...baseInput(),
      otherRequirementsConfirmed: false,
    });
    expect(result.meetsOtherRequirements).toBe(false);
    expect(result.qualifiedShares.toNumber()).toBe(0);
    expect(result.nonQualifiedShares.toNumber()).toBe(1_000);
  });

  it("その年中の権利行使価額の合計が上限額を超える場合、超過分の株数のみ非適格として按分する", () => {
    const result = simulateStockOptionTax({
      ...baseInput(),
      exercisePricePerShareJpy: 10_000,
      shares: 2_000,
      otherQualifiedExercisesJpy: 8_000_000,
    });

    // 上限1,200万円 - 他の行使8,000,000円 = 残り400万円 → 400株分のみ適格
    expect(result.qualifiedShares.toNumber()).toBe(400);
    expect(result.nonQualifiedShares.toNumber()).toBe(1_600);
  });

  it("非上場会社(設立5年以上)は年間上限額が2,400万円になる", () => {
    const result = simulateStockOptionTax({
      ...baseInput(),
      companyType: "UNLISTED_5Y_OR_MORE",
      exercisePricePerShareJpy: 10_000,
      shares: 3_000,
    });
    expect(result.annualExerciseLimitJpy.toNumber()).toBe(24_000_000);
    expect(result.qualifiedShares.toNumber()).toBe(2_400);
    expect(result.nonQualifiedShares.toNumber()).toBe(600);
  });

  it("売却価額が未指定の場合、売却時の課税は計算しない", () => {
    const input = baseInput();
    const result = simulateStockOptionTax({
      ...input,
      salePricePerShareJpy: undefined,
    });
    expect(result.sale).toBeUndefined();
  });

  it("社外高度人材(業務委託)は所得区分が事業所得又は雑所得になる", () => {
    const result = simulateStockOptionTax({
      ...baseInput(),
      grantContractPricePerShareJpy: 2_000,
      isBusinessConsultant: true,
    });
    expect(result.nonQualifiedExerciseIncomeType).toBe("BUSINESS_OR_OCCASIONAL");
  });

  it("負の値は拒否する", () => {
    expect(() =>
      simulateStockOptionTax({ ...baseInput(), shares: -1 }),
    ).toThrow();
    expect(() =>
      simulateStockOptionTax({ ...baseInput(), exercisePricePerShareJpy: -1 }),
    ).toThrow();
  });
});
