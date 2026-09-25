import { describe, expect, it } from "vitest";
import {
  estimateDurabilityImprovementRenovationDeduction,
  type DurabilityImprovementRenovationDeductionInput,
} from "./durabilityImprovementRenovationDeduction";

function baseInput(
  overrides: Partial<DurabilityImprovementRenovationDeductionInput> = {},
): DurabilityImprovementRenovationDeductionInput {
  return {
    residenceYear: 2025,
    combinationType: "EARTHQUAKE",
    floorAreaCategory: "AT_LEAST_50",
    totalIncomeJpy: 5_000_000,
    includesSolarPowerEquipment: false,
    earthquakeRenovationStandardCostJpy: 1_000_000,
    energySavingRenovationStandardCostJpy: 0,
    durabilityImprovementStandardCostJpy: 1_000_000,
    otherRelatedWorkCostJpy: 0,
    workCompletedWithinSixMonths: true,
    atLeastHalfCostForOwnResidence: true,
    usedSameCreditInPastThreeYears: false,
    claimedEnergySavingAloneInPastThreeYears: false,
    ...overrides,
  };
}

describe("estimateDurabilityImprovementRenovationDeduction", () => {
  it("住宅耐震改修と併せる場合、控除対象限度額は250万円で合計額以下ならA(10%)のみ", () => {
    const result = estimateDurabilityImprovementRenovationDeduction(baseInput());

    expect(result.eligible).toBe(true);
    expect(result.controlLimitJpy.toNumber()).toBe(2_500_000);
    // 耐震改修100万円+耐久性向上100万円=200万円
    expect(result.combinedStandardCostJpy.toNumber()).toBe(2_000_000);
    expect(result.amountAJpy.toNumber()).toBe(2_000_000);
    expect(result.amountBJpy.toNumber()).toBe(0);
    expect(result.creditJpy.toNumber()).toBe(200_000);
  });

  it("一般省エネ改修工事と併せる場合、控除対象限度額は太陽光無しで250万円、太陽光有りで350万円", () => {
    const withoutSolar = estimateDurabilityImprovementRenovationDeduction(
      baseInput({
        combinationType: "ENERGY_SAVING",
        earthquakeRenovationStandardCostJpy: 0,
        energySavingRenovationStandardCostJpy: 1_000_000,
      }),
    );
    const withSolar = estimateDurabilityImprovementRenovationDeduction(
      baseInput({
        combinationType: "ENERGY_SAVING",
        includesSolarPowerEquipment: true,
        earthquakeRenovationStandardCostJpy: 0,
        energySavingRenovationStandardCostJpy: 1_000_000,
      }),
    );

    expect(withoutSolar.controlLimitJpy.toNumber()).toBe(2_500_000);
    expect(withSolar.controlLimitJpy.toNumber()).toBe(3_500_000);
  });

  it("住宅耐震改修・一般省エネ改修工事の両方と併せる場合、控除対象限度額は太陽光無しで500万円、太陽光有りで600万円", () => {
    const withoutSolar = estimateDurabilityImprovementRenovationDeduction(
      baseInput({
        combinationType: "BOTH",
        earthquakeRenovationStandardCostJpy: 1_000_000,
        energySavingRenovationStandardCostJpy: 1_000_000,
      }),
    );
    const withSolar = estimateDurabilityImprovementRenovationDeduction(
      baseInput({
        combinationType: "BOTH",
        includesSolarPowerEquipment: true,
        earthquakeRenovationStandardCostJpy: 1_000_000,
        energySavingRenovationStandardCostJpy: 1_000_000,
      }),
    );

    expect(withoutSolar.controlLimitJpy.toNumber()).toBe(5_000_000);
    expect(withSolar.controlLimitJpy.toNumber()).toBe(6_000_000);
  });

  it("控除対象限度額を超える部分はB(5%)として計算する", () => {
    const result = estimateDurabilityImprovementRenovationDeduction(
      baseInput({ earthquakeRenovationStandardCostJpy: 2_000_000, durabilityImprovementStandardCostJpy: 1_500_000 }),
    );

    expect(result.eligible).toBe(true);
    // 合計350万円、限度額250万円
    expect(result.combinedStandardCostJpy.toNumber()).toBe(3_500_000);
    expect(result.amountAJpy.toNumber()).toBe(2_500_000);
    expect(result.amountBJpy.toNumber()).toBe(1_000_000);
    // A: 2,500,000*10%=250,000 / B: 1,000,000*5%=50,000
    expect(result.creditJpy.toNumber()).toBe(300_000);
  });

  it("Bが1,000万円からAを控除した限度額を超える場合は頭打ちにする", () => {
    const result = estimateDurabilityImprovementRenovationDeduction(
      baseInput({
        earthquakeRenovationStandardCostJpy: 6_000_000,
        durabilityImprovementStandardCostJpy: 3_000_000,
        otherRelatedWorkCostJpy: 3_000_000,
      }),
    );

    expect(result.eligible).toBe(true);
    expect(result.amountAJpy.toNumber()).toBe(2_500_000);
    expect(result.amountBJpy.toNumber()).toBe(7_500_000);
    expect(result.notes.some((n) => n.includes("頭打ちにした"))).toBe(true);
  });

  it("併せて行う耐震改修・省エネ改修工事の標準的な費用の額の合計が50万円以下の場合は対象外", () => {
    const result = estimateDurabilityImprovementRenovationDeduction(
      baseInput({ earthquakeRenovationStandardCostJpy: 500_000 }),
    );
    expect(result.eligible).toBe(false);
  });

  it("耐久性向上改修工事の標準的な費用の額が50万円以下の場合は対象外", () => {
    const result = estimateDurabilityImprovementRenovationDeduction(
      baseInput({ durabilityImprovementStandardCostJpy: 500_000 }),
    );
    expect(result.eligible).toBe(false);
  });

  it("併せる工事の種類に対応する標準的な費用の額が未入力(0円)の場合は対象外", () => {
    const missingEarthquake = estimateDurabilityImprovementRenovationDeduction(
      baseInput({ earthquakeRenovationStandardCostJpy: 0 }),
    );
    const missingEnergySaving = estimateDurabilityImprovementRenovationDeduction(
      baseInput({
        combinationType: "ENERGY_SAVING",
        earthquakeRenovationStandardCostJpy: 0,
        energySavingRenovationStandardCostJpy: 0,
      }),
    );

    expect(missingEarthquake.eligible).toBe(false);
    expect(missingEnergySaving.eligible).toBe(false);
  });

  it("合計所得金額の上限は令和6年(2024年)分以後2,000万円、令和5年(2023年)分以前は3,000万円", () => {
    const before = estimateDurabilityImprovementRenovationDeduction(
      baseInput({ residenceYear: 2023, totalIncomeJpy: 25_000_000 }),
    );
    const from2024 = estimateDurabilityImprovementRenovationDeduction(
      baseInput({ residenceYear: 2024, totalIncomeJpy: 25_000_000 }),
    );

    expect(before.eligible).toBe(true);
    expect(from2024.eligible).toBe(false);
  });

  it("床面積40〜50平方メートル未満は令和8年(2026年)以後の居住のみ対象", () => {
    const tooEarly = estimateDurabilityImprovementRenovationDeduction(
      baseInput({ residenceYear: 2025, floorAreaCategory: "FROM_40_TO_50", totalIncomeJpy: 9_000_000 }),
    );
    const ok = estimateDurabilityImprovementRenovationDeduction(
      baseInput({ residenceYear: 2026, floorAreaCategory: "FROM_40_TO_50", totalIncomeJpy: 9_000_000 }),
    );
    const tooHighIncome = estimateDurabilityImprovementRenovationDeduction(
      baseInput({ residenceYear: 2026, floorAreaCategory: "FROM_40_TO_50", totalIncomeJpy: 11_000_000 }),
    );

    expect(tooEarly.eligible).toBe(false);
    expect(ok.eligible).toBe(true);
    expect(tooHighIncome.eligible).toBe(false);
  });

  it("令和4年(2022年)より前に居住の用に供した場合は対象外", () => {
    const result = estimateDurabilityImprovementRenovationDeduction(baseInput({ residenceYear: 2021 }));
    expect(result.eligible).toBe(false);
  });

  it("適用期限(令和10年(2028年)12月31日)を過ぎた場合は対象外", () => {
    const result = estimateDurabilityImprovementRenovationDeduction(baseInput({ residenceYear: 2029 }));
    expect(result.eligible).toBe(false);
  });

  it("工事完了から6か月以内に居住していない場合は対象外", () => {
    const result = estimateDurabilityImprovementRenovationDeduction(
      baseInput({ workCompletedWithinSixMonths: false }),
    );
    expect(result.eligible).toBe(false);
  });

  it("工事費用の半分以上が自己居住用でない場合は対象外", () => {
    const result = estimateDurabilityImprovementRenovationDeduction(
      baseInput({ atLeastHalfCostForOwnResidence: false }),
    );
    expect(result.eligible).toBe(false);
  });

  it("前年以前3年内に同一住宅で本控除(耐久性向上改修工事分)を適用済みの場合は対象外", () => {
    const result = estimateDurabilityImprovementRenovationDeduction(
      baseInput({ usedSameCreditInPastThreeYears: true }),
    );
    expect(result.eligible).toBe(false);
  });

  it("一般省エネ改修工事を併せる場合、前年以前3年内に一般省エネ改修工事単独の控除を適用済みなら対象外", () => {
    const result = estimateDurabilityImprovementRenovationDeduction(
      baseInput({
        combinationType: "ENERGY_SAVING",
        earthquakeRenovationStandardCostJpy: 0,
        energySavingRenovationStandardCostJpy: 1_000_000,
        claimedEnergySavingAloneInPastThreeYears: true,
      }),
    );
    expect(result.eligible).toBe(false);
  });

  it("住宅耐震改修のみと併せる場合は一般省エネ改修工事単独控除の適用有無を問わない", () => {
    const result = estimateDurabilityImprovementRenovationDeduction(
      baseInput({ claimedEnergySavingAloneInPastThreeYears: true }),
    );
    expect(result.eligible).toBe(true);
  });

  it("負の値を入力するとエラーになる", () => {
    expect(() =>
      estimateDurabilityImprovementRenovationDeduction(
        baseInput({ durabilityImprovementStandardCostJpy: -1 }),
      ),
    ).toThrow();
  });
});
