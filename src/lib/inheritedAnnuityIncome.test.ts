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

  it("相続税評価割合が50%以下の確定年金(特定期間内)を施行令185条2項1号ロにより計算する", () => {
    // 相続税評価割合 = 3,000,000/10,000,000 = 0.3(30%) -> 特定期間算出割合60%
    // 特定期間年数 = 10×0.6-1 = 5(端数なし)、総単位数 = 10×5 = 50
    // 一単位当たりの金額 = 10,000,000×100%/50 = 200,000
    // 経過年数3(支払年数4年目) <= 特定期間年数5 -> 200,000×3 = 600,000
    const result = estimateInheritedAnnuityIncome([
      {
        annualAnnuityAmountJpy: 2_000_000,
        inheritanceTaxValuationJpy: 3_000_000,
        totalScheduledPaymentJpy: 10_000_000,
        totalPremiumsPaidJpy: 2_000_000,
        remainingYearsAtAcquisition: 10,
        paymentYearNumber: 4,
      },
    ]);
    const contract = result.contracts[0];
    expect(contract.inheritanceTaxValuationRatio.toNumber()).toBe(0.3);
    expect(contract.taxableRatio.toNumber()).toBe(1);
    expect(contract.specificPeriodYears).toBe(5);
    expect(contract.taxableUnits.toNumber()).toBe(50);
    expect(contract.taxableUnitAmountJpy.toNumber()).toBe(200_000);
    expect(contract.taxablePortionJpy.toNumber()).toBe(600_000);
    expect(contract.nonTaxablePortionJpy.toNumber()).toBe(1_400_000);
    expect(contract.necessaryExpenseRatio.toNumber()).toBe(0.2);
    expect(contract.necessaryExpenseJpy.toNumber()).toBe(120_000);
    expect(contract.miscIncomeJpy.toNumber()).toBe(480_000);
  });

  it("相続税評価割合が50%以下の確定年金は、特定期間終了後は「一単位当たりの金額×特定期間年数-1円」で頭打ちになる", () => {
    // 特定期間年数5年(上と同じ契約)に対し、経過年数6(支払年数7年目、特定期間終了後)
    const withinPeriod = estimateInheritedAnnuityIncome([
      {
        annualAnnuityAmountJpy: 2_000_000,
        inheritanceTaxValuationJpy: 3_000_000,
        totalScheduledPaymentJpy: 10_000_000,
        totalPremiumsPaidJpy: 2_000_000,
        remainingYearsAtAcquisition: 10,
        paymentYearNumber: 6, // 経過年数5(特定期間年数と同じ、特定期間内の最終年)
      },
    ]).contracts[0];
    expect(withinPeriod.taxablePortionJpy.toNumber()).toBe(1_000_000); // 200,000×5

    const afterPeriod = estimateInheritedAnnuityIncome([
      {
        annualAnnuityAmountJpy: 2_000_000,
        inheritanceTaxValuationJpy: 3_000_000,
        totalScheduledPaymentJpy: 10_000_000,
        totalPremiumsPaidJpy: 2_000_000,
        remainingYearsAtAcquisition: 10,
        paymentYearNumber: 7, // 経過年数6(特定期間年数5を超える)
      },
    ]).contracts[0];
    expect(afterPeriod.taxablePortionJpy.toNumber()).toBe(999_999); // 200,000×5-1

    const stillAfterPeriod = estimateInheritedAnnuityIncome([
      {
        annualAnnuityAmountJpy: 2_000_000,
        inheritanceTaxValuationJpy: 3_000_000,
        totalScheduledPaymentJpy: 10_000_000,
        totalPremiumsPaidJpy: 2_000_000,
        remainingYearsAtAcquisition: 10,
        paymentYearNumber: 10, // 経過年数9でも一定額のまま増加しない
      },
    ]).contracts[0];
    expect(stillAfterPeriod.taxablePortionJpy.toNumber()).toBe(999_999);
  });

  it("特定期間年数の計算で1年未満の端数が生じる場合は切り上げる(施行令185条3項5号)", () => {
    // 相続税評価割合10%以下 -> 特定期間算出割合20%、残存期間年数7
    // 特定期間年数 = 7×0.2-1 = 0.4 -> 切り上げて1
    const result = estimateInheritedAnnuityIncome([
      {
        annualAnnuityAmountJpy: 100_000,
        inheritanceTaxValuationJpy: 500_000,
        totalScheduledPaymentJpy: 10_000_000,
        totalPremiumsPaidJpy: 2_000_000,
        remainingYearsAtAcquisition: 7,
        paymentYearNumber: 1,
      },
    ]);
    expect(result.contracts[0].inheritanceTaxValuationRatio.toNumber()).toBe(0.05);
    expect(result.contracts[0].specificPeriodYears).toBe(1);
    expect(result.contracts[0].taxableUnits.toNumber()).toBe(7);
  });

  it("相続税評価割合が低く残存期間年数が短いため特定期間年数が1年未満になる場合はエラーになる", () => {
    // 相続税評価割合10%以下(特定期間算出割合20%)×残存期間年数2 - 1 = -0.6 -> 切り上げても0
    expect(() =>
      estimateInheritedAnnuityIncome([
        {
          annualAnnuityAmountJpy: 100_000,
          inheritanceTaxValuationJpy: 100_000,
          totalScheduledPaymentJpy: 10_000_000,
          totalPremiumsPaidJpy: 2_000_000,
          remainingYearsAtAcquisition: 2,
          paymentYearNumber: 1,
        },
      ]),
    ).toThrow();
  });

  it("相続税評価割合がちょうど50%の場合は50%以下の計算方法(施行令185条2項1号ロ)が適用される", () => {
    const result = estimateInheritedAnnuityIncome([
      {
        annualAnnuityAmountJpy: 2_000_000,
        inheritanceTaxValuationJpy: 5_000_000,
        totalScheduledPaymentJpy: 10_000_000,
        totalPremiumsPaidJpy: 2_000_000,
        remainingYearsAtAcquisition: 10,
        paymentYearNumber: 4,
      },
    ]);
    expect(result.contracts[0].inheritanceTaxValuationRatio.toNumber()).toBe(0.5);
    expect(result.contracts[0].taxableRatio.toNumber()).toBe(1);
    // 特定期間算出割合100%(40%超50%以下) -> 特定期間年数 = 10×1-1 = 9
    expect(result.contracts[0].specificPeriodYears).toBe(9);
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

  it("剰余金・割戻金の額は必要経費控除の対象外でそのまま雑所得に加算する(施行令185条2項7号)", () => {
    const withoutSurplus = estimateInheritedAnnuityIncome([
      {
        annualAnnuityAmountJpy: 1_000_000,
        inheritanceTaxValuationJpy: 9_000_000,
        totalScheduledPaymentJpy: 10_000_000,
        totalPremiumsPaidJpy: 2_000_000,
        remainingYearsAtAcquisition: 10,
        paymentYearNumber: 6,
      },
    ]).contracts[0];
    const withSurplus = estimateInheritedAnnuityIncome([
      {
        annualAnnuityAmountJpy: 1_000_000,
        inheritanceTaxValuationJpy: 9_000_000,
        totalScheduledPaymentJpy: 10_000_000,
        totalPremiumsPaidJpy: 2_000_000,
        remainingYearsAtAcquisition: 10,
        paymentYearNumber: 6,
        surplusDistributionJpy: 30_000,
      },
    ]).contracts[0];
    // 剰余金は必要経費の計算(必要経費割合・課税部分の年金収入額)には影響せず、雑所得にのみ加算される
    expect(withSurplus.necessaryExpenseRatio.toNumber()).toBe(
      withoutSurplus.necessaryExpenseRatio.toNumber(),
    );
    expect(withSurplus.necessaryExpenseJpy.toNumber()).toBeCloseTo(
      withoutSurplus.necessaryExpenseJpy.toNumber(),
      6,
    );
    expect(withSurplus.miscIncomeJpy.toNumber()).toBeCloseTo(
      withoutSurplus.miscIncomeJpy.toNumber() + 30_000,
      6,
    );
  });

  it("年金のほか一時金も支払う契約の場合、保険料総額を支払総額の按分比率で調整する(施行令185条2項が準用する1項10号)", () => {
    const result = estimateInheritedAnnuityIncome([
      {
        annualAnnuityAmountJpy: 1_000_000,
        inheritanceTaxValuationJpy: 9_000_000,
        totalScheduledPaymentJpy: 10_000_000,
        totalPremiumsPaidJpy: 3_000_000,
        remainingYearsAtAcquisition: 10,
        paymentYearNumber: 6,
        lumpSumAmountJpy: 5_000_000,
      },
    ]);
    const contract = result.contracts[0];
    // 按分後の保険料総額 = 3,000,000 * 10,000,000 / (10,000,000+5,000,000) = 2,000,000
    // 必要経費割合 = 2,000,000 / 10,000,000 = 0.2(端数なし)
    expect(contract.necessaryExpenseRatio.toNumber()).toBe(0.2);
    expect(contract.taxablePortionJpy.toNumber()).toBeCloseTo(88_888.8889, 3);
    expect(contract.necessaryExpenseJpy.toNumber()).toBeCloseTo(17_777.7778, 3);
    expect(contract.miscIncomeJpy.toNumber()).toBeCloseTo(71_111.1111, 3);
  });

  it("一時金の額が負の値だとエラーになる", () => {
    expect(() =>
      estimateInheritedAnnuityIncome([
        {
          annualAnnuityAmountJpy: 1_000_000,
          inheritanceTaxValuationJpy: 9_000_000,
          totalScheduledPaymentJpy: 10_000_000,
          totalPremiumsPaidJpy: 2_000_000,
          remainingYearsAtAcquisition: 10,
          paymentYearNumber: 6,
          lumpSumAmountJpy: -1,
        },
      ]),
    ).toThrow();
  });

  it("剰余金・割戻金の額が負の値だとエラーになる", () => {
    expect(() =>
      estimateInheritedAnnuityIncome([
        {
          annualAnnuityAmountJpy: 1_000_000,
          inheritanceTaxValuationJpy: 9_000_000,
          totalScheduledPaymentJpy: 10_000_000,
          totalPremiumsPaidJpy: 2_000_000,
          remainingYearsAtAcquisition: 10,
          paymentYearNumber: 6,
          surplusDistributionJpy: -1,
        },
      ]),
    ).toThrow();
  });

  it("支払を受けた月数を省略すると12か月(満額)として計算される(従来どおり)", () => {
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
    expect(result.contracts[0].paymentMonthsInYear).toBe(12);
    expect(result.contracts[0].taxablePortionJpy.toNumber()).toBeCloseTo(88_888.8889, 3);
  });

  it("年の途中で年金の支払が終了した場合、支払年金対応額を月数÷12で月割計算する(施行令185条1項1号イ)", () => {
    // 国税庁タックスアンサーNo.1620の計算例(評価割合90%・支払年数6年目)と同じ契約で、
    // その年に6か月分しか支払を受けなかった場合、月割前の金額(88,888.8889)の6/12になる
    const fullYear = estimateInheritedAnnuityIncome([
      {
        annualAnnuityAmountJpy: 1_000_000,
        inheritanceTaxValuationJpy: 9_000_000,
        totalScheduledPaymentJpy: 10_000_000,
        totalPremiumsPaidJpy: 2_000_000,
        remainingYearsAtAcquisition: 10,
        paymentYearNumber: 6,
      },
    ]).contracts[0];
    const halfYear = estimateInheritedAnnuityIncome([
      {
        annualAnnuityAmountJpy: 500_000,
        inheritanceTaxValuationJpy: 9_000_000,
        totalScheduledPaymentJpy: 10_000_000,
        totalPremiumsPaidJpy: 2_000_000,
        remainingYearsAtAcquisition: 10,
        paymentYearNumber: 6,
        paymentMonthsInYear: 6,
      },
    ]).contracts[0];
    expect(halfYear.paymentMonthsInYear).toBe(6);
    expect(halfYear.taxablePortionJpy.toNumber()).toBeCloseTo(
      fullYear.taxablePortionJpy.toNumber() / 2,
      6,
    );
    expect(halfYear.nonTaxablePortionJpy.toNumber()).toBeCloseTo(500_000 - 44_444.4445, 3);
  });

  it("月割後は必要経費の金額も月割後の課税部分の年金収入額を基準に計算される", () => {
    const halfYear = estimateInheritedAnnuityIncome([
      {
        annualAnnuityAmountJpy: 500_000,
        inheritanceTaxValuationJpy: 9_000_000,
        totalScheduledPaymentJpy: 10_000_000,
        totalPremiumsPaidJpy: 2_000_000,
        remainingYearsAtAcquisition: 10,
        paymentYearNumber: 6,
        paymentMonthsInYear: 6,
      },
    ]).contracts[0];
    // 必要経費割合は従来どおり0.2(月割の影響を受けない)。必要経費額は月割後の課税部分に0.2を乗じる
    expect(halfYear.necessaryExpenseRatio.toNumber()).toBe(0.2);
    expect(halfYear.necessaryExpenseJpy.toNumber()).toBeCloseTo(
      halfYear.taxablePortionJpy.toNumber() * 0.2,
      6,
    );
  });

  it("2項6号の頭打ちも月割後の一課税単位当たりの金額を基準に判定する", () => {
    // 一課税単位当たりの金額=250,000(施行令185条2項1号6号のテストと同じ契約)。
    // 12か月なら経過年数2の生の金額500,000が年金の額500,000以上で頭打ち(1倍=250,000)になるが、
    // 3か月しか支払を受けなかった場合は月割後の一課税単位当たりの金額=62,500になり、
    // 月割後の生の支払年金対応額(125,000)がその年に支払を受けた年金の額(100,000)以上のため
    // 頭打みが働き、62,500(1倍)が課税部分になる
    const result = estimateInheritedAnnuityIncome([
      {
        annualAnnuityAmountJpy: 100_000,
        inheritanceTaxValuationJpy: 13_950_000,
        totalScheduledPaymentJpy: 15_000_000,
        totalPremiumsPaidJpy: 3_000_000,
        remainingYearsAtAcquisition: 3,
        paymentYearNumber: 3,
        paymentMonthsInYear: 3,
      },
    ]);
    const contract = result.contracts[0];
    expect(contract.taxableUnitAmountJpy.toNumber()).toBe(250_000);
    expect(contract.taxablePortionJpy.toNumber()).toBe(62_500);
    expect(contract.nonTaxablePortionJpy.toNumber()).toBe(37_500);
  });

  it("支払を受けた月数が1未満または13以上、あるいは整数でない場合はエラーになる", () => {
    const base = {
      annualAnnuityAmountJpy: 1_000_000,
      inheritanceTaxValuationJpy: 9_000_000,
      totalScheduledPaymentJpy: 10_000_000,
      totalPremiumsPaidJpy: 2_000_000,
      remainingYearsAtAcquisition: 10,
      paymentYearNumber: 6,
    };
    expect(() =>
      estimateInheritedAnnuityIncome([{ ...base, paymentMonthsInYear: 0 }]),
    ).toThrow();
    expect(() =>
      estimateInheritedAnnuityIncome([{ ...base, paymentMonthsInYear: 13 }]),
    ).toThrow();
    expect(() =>
      estimateInheritedAnnuityIncome([{ ...base, paymentMonthsInYear: 6.5 }]),
    ).toThrow();
  });

  it("契約が0件なら合計は0円", () => {
    const result = estimateInheritedAnnuityIncome([]);
    expect(result.totalMiscIncomeJpy.toNumber()).toBe(0);
    expect(result.contracts).toHaveLength(0);
  });

  it("当初年金受取人と現在の受取人が異なる場合、必要経費の割合は当初年金受取人自身の支払総額を分母に計算する(施行令185条2項が準用する1項9号・機能150)", () => {
    const result = estimateInheritedAnnuityIncome([
      {
        // 課税部分の計算(1号〜6号)は本人基準の支払総額・残存期間年数のまま変わらないため、
        // 国税庁タックスアンサーNo.1620の計算例と同じtaxablePortionJpy(88,888.8889)になる。
        annualAnnuityAmountJpy: 1_000_000,
        inheritanceTaxValuationJpy: 9_000_000,
        totalScheduledPaymentJpy: 10_000_000,
        totalPremiumsPaidJpy: 3_000_000,
        remainingYearsAtAcquisition: 10,
        paymentYearNumber: 6,
        // 当初年金受取人自身の支払総額(契約全体の当初の支払総額。二次相続で本人が引き継いだ
        // 時点では残存分の10,000,000円に縮小していたと仮定)
        originalRecipientTotalScheduledPaymentJpy: 20_000_000,
      },
    ]);
    const contract = result.contracts[0];
    expect(contract.usesOriginalRecipientRatio).toBe(true);
    expect(contract.taxablePortionJpy.toNumber()).toBeCloseTo(88_888.8889, 3);
    // 必要経費割合 = 3,000,000 / 20,000,000 = 0.15(本人の支払総額10,000,000を分母にすると
    // 0.3になってしまい過大になる)
    expect(contract.necessaryExpenseRatio.toNumber()).toBe(0.15);
    expect(contract.necessaryExpenseJpy.toNumber()).toBeCloseTo(13_333.3333, 3);
    expect(contract.miscIncomeJpy.toNumber()).toBeCloseTo(75_555.5556, 3);
  });

  it("originalRecipientTotalScheduledPaymentJpyを省略すると、当初年金受取人=現在の受取人であるケース(1項8号)として従来どおり計算される", () => {
    const result = estimateInheritedAnnuityIncome([
      {
        annualAnnuityAmountJpy: 1_000_000,
        inheritanceTaxValuationJpy: 9_000_000,
        totalScheduledPaymentJpy: 10_000_000,
        totalPremiumsPaidJpy: 3_000_000,
        remainingYearsAtAcquisition: 10,
        paymentYearNumber: 6,
      },
    ]);
    const contract = result.contracts[0];
    expect(contract.usesOriginalRecipientRatio).toBe(false);
    expect(contract.necessaryExpenseRatio.toNumber()).toBe(0.3);
  });

  it("当初年金受取人自身の支払総額が0以下だとエラーになる", () => {
    expect(() =>
      estimateInheritedAnnuityIncome([
        {
          annualAnnuityAmountJpy: 1_000_000,
          inheritanceTaxValuationJpy: 9_000_000,
          totalScheduledPaymentJpy: 10_000_000,
          totalPremiumsPaidJpy: 3_000_000,
          remainingYearsAtAcquisition: 10,
          paymentYearNumber: 6,
          originalRecipientTotalScheduledPaymentJpy: 0,
        },
      ]),
    ).toThrow();
  });

  it("当初年金受取人が異なり、かつ一時金も支払う契約の場合、1項10号の按分も当初年金受取人自身の支払総額を基準にする", () => {
    const result = estimateInheritedAnnuityIncome([
      {
        annualAnnuityAmountJpy: 1_000_000,
        inheritanceTaxValuationJpy: 9_000_000,
        totalScheduledPaymentJpy: 10_000_000,
        totalPremiumsPaidJpy: 3_000_000,
        remainingYearsAtAcquisition: 10,
        paymentYearNumber: 6,
        lumpSumAmountJpy: 5_000_000,
        originalRecipientTotalScheduledPaymentJpy: 20_000_000,
      },
    ]);
    const contract = result.contracts[0];
    // 按分後の保険料総額 = 3,000,000 * 20,000,000 / (20,000,000+5,000,000) = 2,400,000
    // 必要経費割合 = 2,400,000 / 20,000,000 = 0.12
    expect(contract.necessaryExpenseRatio.toNumber()).toBe(0.12);
  });
});
