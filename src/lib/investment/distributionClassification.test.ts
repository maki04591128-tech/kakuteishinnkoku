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
});
