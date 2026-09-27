import { Decimal } from "decimal.js";
import { describe, expect, it } from "vitest";
import { classifyInvestmentTrustDistributions } from "./distributionClassification";

describe("classifyInvestmentTrustDistributions", () => {
  it("証券会社公表の設例と一致する(個別元本10,500円・基準価額10,800円・分配金600円)", () => {
    // 分配落ち後基準価額 = 10,800 - 600 = 10,200円 < 個別元本10,500円 なので
    // 特別分配金 = 10,500 - 10,200 = 300円、普通分配金 = 600 - 300 = 300円、
    // 分配後個別元本 = 10,200円 になる(各証券会社のFAQに掲載されている設例)。
    const result = classifyInvestmentTrustDistributions(10_500, 10_000, [
      { distributionPer10kUnitsJpy: 600, postDistributionNavPer10kUnitsJpy: 10_200 },
    ]);

    expect(result.events[0].taxableDistributionPer10kUnitsJpy.toNumber()).toBe(300);
    expect(result.events[0].nonTaxableDistributionPer10kUnitsJpy.toNumber()).toBe(300);
    expect(result.events[0].closingPrincipalPer10kUnitsJpy.toNumber()).toBe(10_200);
    expect(result.totalTaxableDistributionJpy.toNumber()).toBe(300);
    expect(result.totalNonTaxableDistributionJpy.toNumber()).toBe(300);
    expect(result.closingPrincipalPer10kUnitsJpy.toNumber()).toBe(10_200);
  });

  it("分配落ち後基準価額が個別元本以上の場合は全額が普通分配金になり個別元本は変わらない", () => {
    const result = classifyInvestmentTrustDistributions(10_000, 10_000, [
      { distributionPer10kUnitsJpy: 200, postDistributionNavPer10kUnitsJpy: 10_500 },
    ]);

    expect(result.events[0].taxableDistributionPer10kUnitsJpy.toNumber()).toBe(200);
    expect(result.events[0].nonTaxableDistributionPer10kUnitsJpy.toNumber()).toBe(0);
    expect(result.events[0].closingPrincipalPer10kUnitsJpy.toNumber()).toBe(10_000);
  });

  it("特別分配金は個別元本と基準価額の差額を上限とし、それを超える分配額は普通分配金になる", () => {
    // 個別元本10,000円、分配落ち後基準価額9,900円(差額100円)なのに分配金は500円
    // → 特別分配金は差額100円が上限、残り400円は普通分配金。
    const result = classifyInvestmentTrustDistributions(10_000, 10_000, [
      { distributionPer10kUnitsJpy: 500, postDistributionNavPer10kUnitsJpy: 9_900 },
    ]);

    expect(result.events[0].nonTaxableDistributionPer10kUnitsJpy.toNumber()).toBe(100);
    expect(result.events[0].taxableDistributionPer10kUnitsJpy.toNumber()).toBe(400);
    expect(result.events[0].closingPrincipalPer10kUnitsJpy.toNumber()).toBe(9_900);
  });

  it("複数回の分配で個別元本が順次引き継がれる", () => {
    const result = classifyInvestmentTrustDistributions(10_500, 10_000, [
      { label: "第1回", distributionPer10kUnitsJpy: 600, postDistributionNavPer10kUnitsJpy: 10_200 },
      { label: "第2回", distributionPer10kUnitsJpy: 300, postDistributionNavPer10kUnitsJpy: 10_150 },
    ]);

    // 第1回終了後の個別元本は10,200円。第2回: 分配落ち後基準価額10,150円 < 10,200円
    // なので特別分配金 = 10,200-10,150 = 50円、普通分配金 = 300-50 = 250円。
    expect(result.events[1].openingPrincipalPer10kUnitsJpy.toNumber()).toBe(10_200);
    expect(result.events[1].nonTaxableDistributionPer10kUnitsJpy.toNumber()).toBe(50);
    expect(result.events[1].taxableDistributionPer10kUnitsJpy.toNumber()).toBe(250);
    expect(result.closingPrincipalPer10kUnitsJpy.toNumber()).toBe(10_150);

    expect(result.totalTaxableDistributionJpy.toNumber()).toBe(300 + 250);
    expect(result.totalNonTaxableDistributionJpy.toNumber()).toBe(300 + 50);
  });

  it("保有口数が1万口以外の場合は口数に応じて実額に換算する", () => {
    // 保有口数25,000口(1万口当たりの2.5倍)
    const result = classifyInvestmentTrustDistributions(10_500, 25_000, [
      { distributionPer10kUnitsJpy: 600, postDistributionNavPer10kUnitsJpy: 10_200 },
    ]);

    expect(result.totalTaxableDistributionJpy.toNumber()).toBe(300 * 2.5);
    expect(result.totalNonTaxableDistributionJpy.toNumber()).toBe(300 * 2.5);
  });

  it("分配前個別元本・分配金額が負の場合はエラーになる", () => {
    expect(() =>
      classifyInvestmentTrustDistributions(-1, 10_000, [
        { distributionPer10kUnitsJpy: 100, postDistributionNavPer10kUnitsJpy: 100 },
      ]),
    ).toThrow();
    expect(() =>
      classifyInvestmentTrustDistributions(10_000, 10_000, [
        { distributionPer10kUnitsJpy: -1, postDistributionNavPer10kUnitsJpy: 100 },
      ]),
    ).toThrow();
  });

  it("保有口数が0以下または非整数の場合はエラーになる", () => {
    expect(() => classifyInvestmentTrustDistributions(10_000, 0, [])).toThrow();
    expect(() => classifyInvestmentTrustDistributions(10_000, 1.5, [])).toThrow();
  });

  it("分配イベントが無い場合は合計0で個別元本がそのまま返る", () => {
    const result = classifyInvestmentTrustDistributions(10_000, 10_000, []);
    expect(result.events).toHaveLength(0);
    expect(result.totalTaxableDistributionJpy.toNumber()).toBe(0);
    expect(result.totalNonTaxableDistributionJpy.toNumber()).toBe(0);
    expect(result.closingPrincipalPer10kUnitsJpy.toNumber()).toBe(10_000);
  });

  it("Decimal.Value型の入力を受け付ける", () => {
    const result = classifyInvestmentTrustDistributions(new Decimal(10_500), 10_000, [
      { distributionPer10kUnitsJpy: new Decimal(600), postDistributionNavPer10kUnitsJpy: new Decimal(10_200) },
    ]);
    expect(result.totalTaxableDistributionJpy.toNumber()).toBe(300);
  });

  it("追加購入時は口数加重平均で個別元本を再計算する(証券会社公表の設例: 10,000円×100万口→9,500円で100万口追加購入→9,750円)", () => {
    const result = classifyInvestmentTrustDistributions(10_000, 1_000_000, [
      { type: "PURCHASE", units: 1_000_000, pricePer10kUnitsJpy: 9_500 },
    ]);
    expect(result.closingPrincipalPer10kUnitsJpy.toNumber()).toBe(9_750);
    expect(result.closingHoldingUnits).toBe(2_000_000);
    expect(result.events).toHaveLength(0);
  });

  it("追加購入後の個別元本を用いて後続の分配を区分する", () => {
    const result = classifyInvestmentTrustDistributions(10_000, 1_000_000, [
      { type: "PURCHASE", label: "買い増し", units: 1_000_000, pricePer10kUnitsJpy: 9_500 },
      { label: "決算", distributionPer10kUnitsJpy: 100, postDistributionNavPer10kUnitsJpy: 9_700 },
    ]);

    // 追加購入後の個別元本9,750円、分配落ち後基準価額9,700円 < 9,750円なので
    // 特別分配金 = min(100, 9,750-9,700) = 50円、普通分配金 = 50円。
    expect(result.events[0].openingPrincipalPer10kUnitsJpy.toNumber()).toBe(9_750);
    expect(result.events[0].holdingUnits).toBe(2_000_000);
    expect(result.events[0].nonTaxableDistributionPer10kUnitsJpy.toNumber()).toBe(50);
    expect(result.events[0].taxableDistributionPer10kUnitsJpy.toNumber()).toBe(50);
    // 保有口数2,000,000口(1万口当たりの200倍)換算
    expect(result.events[0].taxableDistributionJpy.toNumber()).toBe(50 * 200);
    expect(result.events[0].nonTaxableDistributionJpy.toNumber()).toBe(50 * 200);
  });

  it("一部解約は保有口数のみ減少させ、1万口当たりの個別元本は変わらない", () => {
    const result = classifyInvestmentTrustDistributions(10_500, 20_000, [
      { type: "REDEMPTION", label: "一部解約", units: 10_000 },
      { distributionPer10kUnitsJpy: 600, postDistributionNavPer10kUnitsJpy: 10_200 },
    ]);

    expect(result.closingHoldingUnits).toBe(10_000);
    expect(result.events[0].openingPrincipalPer10kUnitsJpy.toNumber()).toBe(10_500);
    expect(result.events[0].holdingUnits).toBe(10_000);
    // 1万口当たりの区分額は口数に依存しない(通常の分配と同じ結果)
    expect(result.events[0].taxableDistributionPer10kUnitsJpy.toNumber()).toBe(300);
    expect(result.events[0].nonTaxableDistributionPer10kUnitsJpy.toNumber()).toBe(300);
    // 実額は解約後の保有口数(10,000口=1万口当たりの1.0倍)で換算する
    expect(result.events[0].taxableDistributionJpy.toNumber()).toBe(300);
  });

  it("一部解約口数が保有口数を超える場合はエラーになる", () => {
    expect(() =>
      classifyInvestmentTrustDistributions(10_000, 10_000, [
        { type: "REDEMPTION", units: 10_001 },
      ]),
    ).toThrow();
  });

  it("追加購入口数・一部解約口数が0以下または非整数の場合はエラーになる", () => {
    expect(() =>
      classifyInvestmentTrustDistributions(10_000, 10_000, [
        { type: "PURCHASE", units: 0, pricePer10kUnitsJpy: 10_000 },
      ]),
    ).toThrow();
    expect(() =>
      classifyInvestmentTrustDistributions(10_000, 10_000, [
        { type: "REDEMPTION", units: 1.5 },
      ]),
    ).toThrow();
  });

  it("追加購入・一部解約・分配を組み合わせた一連の時系列を処理できる", () => {
    const result = classifyInvestmentTrustDistributions(10_500, 10_000, [
      { label: "第1回分配", distributionPer10kUnitsJpy: 600, postDistributionNavPer10kUnitsJpy: 10_200 },
      { type: "PURCHASE", units: 10_000, pricePer10kUnitsJpy: 10_000 },
      { type: "REDEMPTION", units: 5_000 },
      { label: "第2回分配", distributionPer10kUnitsJpy: 300, postDistributionNavPer10kUnitsJpy: 10_050 },
    ]);

    // 第1回分配後の個別元本: 10,200円。
    // 追加購入(10,000口を10,000円で): (10,200*10,000/10,000 + 10,000*10,000/10,000) * 10,000 / 20,000 = 10,100円。
    // 一部解約(5,000口): 個別元本は変わらず10,100円、保有口数15,000口。
    expect(result.events[1].openingPrincipalPer10kUnitsJpy.toNumber()).toBe(10_100);
    expect(result.events[1].holdingUnits).toBe(15_000);
    // 分配落ち後基準価額10,050円 < 10,100円 なので特別分配金 = min(300, 50) = 50円、普通分配金 = 250円。
    expect(result.events[1].nonTaxableDistributionPer10kUnitsJpy.toNumber()).toBe(50);
    expect(result.events[1].taxableDistributionPer10kUnitsJpy.toNumber()).toBe(250);
    expect(result.closingHoldingUnits).toBe(15_000);
  });
});
