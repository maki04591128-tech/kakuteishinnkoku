import { describe, expect, it } from "vitest";
import {
  estimateCertifiedHousingConstructionCredit,
  type CertifiedHousingConstructionCreditInput,
} from "./certifiedHousingConstructionCredit";

function baseInput(
  overrides: Partial<CertifiedHousingConstructionCreditInput> = {},
): CertifiedHousingConstructionCreditInput {
  return {
    residenceYear: 2025,
    housingType: "CERTIFIED",
    floorAreaSqm: 100,
    totalIncomeJpy: 8_000_000,
    isNewOrUnusedAcquisition: true,
    occupiedWithinSixMonths: true,
    atLeastHalfOwnResidence: true,
    isMainResidenceAmongMultipleHomes: true,
    usedHomeSaleCapitalGainsExclusion: false,
    choseMortgageDeductionInstead: false,
    ...overrides,
  };
}

describe("estimateCertifiedHousingConstructionCredit", () => {
  it("標準的なかかり増し費用が限度額以下の場合はその10%が控除額になる", () => {
    // 45,300円 × 100㎡ = 4,530,000円 (650万円の限度額以下)
    const result = estimateCertifiedHousingConstructionCredit(baseInput());

    expect(result.eligible).toBe(true);
    expect(result.incrementalCostJpy.toNumber()).toBe(4_530_000);
    expect(result.cappedCostJpy.toNumber()).toBe(4_530_000);
    expect(result.creditJpy.toNumber()).toBe(453_000);
  });

  it("標準的なかかり増し費用が控除対象限度額(650万円)を超える場合は限度額で頭打ちにする", () => {
    // 45,300円 × 200㎡ = 9,060,000円 > 650万円
    const result = estimateCertifiedHousingConstructionCredit(
      baseInput({ floorAreaSqm: 200 }),
    );

    expect(result.eligible).toBe(true);
    expect(result.incrementalCostJpy.toNumber()).toBe(9_060_000);
    expect(result.cappedCostJpy.toNumber()).toBe(6_500_000);
    expect(result.creditJpy.toNumber()).toBe(650_000);
    expect(result.notes.some((n) => n.includes("頭打ちにした"))).toBe(true);
  });

  it("100円未満の端数は切り捨てる", () => {
    // 45,300円 × 123.45㎡ = 5,592,285円 → ×10% = 559,228.5円 → 559,200円に切り捨て
    const result = estimateCertifiedHousingConstructionCredit(
      baseInput({ floorAreaSqm: 123.45 }),
    );

    expect(result.eligible).toBe(true);
    expect(result.creditJpy.toNumber()).toBe(559_200);
  });

  it("床面積が50平方メートル未満の場合は対象外", () => {
    const result = estimateCertifiedHousingConstructionCredit(
      baseInput({ floorAreaSqm: 49 }),
    );

    expect(result.eligible).toBe(false);
    expect(result.ineligibleReason).toContain("50平方メートル以上");
    expect(result.creditJpy.toNumber()).toBe(0);
  });

  it("床面積がちょうど50平方メートルの場合は要件を満たす(境界値)", () => {
    const result = estimateCertifiedHousingConstructionCredit(
      baseInput({ floorAreaSqm: 50 }),
    );

    expect(result.eligible).toBe(true);
  });

  it("合計所得金額が2,000万円を超える場合は対象外(令和6年以後居住)", () => {
    const result = estimateCertifiedHousingConstructionCredit(
      baseInput({ residenceYear: 2024, totalIncomeJpy: 20_000_001 }),
    );

    expect(result.eligible).toBe(false);
    expect(result.ineligibleReason).toContain("上限");
  });

  it("令和5年までの居住は合計所得金額3,000万円まで対象になる", () => {
    const result = estimateCertifiedHousingConstructionCredit(
      baseInput({ residenceYear: 2023, totalIncomeJpy: 25_000_000 }),
    );

    expect(result.eligible).toBe(true);
    expect(result.notes.some((n) => n.includes("3,000万円"))).toBe(true);
  });

  it("令和6年以後の居住で合計所得金額が2,000万円を超えると令和5年以前と異なり対象外になる", () => {
    const result = estimateCertifiedHousingConstructionCredit(
      baseInput({ residenceYear: 2024, totalIncomeJpy: 25_000_000 }),
    );

    expect(result.eligible).toBe(false);
  });

  it("新築または未使用住宅の取得でない場合(中古住宅の取得)は対象外", () => {
    const result = estimateCertifiedHousingConstructionCredit(
      baseInput({ isNewOrUnusedAcquisition: false }),
    );

    expect(result.eligible).toBe(false);
    expect(result.ineligibleReason).toContain("中古住宅");
  });

  it("取得の日から6か月以内に居住していない場合は対象外", () => {
    const result = estimateCertifiedHousingConstructionCredit(
      baseInput({ occupiedWithinSixMonths: false }),
    );

    expect(result.eligible).toBe(false);
    expect(result.ineligibleReason).toContain("6か月以内");
  });

  it("床面積の2分の1以上が自己居住用でない場合は対象外", () => {
    const result = estimateCertifiedHousingConstructionCredit(
      baseInput({ atLeastHalfOwnResidence: false }),
    );

    expect(result.eligible).toBe(false);
  });

  it("複数所有住宅のうち主として居住する住宅でない場合は対象外", () => {
    const result = estimateCertifiedHousingConstructionCredit(
      baseInput({ isMainResidenceAmongMultipleHomes: false }),
    );

    expect(result.eligible).toBe(false);
  });

  it("居住用財産の譲渡所得の特例を利用している場合は対象外", () => {
    const result = estimateCertifiedHousingConstructionCredit(
      baseInput({ usedHomeSaleCapitalGainsExclusion: true }),
    );

    expect(result.eligible).toBe(false);
    expect(result.ineligibleReason).toContain("譲渡所得の特例");
  });

  it("住宅ローン控除を選択する場合はこの控除は選択適用できず対象外", () => {
    const result = estimateCertifiedHousingConstructionCredit(
      baseInput({ choseMortgageDeductionInstead: true }),
    );

    expect(result.eligible).toBe(false);
    expect(result.ineligibleReason).toContain("選択適用");
  });

  it("令和4年より前に居住した場合は対象外", () => {
    const result = estimateCertifiedHousingConstructionCredit(
      baseInput({ residenceYear: 2021 }),
    );

    expect(result.eligible).toBe(false);
    expect(result.ineligibleReason).toContain("令和4年");
  });

  it("令和10年を超えて居住した場合は対象外(適用期限切れ)", () => {
    const result = estimateCertifiedHousingConstructionCredit(
      baseInput({ residenceYear: 2029 }),
    );

    expect(result.eligible).toBe(false);
    expect(result.ineligibleReason).toContain("適用期限");
  });

  it("ZEH水準省エネ住宅も認定住宅と同じ単価・限度額で計算される", () => {
    const certified = estimateCertifiedHousingConstructionCredit(
      baseInput({ housingType: "CERTIFIED" }),
    );
    const zeh = estimateCertifiedHousingConstructionCredit(baseInput({ housingType: "ZEH" }));

    expect(zeh.creditJpy.toNumber()).toBe(certified.creditJpy.toNumber());
  });

  it("負の床面積を入力するとエラーになる", () => {
    expect(() =>
      estimateCertifiedHousingConstructionCredit(baseInput({ floorAreaSqm: -1 })),
    ).toThrow();
  });

  it("この控除の適用前の所得税額を指定しない場合は全額を居住年で控除できるものと仮定する", () => {
    const result = estimateCertifiedHousingConstructionCredit(baseInput());

    expect(result.appliedJpy.toNumber()).toBe(result.creditJpy.toNumber());
    expect(result.carryforwardJpy.toNumber()).toBe(0);
  });

  it("控除適用前の所得税額が控除額以上の場合は繰越額は発生しない", () => {
    // creditJpy = 453,000円(baseInputの床面積100㎡)
    const result = estimateCertifiedHousingConstructionCredit(
      baseInput({ taxBeforeThisCreditJpy: 1_000_000 }),
    );

    expect(result.appliedJpy.toNumber()).toBe(453_000);
    expect(result.carryforwardJpy.toNumber()).toBe(0);
  });

  it("控除適用前の所得税額が控除額を下回る場合は差額が翌年繰越額になる", () => {
    // creditJpy = 453,000円 のうち200,000円しか居住年で控除できない
    const result = estimateCertifiedHousingConstructionCredit(
      baseInput({ taxBeforeThisCreditJpy: 200_000 }),
    );

    expect(result.appliedJpy.toNumber()).toBe(200_000);
    expect(result.carryforwardJpy.toNumber()).toBe(253_000);
    expect(result.notes.some((n) => n.includes("控除未済税額控除額"))).toBe(true);
  });

  it("控除適用前の所得税額が0円の場合は控除額全額が翌年繰越額になる", () => {
    const result = estimateCertifiedHousingConstructionCredit(
      baseInput({ taxBeforeThisCreditJpy: 0 }),
    );

    expect(result.appliedJpy.toNumber()).toBe(0);
    expect(result.carryforwardJpy.toNumber()).toBe(453_000);
  });
});
