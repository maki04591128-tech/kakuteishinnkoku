import { describe, expect, it } from "vitest";
import { estimateInheritedAnnuityIncome } from "./inheritedAnnuityIncome";

describe("estimateInheritedAnnuityIncome", () => {
  it("国税庁タックスアンサーNo.1620の計算例(支払期間10年・評価割合90%・支払年数6年目)を計算する", () => {
    const result = estimateInheritedAnnuityIncome([
      {
        annualAnnuityAmountJpy: 1_000_000,
        inheritanceTaxValuationJpy: 9_000_000,
        totalScheduledPaymentJpy: 10_000_000,
        totalPremiumsPaidJpy: 2_000_000,
        remainingYearsAtAcquisition: 10,
        paymentYearNumber: 6,
      },
    ]);
    const contract = result.contracts[0];
    expect(contract.inheritanceTaxValuationRatio.toNumber()).toBe(0.9);
    expect(contract.taxableRatio.toNumber()).toBe(0.08);
    expect(contract.taxableUnits.toNumber()).toBe(45);
    expect(contract.elapsedYears).toBe(5);
    expect(contract.taxableUnitAmountJpy.toNumber()).toBeCloseTo(17_777.7778, 3);
    expect(contract.taxablePortionJpy.toNumber()).toBeCloseTo(88_888.8889, 3);
    expect(contract.nonTaxablePortionJpy.toNumber()).toBeCloseTo(911_111.1111, 3);
    expect(contract.necessaryExpenseRatio.toNumber()).toBe(0.2);
    expect(contract.necessaryExpenseJpy.toNumber()).toBeCloseTo(17_777.7778, 3);
    expect(contract.miscIncomeJpy.toNumber()).toBeCloseTo(71_111.1111, 3);
  });

  it("支給初年(支払年数1年目)は経過年数0のため全額非課税になる", () => {
    const result = estimateInheritedAnnuityIncome([
      {
        annualAnnuityAmountJpy: 1_000_000,
        inheritanceTaxValuationJpy: 9_000_000,
        totalScheduledPaymentJpy: 10_000_000,
        totalPremiumsPaidJpy: 2_000_000,
        remainingYearsAtAcquisition: 10,
        paymentYearNumber: 1,
      },
    ]);
    const contract = result.contracts[0];
    expect(contract.taxablePortionJpy.toNumber()).toBe(0);
    expect(contract.nonTaxablePortionJpy.toNumber()).toBe(1_000_000);
    expect(contract.miscIncomeJpy.toNumber()).toBe(0);
  });

  it("課税割合は相続税評価割合の速算表に応じて変わる(70%超75%以下は25%)", () => {
    const result = estimateInheritedAnnuityIncome([
      {
        annualAnnuityAmountJpy: 1_000_000,
        inheritanceTaxValuationJpy: 7_200_000,
        totalScheduledPaymentJpy: 10_000_000,
        totalPremiumsPaidJpy: 2_000_000,
        remainingYearsAtAcquisition: 5,
        paymentYearNumber: 3,
      },
    ]);
    expect(result.contracts[0].inheritanceTaxValuationRatio.toNumber()).toBe(0.72);
    expect(result.contracts[0].taxableRatio.toNumber()).toBe(0.25);
  });

  it("相続税評価割合が98%を超える場合は課税割合0%になる", () => {
    const result = estimateInheritedAnnuityIncome([
      {
        annualAnnuityAmountJpy: 1_000_000,
        inheritanceTaxValuationJpy: 9_900_000,
        totalScheduledPaymentJpy: 10_000_000,
        totalPremiumsPaidJpy: 2_000_000,
        remainingYearsAtAcquisition: 10,
        paymentYearNumber: 6,
      },
    ]);
    expect(result.contracts[0].taxableRatio.toNumber()).toBe(0);
    expect(result.contracts[0].miscIncomeJpy.toNumber()).toBe(0);
  });

  it("相続税評価割合がちょうど50%以下の場合はエラーになる(税務署への確認事項)", () => {
    expect(() =>
      estimateInheritedAnnuityIncome([
        {
          annualAnnuityAmountJpy: 1_000_000,
          inheritanceTaxValuationJpy: 5_000_000,
          totalScheduledPaymentJpy: 10_000_000,
          totalPremiumsPaidJpy: 2_000_000,
          remainingYearsAtAcquisition: 10,
          paymentYearNumber: 6,
        },
      ]),
    ).toThrow();
  });

  it("一課税単位当たりの金額の整数倍が年金の額を超える場合は上限が適用される(施行令185条2項1号6号)", () => {
    const result = estimateInheritedAnnuityIncome([
      {
        // 相続税評価割合 = 13,950,000/15,000,000 = 0.93 -> 課税割合5%
        // 課税部分総額 = 15,000,000 * 0.05 = 750,000、課税単位数 = 3*2/2 = 3
        // 一課税単位当たりの金額 = 250,000
        annualAnnuityAmountJpy: 500_000,
        inheritanceTaxValuationJpy: 13_950_000,
        totalScheduledPaymentJpy: 15_000_000,
        totalPremiumsPaidJpy: 3_000_000,
        remainingYearsAtAcquisition: 3,
        paymentYearNumber: 3,
      },
    ]);
    const contract = result.contracts[0];
    expect(contract.taxableUnitAmountJpy.toNumber()).toBe(250_000);
    // 経過年数2 * 250,000 = 500,000 (年金の額と同額) -> 500,000は「年金の額に満たない」を
    // 満たさないため、250,000(1倍)まで切り下げる
    expect(contract.taxablePortionJpy.toNumber()).toBe(250_000);
    expect(contract.nonTaxablePortionJpy.toNumber()).toBe(250_000);
  });

  it("複数契約の雑所得を合算する", () => {
    const result = estimateInheritedAnnuityIncome([
      {
        name: "A生命",
        annualAnnuityAmountJpy: 1_000_000,
        inheritanceTaxValuationJpy: 9_000_000,
        totalScheduledPaymentJpy: 10_000_000,
        totalPremiumsPaidJpy: 2_000_000,
        remainingYearsAtAcquisition: 10,
        paymentYearNumber: 6,
      },
      {
        name: "B生命",
        annualAnnuityAmountJpy: 1_000_000,
        inheritanceTaxValuationJpy: 9_000_000,
        totalScheduledPaymentJpy: 10_000_000,
        totalPremiumsPaidJpy: 2_000_000,
        remainingYearsAtAcquisition: 10,
        paymentYearNumber: 1,
      },
    ]);
    expect(result.contracts.map((c) => c.name)).toEqual(["A生命", "B生命"]);
    expect(result.totalMiscIncomeJpy.toNumber()).toBeCloseTo(71_111.1111, 3);
  });

  it("契約名を省略した場合は連番のラベルが付く", () => {
    const result = estimateInheritedAnnuityIncome([
      {
        annualAnnuityAmountJpy: 1_000_000,
        inheritanceTaxValuationJpy: 9_000_000,
        totalScheduledPaymentJpy: 10_000_000,
        totalPremiumsPaidJpy: 2_000_000,
        remainingYearsAtAcquisition: 10,
        paymentYearNumber: 6,
      },
    ]);
    expect(result.contracts[0].name).toBe("契約1");
  });

  it("年金の額が負の値だとエラーになる", () => {
    expect(() =>
      estimateInheritedAnnuityIncome([
        {
          annualAnnuityAmountJpy: -1,
          inheritanceTaxValuationJpy: 9_000_000,
          totalScheduledPaymentJpy: 10_000_000,
          totalPremiumsPaidJpy: 2_000_000,
          remainingYearsAtAcquisition: 10,
          paymentYearNumber: 6,
        },
      ]),
    ).toThrow();
  });

  it("相続税評価額が負の値だとエラーになる", () => {
    expect(() =>
      estimateInheritedAnnuityIncome([
        {
          annualAnnuityAmountJpy: 1_000_000,
          inheritanceTaxValuationJpy: -1,
          totalScheduledPaymentJpy: 10_000_000,
          totalPremiumsPaidJpy: 2_000_000,
          remainingYearsAtAcquisition: 10,
          paymentYearNumber: 6,
        },
      ]),
    ).toThrow();
  });

  it("支払総額が0以下だとエラーになる", () => {
    expect(() =>
      estimateInheritedAnnuityIncome([
        {
          annualAnnuityAmountJpy: 1_000_000,
          inheritanceTaxValuationJpy: 9_000_000,
          totalScheduledPaymentJpy: 0,
          totalPremiumsPaidJpy: 2_000_000,
          remainingYearsAtAcquisition: 10,
          paymentYearNumber: 6,
        },
      ]),
    ).toThrow();
  });

  it("残存期間年数が2未満だとエラーになる", () => {
    expect(() =>
      estimateInheritedAnnuityIncome([
        {
          annualAnnuityAmountJpy: 1_000_000,
          inheritanceTaxValuationJpy: 9_000_000,
          totalScheduledPaymentJpy: 10_000_000,
          totalPremiumsPaidJpy: 2_000_000,
          remainingYearsAtAcquisition: 1,
          paymentYearNumber: 1,
        },
      ]),
    ).toThrow();
  });

  it("支払年数が1未満だとエラーになる", () => {
    expect(() =>
      estimateInheritedAnnuityIncome([
        {
          annualAnnuityAmountJpy: 1_000_000,
          inheritanceTaxValuationJpy: 9_000_000,
          totalScheduledPaymentJpy: 10_000_000,
          totalPremiumsPaidJpy: 2_000_000,
          remainingYearsAtAcquisition: 10,
          paymentYearNumber: 0,
        },
      ]),
    ).toThrow();
  });

  it("支払年数が残存期間年数を超えるとエラーになる", () => {
    expect(() =>
      estimateInheritedAnnuityIncome([
        {
          annualAnnuityAmountJpy: 1_000_000,
          inheritanceTaxValuationJpy: 9_000_000,
          totalScheduledPaymentJpy: 10_000_000,
          totalPremiumsPaidJpy: 2_000_000,
          remainingYearsAtAcquisition: 10,
          paymentYearNumber: 11,
        },
      ]),
    ).toThrow();
  });

  it("残存期間年数・支払年数が整数でないとエラーになる", () => {
    expect(() =>
      estimateInheritedAnnuityIncome([
        {
          annualAnnuityAmountJpy: 1_000_000,
          inheritanceTaxValuationJpy: 9_000_000,
          totalScheduledPaymentJpy: 10_000_000,
          totalPremiumsPaidJpy: 2_000_000,
          remainingYearsAtAcquisition: 10.5,
          paymentYearNumber: 6,
        },
      ]),
    ).toThrow();
  });

  it("契約が0件なら合計は0円", () => {
    const result = estimateInheritedAnnuityIncome([]);
    expect(result.totalMiscIncomeJpy.toNumber()).toBe(0);
    expect(result.contracts).toHaveLength(0);
  });
});
