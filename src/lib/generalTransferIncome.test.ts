import { describe, expect, it } from "vitest";
import { estimateGeneralTransferIncome } from "./generalTransferIncome";

describe("estimateGeneralTransferIncome", () => {
  it("短期譲渡(自動車1台)のみ、残額が特別控除額50万円を超える場合", () => {
    // 譲渡価額200万円-取得費120万円-譲渡費用5万円=75万円、特別控除50万円を差し引くと25万円
    const result = estimateGeneralTransferIncome({
      items: [
        {
          description: "自動車",
          transferPriceJpy: 2_000_000,
          acquisitionCostJpy: 1_200_000,
          transferExpensesJpy: 50_000,
          ownershipYears: 3,
        },
      ],
    });
    expect(result.shortTermGainJpy.toNumber()).toBe(750_000);
    expect(result.longTermGainJpy.toNumber()).toBe(0);
    expect(result.specialDeductionShortTermJpy.toNumber()).toBe(500_000);
    expect(result.specialDeductionLongTermJpy.toNumber()).toBe(0);
    expect(result.shortTermIncomeJpy.toNumber()).toBe(250_000);
    expect(result.longTermIncomeJpy.toNumber()).toBe(0);
    expect(result.taxableAmountJpy.toNumber()).toBe(250_000);
  });

  it("長期譲渡(ゴルフ会員権、所有期間6年)は2分の1課税になる", () => {
    // 譲渡価額300万円-取得費100万円-譲渡費用10万円=190万円、特別控除50万円を差し引くと140万円、その1/2=70万円
    const result = estimateGeneralTransferIncome({
      items: [
        {
          description: "ゴルフ会員権",
          transferPriceJpy: 3_000_000,
          acquisitionCostJpy: 1_000_000,
          transferExpensesJpy: 100_000,
          ownershipYears: 6,
        },
      ],
    });
    expect(result.longTermGainJpy.toNumber()).toBe(1_900_000);
    expect(result.specialDeductionLongTermJpy.toNumber()).toBe(500_000);
    expect(result.longTermIncomeJpy.toNumber()).toBe(1_400_000);
    expect(result.taxableAmountJpy.toNumber()).toBe(700_000);
  });

  it("所有期間ちょうど5年は短期譲渡所得として扱う(5年超のみ長期)", () => {
    const result = estimateGeneralTransferIncome({
      items: [
        {
          description: "貴金属",
          transferPriceJpy: 1_000_000,
          acquisitionCostJpy: 400_000,
          transferExpensesJpy: 0,
          ownershipYears: 5,
        },
      ],
    });
    expect(result.shortTermGainJpy.toNumber()).toBe(600_000);
    expect(result.longTermGainJpy.toNumber()).toBe(0);
  });

  it("短期・長期が両方ある場合、特別控除は短期分から優先して充当する", () => {
    // 短期の残額20万円、長期の残額100万円。特別控除50万円のうち20万円を短期に、残り30万円を長期に充当
    const result = estimateGeneralTransferIncome({
      items: [
        {
          description: "短期資産",
          transferPriceJpy: 500_000,
          acquisitionCostJpy: 300_000,
          transferExpensesJpy: 0,
          ownershipYears: 2,
        },
        {
          description: "長期資産",
          transferPriceJpy: 2_000_000,
          acquisitionCostJpy: 1_000_000,
          transferExpensesJpy: 0,
          ownershipYears: 8,
        },
      ],
    });
    expect(result.shortTermGainJpy.toNumber()).toBe(200_000);
    expect(result.longTermGainJpy.toNumber()).toBe(1_000_000);
    expect(result.specialDeductionShortTermJpy.toNumber()).toBe(200_000);
    expect(result.specialDeductionLongTermJpy.toNumber()).toBe(300_000);
    expect(result.shortTermIncomeJpy.toNumber()).toBe(0);
    expect(result.longTermIncomeJpy.toNumber()).toBe(700_000);
    expect(result.taxableAmountJpy.toNumber()).toBe(350_000);
  });

  it("同一区分内で複数資産の譲渡益・譲渡損失を合算できる", () => {
    // 短期区分: 資産A +80万円、資産B -30万円 => 残額50万円
    const result = estimateGeneralTransferIncome({
      items: [
        {
          description: "資産A(益)",
          transferPriceJpy: 1_000_000,
          acquisitionCostJpy: 200_000,
          transferExpensesJpy: 0,
          ownershipYears: 1,
        },
        {
          description: "資産B(損)",
          transferPriceJpy: 200_000,
          acquisitionCostJpy: 500_000,
          transferExpensesJpy: 0,
          ownershipYears: 1,
        },
      ],
    });
    expect(result.shortTermGainJpy.toNumber()).toBe(500_000);
    expect(result.shortTermLossJpy.toNumber()).toBe(0);
  });

  it("区分内の合算結果が譲渡損失になった場合、残額は0円としてshortTermLossJpyに参考値を返す", () => {
    const result = estimateGeneralTransferIncome({
      items: [
        {
          description: "資産A(損)",
          transferPriceJpy: 100_000,
          acquisitionCostJpy: 400_000,
          transferExpensesJpy: 0,
          ownershipYears: 2,
        },
      ],
    });
    expect(result.shortTermGainJpy.toNumber()).toBe(0);
    expect(result.shortTermLossJpy.toNumber()).toBe(300_000);
    expect(result.specialDeductionShortTermJpy.toNumber()).toBe(0);
    expect(result.taxableAmountJpy.toNumber()).toBe(0);
  });

  it("残額が特別控除額50万円未満の場合は特別控除額もその金額に圧縮される", () => {
    const result = estimateGeneralTransferIncome({
      items: [
        {
          description: "自動車",
          transferPriceJpy: 500_000,
          acquisitionCostJpy: 200_000,
          transferExpensesJpy: 0,
          ownershipYears: 1,
        },
      ],
    });
    expect(result.shortTermGainJpy.toNumber()).toBe(300_000);
    expect(result.specialDeductionShortTermJpy.toNumber()).toBe(300_000);
    expect(result.shortTermIncomeJpy.toNumber()).toBe(0);
    expect(result.taxableAmountJpy.toNumber()).toBe(0);
  });

  it("入力資産が0件の場合はすべて0円", () => {
    const result = estimateGeneralTransferIncome({ items: [] });
    expect(result.shortTermGainJpy.toNumber()).toBe(0);
    expect(result.longTermGainJpy.toNumber()).toBe(0);
    expect(result.specialDeductionTotalJpy.toNumber()).toBe(0);
    expect(result.taxableAmountJpy.toNumber()).toBe(0);
  });

  it("譲渡価額が負の値だとエラーになる", () => {
    expect(() =>
      estimateGeneralTransferIncome({
        items: [
          {
            description: "自動車",
            transferPriceJpy: -1,
            acquisitionCostJpy: 0,
            transferExpensesJpy: 0,
            ownershipYears: 1,
          },
        ],
      }),
    ).toThrow();
  });

  it("取得費が負の値だとエラーになる", () => {
    expect(() =>
      estimateGeneralTransferIncome({
        items: [
          {
            description: "自動車",
            transferPriceJpy: 100_000,
            acquisitionCostJpy: -1,
            transferExpensesJpy: 0,
            ownershipYears: 1,
          },
        ],
      }),
    ).toThrow();
  });

  it("所有期間が負の値だとエラーになる", () => {
    expect(() =>
      estimateGeneralTransferIncome({
        items: [
          {
            description: "自動車",
            transferPriceJpy: 100_000,
            acquisitionCostJpy: 0,
            transferExpensesJpy: 0,
            ownershipYears: -1,
          },
        ],
      }),
    ).toThrow();
  });

  it("所有期間が整数でない場合はエラーになる", () => {
    expect(() =>
      estimateGeneralTransferIncome({
        items: [
          {
            description: "自動車",
            transferPriceJpy: 100_000,
            acquisitionCostJpy: 0,
            transferExpensesJpy: 0,
            ownershipYears: 1.5,
          },
        ],
      }),
    ).toThrow();
  });
});
