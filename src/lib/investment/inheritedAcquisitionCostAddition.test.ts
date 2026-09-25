import { describe, expect, it } from "vitest";
import { estimateInheritedAcquisitionCostAddition } from "./inheritedAcquisitionCostAddition";

describe("estimateInheritedAcquisitionCostAddition", () => {
  it("計算例(相続税額400万円・課税価格1億円・評価額4,000万円・譲渡益800万円)で加算額160万円", () => {
    // 出典: 税理士監修の解説記事の計算例。400万円×4,000万円/1億円=160万円。
    const result = estimateInheritedAcquisitionCostAddition({
      inheritanceTaxJpy: 4_000_000,
      taxableBaseJpy: 100_000_000,
      transfers: [
        {
          label: "A社株式",
          inheritedValuationJpy: 40_000_000,
          transferGainJpy: 8_000_000,
          withinDeadline: true,
        },
      ],
    });
    expect(result.transfers[0].proportionalAdditionJpy.toNumber()).toBe(1_600_000);
    expect(result.transfers[0].additionJpy.toNumber()).toBe(1_600_000);
    expect(result.transfers[0].cappedByGain).toBe(false);
    expect(result.totalAdditionJpy.toNumber()).toBe(1_600_000);
  });

  it("按分計算額が譲渡益を超える場合は譲渡益相当額が上限になる", () => {
    const result = estimateInheritedAcquisitionCostAddition({
      inheritanceTaxJpy: 10_000_000,
      taxableBaseJpy: 50_000_000,
      transfers: [
        {
          inheritedValuationJpy: 40_000_000,
          transferGainJpy: 1_000_000,
          withinDeadline: true,
        },
      ],
    });
    // 按分計算額 = 1,000万円×4,000万円/5,000万円 = 800万円 > 譲渡益100万円
    expect(result.transfers[0].proportionalAdditionJpy.toNumber()).toBe(8_000_000);
    expect(result.transfers[0].additionJpy.toNumber()).toBe(1_000_000);
    expect(result.transfers[0].cappedByGain).toBe(true);
  });

  it("譲渡損失(譲渡益がマイナス)の場合は加算額0円", () => {
    const result = estimateInheritedAcquisitionCostAddition({
      inheritanceTaxJpy: 4_000_000,
      taxableBaseJpy: 100_000_000,
      transfers: [
        {
          inheritedValuationJpy: 40_000_000,
          transferGainJpy: -500_000,
          withinDeadline: true,
        },
      ],
    });
    expect(result.transfers[0].additionJpy.toNumber()).toBe(0);
    expect(result.transfers[0].cappedByGain).toBe(true);
  });

  it("適用期限内でない(withinDeadline=false)場合は加算額0円", () => {
    const result = estimateInheritedAcquisitionCostAddition({
      inheritanceTaxJpy: 4_000_000,
      taxableBaseJpy: 100_000_000,
      transfers: [
        {
          inheritedValuationJpy: 40_000_000,
          transferGainJpy: 8_000_000,
          withinDeadline: false,
        },
      ],
    });
    expect(result.transfers[0].proportionalAdditionJpy.toNumber()).toBe(1_600_000);
    expect(result.transfers[0].additionJpy.toNumber()).toBe(0);
  });

  it("複数の譲渡財産をそれぞれ按分・上限適用してから合計する", () => {
    const result = estimateInheritedAcquisitionCostAddition({
      inheritanceTaxJpy: 9_000_000,
      taxableBaseJpy: 90_000_000,
      transfers: [
        {
          label: "A社株式",
          inheritedValuationJpy: 30_000_000,
          transferGainJpy: 10_000_000,
          withinDeadline: true,
        },
        {
          label: "B投資信託",
          inheritedValuationJpy: 60_000_000,
          transferGainJpy: 1_000_000,
          withinDeadline: true,
        },
      ],
    });
    // A: 900万×3,000万/9,000万=300万円(譲渡益1,000万円以下のためそのまま)
    // B: 900万×6,000万/9,000万=600万円 > 譲渡益100万円のため100万円に圧縮
    expect(result.transfers[0].additionJpy.toNumber()).toBe(3_000_000);
    expect(result.transfers[1].additionJpy.toNumber()).toBe(1_000_000);
    expect(result.totalAdditionJpy.toNumber()).toBe(4_000_000);
  });

  it("譲渡した財産の相続税評価額が課税価格を超える場合はエラー", () => {
    expect(() =>
      estimateInheritedAcquisitionCostAddition({
        inheritanceTaxJpy: 1_000_000,
        taxableBaseJpy: 5_000_000,
        transfers: [
          { inheritedValuationJpy: 6_000_000, transferGainJpy: 1_000_000, withinDeadline: true },
        ],
      }),
    ).toThrow();
  });

  it("相続税額・課税価格が負数の場合はエラー", () => {
    expect(() =>
      estimateInheritedAcquisitionCostAddition({
        inheritanceTaxJpy: -1,
        taxableBaseJpy: 5_000_000,
        transfers: [],
      }),
    ).toThrow();
    expect(() =>
      estimateInheritedAcquisitionCostAddition({
        inheritanceTaxJpy: 1_000_000,
        taxableBaseJpy: -1,
        transfers: [],
      }),
    ).toThrow();
  });

  it("譲渡財産が無い場合は課税価格0円でもエラーにならず合計0円", () => {
    const result = estimateInheritedAcquisitionCostAddition({
      inheritanceTaxJpy: 0,
      taxableBaseJpy: 0,
      transfers: [],
    });
    expect(result.transfers).toHaveLength(0);
    expect(result.totalAdditionJpy.toNumber()).toBe(0);
  });

  it("課税価格が0円で譲渡財産がある場合はエラー", () => {
    expect(() =>
      estimateInheritedAcquisitionCostAddition({
        inheritanceTaxJpy: 0,
        taxableBaseJpy: 0,
        transfers: [{ inheritedValuationJpy: 0, transferGainJpy: 0, withinDeadline: true }],
      }),
    ).toThrow();
  });

  it("ラベル未指定の場合は「譲渡財産N」を自動採番する", () => {
    const result = estimateInheritedAcquisitionCostAddition({
      inheritanceTaxJpy: 1_000_000,
      taxableBaseJpy: 10_000_000,
      transfers: [
        { inheritedValuationJpy: 1_000_000, transferGainJpy: 100_000, withinDeadline: true },
        { inheritedValuationJpy: 1_000_000, transferGainJpy: 100_000, withinDeadline: true },
      ],
    });
    expect(result.transfers[0].label).toBe("譲渡財産1");
    expect(result.transfers[1].label).toBe("譲渡財産2");
  });
});
