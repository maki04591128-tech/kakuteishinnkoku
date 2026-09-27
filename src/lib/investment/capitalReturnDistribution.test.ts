import { Decimal } from "decimal.js";
import { describe, expect, it } from "vitest";
import { calculateCapitalReturnDistributions } from "./capitalReturnDistribution";

describe("calculateCapitalReturnDistributions", () => {
  it("大和ハウスリート投資法人第33期の実例と一致する(1口320,000円で10口保有、その他の利益超過分配金19円、払戻等割合0.001、みなし配当0円)", () => {
    // 大和ハウスリート投資法人「第33期 分配金の税務上の取扱いに関するご説明」
    // (2022年11月11日付)記載の設例。
    const result = calculateCapitalReturnDistributions(320_000, 10, [
      {
        label: "第33期",
        distributionPerUnitJpy: 19,
        deemedDividendPerUnitJpy: 0,
        paybackRatio: 0.001,
      },
    ]);

    const event = result.events[0];
    expect(event.deemedDividendJpy.toNumber()).toBe(0);
    expect(event.deemedTransferProceedsJpy.toNumber()).toBe(190);
    expect(event.deemedAcquisitionCostJpy.toNumber()).toBe(3_200);
    expect(event.deemedTransferGainLossJpy.toNumber()).toBe(190 - 3_200);
    expect(event.closingAcquisitionCostPerUnitJpy.toNumber()).toBe(319_680);
    expect(result.closingTotalAcquisitionCostJpy.toNumber()).toBe(3_196_800);
    expect(result.totalDeemedDividendJpy.toNumber()).toBe(0);
    expect(result.totalDeemedTransferGainLossJpy.toNumber()).toBe(-3_010);
  });

  it("平均取得価額が1口当たり分配額÷払戻等割合を下回るとみなし譲渡益になる", () => {
    // 大和ハウスリートの説明書が示す損益分岐点(19,000円 = 19円÷0.001)を下回る例。
    const result = calculateCapitalReturnDistributions(10_000, 1, [
      { distributionPerUnitJpy: 19, deemedDividendPerUnitJpy: 0, paybackRatio: 0.001 },
    ]);

    expect(result.events[0].deemedAcquisitionCostJpy.toNumber()).toBe(10); // 10,000 * 0.001
    expect(result.totalDeemedTransferGainLossJpy.toNumber()).toBe(9); // 19 - 10
  });

  it("みなし配当がある場合、みなし配当を除いた部分だけがみなし譲渡収入になる", () => {
    const result = calculateCapitalReturnDistributions(100_000, 1, [
      { distributionPerUnitJpy: 500, deemedDividendPerUnitJpy: 200, paybackRatio: 0.002 },
    ]);

    expect(result.events[0].deemedDividendJpy.toNumber()).toBe(200);
    expect(result.events[0].deemedTransferProceedsJpy.toNumber()).toBe(300);
    expect(result.events[0].deemedAcquisitionCostJpy.toNumber()).toBe(200); // 100,000 * 0.002
    expect(result.events[0].deemedTransferGainLossJpy.toNumber()).toBe(100);
    expect(result.events[0].closingAcquisitionCostPerUnitJpy.toNumber()).toBe(99_800);
  });

  it("複数回の出資等減少分配で取得価額が順次引き継がれる", () => {
    const result = calculateCapitalReturnDistributions(320_000, 10, [
      {
        label: "第33期",
        distributionPerUnitJpy: 19,
        deemedDividendPerUnitJpy: 0,
        paybackRatio: 0.001,
      },
      {
        label: "第34期",
        distributionPerUnitJpy: 25,
        deemedDividendPerUnitJpy: 0,
        paybackRatio: 0.0015,
      },
    ]);

    expect(result.events[1].openingAcquisitionCostPerUnitJpy.toNumber()).toBe(319_680);
    const expectedSecondCostPerUnit = new Decimal(319_680).times(0.0015);
    expect(result.events[1].deemedAcquisitionCostJpy.toNumber()).toBeCloseTo(
      expectedSecondCostPerUnit.times(10).toNumber(),
      6,
    );
    expect(result.closingAcquisitionCostPerUnitJpy.toNumber()).toBeCloseTo(
      new Decimal(319_680).minus(expectedSecondCostPerUnit).toNumber(),
      6,
    );
  });

  it("払戻等割合が0以上1以下でない場合はエラーになる", () => {
    expect(() =>
      calculateCapitalReturnDistributions(10_000, 1, [
        { distributionPerUnitJpy: 10, deemedDividendPerUnitJpy: 0, paybackRatio: 1.1 },
      ]),
    ).toThrow();
    expect(() =>
      calculateCapitalReturnDistributions(10_000, 1, [
        { distributionPerUnitJpy: 10, deemedDividendPerUnitJpy: 0, paybackRatio: -0.1 },
      ]),
    ).toThrow();
  });

  it("みなし配当額が出資等減少分配額を超える場合はエラーになる", () => {
    expect(() =>
      calculateCapitalReturnDistributions(10_000, 1, [
        { distributionPerUnitJpy: 10, deemedDividendPerUnitJpy: 20, paybackRatio: 0.01 },
      ]),
    ).toThrow();
  });

  it("保有口数が正の整数でない場合はエラーになる", () => {
    expect(() =>
      calculateCapitalReturnDistributions(10_000, 0, [
        { distributionPerUnitJpy: 10, deemedDividendPerUnitJpy: 0, paybackRatio: 0.01 },
      ]),
    ).toThrow();
  });

  it("課税口座(isNisa省略時)の場合、課税対象額は経済的な金額とそのまま一致する", () => {
    const result = calculateCapitalReturnDistributions(100_000, 1, [
      { distributionPerUnitJpy: 500, deemedDividendPerUnitJpy: 200, paybackRatio: 0.002 },
    ]);

    expect(result.isNisa).toBe(false);
    expect(result.events[0].taxableDeemedDividendJpy.toNumber()).toBe(200);
    expect(result.events[0].taxableDeemedTransferGainLossJpy.toNumber()).toBe(100);
    expect(result.totalTaxableDeemedDividendJpy.toNumber()).toBe(200);
    expect(result.totalTaxableDeemedTransferGainLossJpy.toNumber()).toBe(100);
  });

  it("NISA口座(isNisa=true)の場合、みなし配当・みなし譲渡益(黒字)は課税対象額が常に0円になる", () => {
    const result = calculateCapitalReturnDistributions(
      100_000,
      1,
      [{ distributionPerUnitJpy: 500, deemedDividendPerUnitJpy: 200, paybackRatio: 0.002 }],
      true,
    );

    expect(result.isNisa).toBe(true);
    // 経済的な金額(参考値)は課税口座の場合と変わらない
    expect(result.events[0].deemedDividendJpy.toNumber()).toBe(200);
    expect(result.events[0].deemedTransferGainLossJpy.toNumber()).toBe(100);
    // 課税対象額はNISAのため0円
    expect(result.events[0].taxableDeemedDividendJpy.toNumber()).toBe(0);
    expect(result.events[0].taxableDeemedTransferGainLossJpy.toNumber()).toBe(0);
    expect(result.totalTaxableDeemedDividendJpy.toNumber()).toBe(0);
    expect(result.totalTaxableDeemedTransferGainLossJpy.toNumber()).toBe(0);
    // 取得価額の減額調整自体はNISA口座かどうかにかかわらず同じ
    expect(result.closingAcquisitionCostPerUnitJpy.toNumber()).toBe(99_800);
  });

  it("NISA口座(isNisa=true)でみなし譲渡損(赤字)が生じる場合も課税対象額は0円になる(損失はなかったものとみなす)", () => {
    // 大和ハウスリート第33期の実例(損益分岐点19,000円を上回る取得価額でみなし譲渡損が生じる設例)
    const result = calculateCapitalReturnDistributions(
      320_000,
      10,
      [{ label: "第33期", distributionPerUnitJpy: 19, deemedDividendPerUnitJpy: 0, paybackRatio: 0.001 }],
      true,
    );

    expect(result.events[0].deemedTransferGainLossJpy.toNumber()).toBe(190 - 3_200);
    expect(result.events[0].taxableDeemedTransferGainLossJpy.toNumber()).toBe(0);
    expect(result.totalTaxableDeemedTransferGainLossJpy.toNumber()).toBe(0);
    // 経済的な合計値(参考値)は課税口座と同じ-3,010円のまま
    expect(result.totalDeemedTransferGainLossJpy.toNumber()).toBe(-3_010);
  });
});
