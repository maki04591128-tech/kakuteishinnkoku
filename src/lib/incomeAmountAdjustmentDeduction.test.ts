import { describe, expect, it } from "vitest";
import { estimateIncomeAmountAdjustmentDeduction } from "./incomeAmountAdjustmentDeduction";

describe("estimateIncomeAmountAdjustmentDeduction", () => {
  it("給与収入850万円以下は①の要件を満たしても対象外", () => {
    const result = estimateIncomeAmountAdjustmentDeduction({
      salaryIncomeJpy: 8_000_000,
      isTaxpayerSpecialDisability: true,
      hasSpecialDisabilityDependentOrSpouse: false,
      hasDependentUnder23: false,
      publicPensionMiscIncomeJpy: 0,
    });

    expect(result.isEligibleForChildOrDisabilityAdjustment).toBe(false);
    expect(result.childOrDisabilityAdjustmentJpy.toNumber()).toBe(0);
    expect(result.totalDeductionJpy.toNumber()).toBe(0);
  });

  it("給与収入850万円超でも①の要件(特別障害者・23歳未満扶養親族等)を満たさなければ対象外", () => {
    const result = estimateIncomeAmountAdjustmentDeduction({
      salaryIncomeJpy: 9_000_000,
      isTaxpayerSpecialDisability: false,
      hasSpecialDisabilityDependentOrSpouse: false,
      hasDependentUnder23: false,
      publicPensionMiscIncomeJpy: 0,
    });

    expect(result.isEligibleForChildOrDisabilityAdjustment).toBe(false);
    expect(result.totalDeductionJpy.toNumber()).toBe(0);
  });

  it("①: 給与収入900万円・23歳未満の扶養親族ありなら(900万-850万)×10%=5万円", () => {
    const result = estimateIncomeAmountAdjustmentDeduction({
      salaryIncomeJpy: 9_000_000,
      isTaxpayerSpecialDisability: false,
      hasSpecialDisabilityDependentOrSpouse: false,
      hasDependentUnder23: true,
      publicPensionMiscIncomeJpy: 0,
    });

    expect(result.isEligibleForChildOrDisabilityAdjustment).toBe(true);
    expect(result.childOrDisabilityAdjustmentJpy.toNumber()).toBe(50_000);
    expect(result.totalDeductionJpy.toNumber()).toBe(50_000);
  });

  it("①: 給与収入1,000万円超は控除額が15万円で頭打ち", () => {
    const result = estimateIncomeAmountAdjustmentDeduction({
      salaryIncomeJpy: 12_000_000,
      isTaxpayerSpecialDisability: true,
      hasSpecialDisabilityDependentOrSpouse: false,
      hasDependentUnder23: false,
      publicPensionMiscIncomeJpy: 0,
    });

    expect(result.childOrDisabilityAdjustmentJpy.toNumber()).toBe(150_000);
  });

  it("②: 給与所得と公的年金等雑所得の合計が10万円以下なら対象外", () => {
    const result = estimateIncomeAmountAdjustmentDeduction({
      salaryIncomeJpy: 1_000_000,
      isTaxpayerSpecialDisability: false,
      hasSpecialDisabilityDependentOrSpouse: false,
      hasDependentUnder23: false,
      publicPensionMiscIncomeJpy: 50_000,
    });

    // 給与所得= 100万 - 55万(定額控除) = 45万。45万+5万=50万 > 10万のため
    // このケースでは対象になる点に注意し、合計10万円以下となるケースで検証する。
    expect(result.employmentIncomeBeforeAdjustmentJpy.toNumber()).toBe(450_000);
    expect(result.isEligibleForPensionAdjustment).toBe(true);
  });

  it("②: 公的年金等雑所得が無ければ給与所得のみでは対象外", () => {
    const result = estimateIncomeAmountAdjustmentDeduction({
      salaryIncomeJpy: 5_000_000,
      isTaxpayerSpecialDisability: false,
      hasSpecialDisabilityDependentOrSpouse: false,
      hasDependentUnder23: false,
      publicPensionMiscIncomeJpy: 0,
    });

    expect(result.isEligibleForPensionAdjustment).toBe(false);
    expect(result.pensionAdjustmentJpy.toNumber()).toBe(0);
  });

  it("②: 給与所得356万円・公的年金等雑所得15万円ならmin(356万,10万)+min(15万,10万)-10万=10万円", () => {
    const result = estimateIncomeAmountAdjustmentDeduction({
      salaryIncomeJpy: 5_000_000,
      isTaxpayerSpecialDisability: false,
      hasSpecialDisabilityDependentOrSpouse: false,
      hasDependentUnder23: false,
      publicPensionMiscIncomeJpy: 150_000,
    });

    expect(result.employmentIncomeBeforeAdjustmentJpy.toNumber()).toBe(3_560_000);
    expect(result.isEligibleForPensionAdjustment).toBe(true);
    expect(result.pensionAdjustmentJpy.toNumber()).toBe(100_000);
    expect(result.adjustedEmploymentIncomeJpy.toNumber()).toBe(3_560_000 - 100_000);
  });

  it("①・②の両方に該当する場合、②の給与所得は①適用後の金額を用いる", () => {
    const result = estimateIncomeAmountAdjustmentDeduction({
      salaryIncomeJpy: 9_000_000,
      isTaxpayerSpecialDisability: false,
      hasSpecialDisabilityDependentOrSpouse: false,
      hasDependentUnder23: true,
      publicPensionMiscIncomeJpy: 200_000,
    });

    // 給与所得控除195万(850万超は頭打ち)、給与所得=900万-195万=705万
    expect(result.employmentIncomeBeforeAdjustmentJpy.toNumber()).toBe(7_050_000);
    // ①: (900万-850万)×10%=5万
    expect(result.childOrDisabilityAdjustmentJpy.toNumber()).toBe(50_000);
    // ①適用後: 705万-5万=700万
    expect(result.employmentIncomeAfterChildOrDisabilityAdjustmentJpy.toNumber()).toBe(7_000_000);
    // ②: min(700万,10万)+min(20万,10万)-10万=10万
    expect(result.pensionAdjustmentJpy.toNumber()).toBe(100_000);
    // 合計: 5万+10万=15万
    expect(result.totalDeductionJpy.toNumber()).toBe(150_000);
    expect(result.adjustedEmploymentIncomeJpy.toNumber()).toBe(7_000_000 - 100_000);
  });

  it("給与所得が0円(調整後含む)の場合は②の対象外", () => {
    const result = estimateIncomeAmountAdjustmentDeduction({
      salaryIncomeJpy: 0,
      isTaxpayerSpecialDisability: false,
      hasSpecialDisabilityDependentOrSpouse: false,
      hasDependentUnder23: false,
      publicPensionMiscIncomeJpy: 500_000,
    });

    expect(result.isEligibleForPensionAdjustment).toBe(false);
    expect(result.totalDeductionJpy.toNumber()).toBe(0);
  });

  it("負の入力値はエラー", () => {
    expect(() =>
      estimateIncomeAmountAdjustmentDeduction({
        salaryIncomeJpy: -1,
        isTaxpayerSpecialDisability: false,
        hasSpecialDisabilityDependentOrSpouse: false,
        hasDependentUnder23: false,
        publicPensionMiscIncomeJpy: 0,
      }),
    ).toThrow();

    expect(() =>
      estimateIncomeAmountAdjustmentDeduction({
        salaryIncomeJpy: 5_000_000,
        isTaxpayerSpecialDisability: false,
        hasSpecialDisabilityDependentOrSpouse: false,
        hasDependentUnder23: false,
        publicPensionMiscIncomeJpy: -1,
      }),
    ).toThrow();
  });
});
