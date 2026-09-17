import { describe, expect, it } from "vitest";
import { estimateSmallBusinessMutualAidDeduction } from "./smallBusinessMutualAidDeduction";

function emptyInput() {
  return {
    idecoContributionJpy: 0,
    idecoParticipantCategory: "UNKNOWN" as const,
    smallBusinessMutualAidJpy: 0,
    dependentWithDisabilitiesMutualAidJpy: 0,
  };
}

describe("estimateSmallBusinessMutualAidDeduction", () => {
  it("3種類の掛金の合計額がそのまま控除額になる(上限なし)", () => {
    const result = estimateSmallBusinessMutualAidDeduction({
      idecoContributionJpy: 240_000,
      idecoParticipantCategory: "EMPLOYEE_DC_ONLY",
      smallBusinessMutualAidJpy: 840_000,
      dependentWithDisabilitiesMutualAidJpy: 12_000,
    });

    expect(result.deductionJpy.toNumber()).toBe(240_000 + 840_000 + 12_000);
  });

  it("入力が全て0円なら控除額も0円になる", () => {
    const result = estimateSmallBusinessMutualAidDeduction(emptyInput());

    expect(result.deductionJpy.toNumber()).toBe(0);
    expect(result.idecoAnnualLimitJpy).toBeNull();
    expect(result.idecoExceedsLimit).toBe(false);
  });

  it("自営業者等の年間拠出限度額は81.6万円", () => {
    const result = estimateSmallBusinessMutualAidDeduction({
      ...emptyInput(),
      idecoContributionJpy: 816_000,
      idecoParticipantCategory: "SELF_EMPLOYED",
    });

    expect(result.idecoAnnualLimitJpy?.toNumber()).toBe(816_000);
    expect(result.idecoExceedsLimit).toBe(false);
  });

  it("限度額を超える拠出額を入力すると警告フラグが立つ", () => {
    const result = estimateSmallBusinessMutualAidDeduction({
      ...emptyInput(),
      idecoContributionJpy: 300_000,
      idecoParticipantCategory: "EMPLOYEE_NO_PENSION",
    });

    expect(result.idecoAnnualLimitJpy?.toNumber()).toBe(276_000);
    expect(result.idecoExceedsLimit).toBe(true);
    // 控除額自体は限度超過でも入力額の全額(全額控除に上限判定は影響しない)
    expect(result.deductionJpy.toNumber()).toBe(300_000);
  });

  it("DB等加入の会社員は限度額を個別判定できないためnullになる", () => {
    const result = estimateSmallBusinessMutualAidDeduction({
      ...emptyInput(),
      idecoContributionJpy: 144_000,
      idecoParticipantCategory: "EMPLOYEE_WITH_DB",
    });

    expect(result.idecoAnnualLimitJpy).toBeNull();
    expect(result.idecoExceedsLimit).toBe(false);
  });

  it("公務員等の年間拠出限度額は24万円", () => {
    const result = estimateSmallBusinessMutualAidDeduction({
      ...emptyInput(),
      idecoContributionJpy: 240_000,
      idecoParticipantCategory: "PUBLIC_SERVANT",
    });

    expect(result.idecoAnnualLimitJpy?.toNumber()).toBe(240_000);
    expect(result.idecoExceedsLimit).toBe(false);
  });

  it("専業主婦(主夫)等の年間拠出限度額は27.6万円", () => {
    const result = estimateSmallBusinessMutualAidDeduction({
      ...emptyInput(),
      idecoContributionJpy: 276_000,
      idecoParticipantCategory: "DEPENDENT_SPOUSE",
    });

    expect(result.idecoAnnualLimitJpy?.toNumber()).toBe(276_000);
    expect(result.idecoExceedsLimit).toBe(false);
  });

  it("負の入力値はエラーになる", () => {
    expect(() =>
      estimateSmallBusinessMutualAidDeduction({
        ...emptyInput(),
        idecoContributionJpy: -1,
      }),
    ).toThrow();
    expect(() =>
      estimateSmallBusinessMutualAidDeduction({
        ...emptyInput(),
        smallBusinessMutualAidJpy: -1,
      }),
    ).toThrow();
    expect(() =>
      estimateSmallBusinessMutualAidDeduction({
        ...emptyInput(),
        dependentWithDisabilitiesMutualAidJpy: -1,
      }),
    ).toThrow();
  });
});
