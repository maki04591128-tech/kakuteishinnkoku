import { describe, expect, it } from "vitest";
import { estimateGiftExitTax } from "./giftExitTax";

describe("estimateGiftExitTax", () => {
  it("対象資産1億円以上・居住期間5年超の場合、贈与した部分のみのみなし譲渡益に20.315%課税する", () => {
    // 上場株式: 時価1.2億円(10,000株×12,000円)、取得費8,000万円 => みなし譲渡益4,000万円。全数量を贈与。
    const result = estimateGiftExitTax({
      holdings: [
        {
          symbol: "TEST",
          isListed: true,
          isGiftedAsset: true,
          quantity: 10_000,
          costBasisJpy: 80_000_000,
          valuationPriceJpy: 12_000,
        },
      ],
      domesticResidenceYearsInPast10Years: 10,
    });

    expect(result.totalHoldingsMarketValueJpy.toNumber()).toBe(120_000_000);
    expect(result.meetsAssetThreshold).toBe(true);
    expect(result.meetsResidencyRequirement).toBe(true);
    expect(result.isSubjectToGiftExitTax).toBe(true);
    expect(result.listedPool.netGainJpy.toNumber()).toBe(40_000_000);
    expect(result.totalTaxableGainJpy.toNumber()).toBe(40_000_000);
    // 所得税15.315% = 6,126,000円、住民税5% = 2,000,000円
    expect(result.nationalTaxJpy.toNumber()).toBeCloseTo(6_126_000, 0);
    expect(result.residentTaxJpy.toNumber()).toBe(2_000_000);
    expect(result.totalTaxJpy.toNumber()).toBeCloseTo(8_126_000, 0);
  });

  it("1億円判定は贈与した部分・していない部分の両方の合計で行うが、課税対象は贈与した部分のみ", () => {
    const result = estimateGiftExitTax({
      holdings: [
        // 贈与した部分: 時価6,000万円、取得費1,000万円 => みなし譲渡益5,000万円
        {
          symbol: "GIFTED",
          isListed: true,
          isGiftedAsset: true,
          quantity: 1,
          costBasisJpy: 10_000_000,
          valuationPriceJpy: 60_000_000,
        },
        // 贈与していない部分: 時価5,000万円(引き続き贈与者が保有)。取得費が大きくても課税対象には影響しない
        {
          symbol: "KEPT",
          isListed: true,
          isGiftedAsset: false,
          quantity: 1,
          costBasisJpy: 90_000_000,
          valuationPriceJpy: 50_000_000,
        },
      ],
      domesticResidenceYearsInPast10Years: 10,
    });

    // 資産基準の判定は合計1.1億円(贈与した部分6,000万円+していない部分5,000万円)
    expect(result.totalHoldingsMarketValueJpy.toNumber()).toBe(110_000_000);
    expect(result.meetsAssetThreshold).toBe(true);
    expect(result.isSubjectToGiftExitTax).toBe(true);
    // 課税対象は贈与した部分のみなし譲渡益5,000万円のみ(贈与していない部分の含み損は無視)
    expect(result.listedPool.netGainJpy.toNumber()).toBe(50_000_000);
    expect(result.totalTaxableGainJpy.toNumber()).toBe(50_000_000);
  });

  it("贈与した部分だけでは1億円未満でも、保有資産全体で1億円以上なら資産基準を満たす", () => {
    const result = estimateGiftExitTax({
      holdings: [
        {
          symbol: "GIFTED",
          isListed: true,
          isGiftedAsset: true,
          quantity: 1,
          costBasisJpy: 0,
          valuationPriceJpy: 20_000_000,
        },
        {
          symbol: "KEPT",
          isListed: true,
          isGiftedAsset: false,
          quantity: 1,
          costBasisJpy: 0,
          valuationPriceJpy: 90_000_000,
        },
      ],
      domesticResidenceYearsInPast10Years: 10,
    });
    expect(result.totalHoldingsMarketValueJpy.toNumber()).toBe(110_000_000);
    expect(result.meetsAssetThreshold).toBe(true);
    expect(result.isSubjectToGiftExitTax).toBe(true);
    // 課税対象は贈与した部分の含み益2,000万円のみ
    expect(result.totalTaxableGainJpy.toNumber()).toBe(20_000_000);
  });

  it("保有資産全体の価額の合計が1億円未満の場合は課税対象外(税額0円)", () => {
    const result = estimateGiftExitTax({
      holdings: [
        {
          symbol: "TEST",
          isListed: true,
          isGiftedAsset: true,
          quantity: 1,
          costBasisJpy: 0,
          valuationPriceJpy: 99_999_999,
        },
      ],
      domesticResidenceYearsInPast10Years: 10,
    });
    expect(result.meetsAssetThreshold).toBe(false);
    expect(result.isSubjectToGiftExitTax).toBe(false);
    expect(result.totalTaxableGainJpy.toNumber()).toBe(0);
    expect(result.totalTaxJpy.toNumber()).toBe(0);
  });

  it("国内居住期間が過去10年以内にちょうど5年の場合は要件を満たさない(5年超が必要)", () => {
    const result = estimateGiftExitTax({
      holdings: [
        {
          symbol: "TEST",
          isListed: true,
          isGiftedAsset: true,
          quantity: 1,
          costBasisJpy: 0,
          valuationPriceJpy: 200_000_000,
        },
      ],
      domesticResidenceYearsInPast10Years: 5,
    });
    expect(result.meetsResidencyRequirement).toBe(false);
    expect(result.isSubjectToGiftExitTax).toBe(false);
    expect(result.totalTaxJpy.toNumber()).toBe(0);
  });

  it("国内居住期間が5年を超えていれば要件を満たす", () => {
    const result = estimateGiftExitTax({
      holdings: [
        {
          symbol: "TEST",
          isListed: true,
          isGiftedAsset: true,
          quantity: 1,
          costBasisJpy: 0,
          valuationPriceJpy: 200_000_000,
        },
      ],
      domesticResidenceYearsInPast10Years: 5.1,
    });
    expect(result.meetsResidencyRequirement).toBe(true);
    expect(result.isSubjectToGiftExitTax).toBe(true);
  });

  it("上場株式等・一般株式等は別プールで損益通算し、一方の含み損は他方の含み益と通算しない(贈与した部分のみ)", () => {
    const result = estimateGiftExitTax({
      holdings: [
        // 上場株式等(贈与): みなし譲渡益6,000万円
        {
          symbol: "LISTED_GAIN",
          isListed: true,
          isGiftedAsset: true,
          quantity: 1,
          costBasisJpy: 40_000_000,
          valuationPriceJpy: 100_000_000,
        },
        // 一般株式等(贈与): みなし譲渡損2,000万円(取得費80,000,000円、時価60,000,000円)
        {
          symbol: "UNLISTED_LOSS",
          isListed: false,
          isGiftedAsset: true,
          quantity: 1,
          costBasisJpy: 80_000_000,
          valuationPriceJpy: 60_000_000,
        },
      ],
      domesticResidenceYearsInPast10Years: 8,
    });

    expect(result.totalHoldingsMarketValueJpy.toNumber()).toBe(160_000_000);
    expect(result.listedPool.netGainJpy.toNumber()).toBe(60_000_000);
    expect(result.listedPool.taxableGainJpy.toNumber()).toBe(60_000_000);
    expect(result.unlistedPool.netGainJpy.toNumber()).toBe(-20_000_000);
    // 一般株式等プールの含み損は0円に切り下げ、上場株式等プールとは通算しない
    expect(result.unlistedPool.taxableGainJpy.toNumber()).toBe(0);
    expect(result.totalTaxableGainJpy.toNumber()).toBe(60_000_000);
  });

  it("同一プール内は複数銘柄の含み益・含み損を合算できる(贈与した部分のみ)", () => {
    const result = estimateGiftExitTax({
      holdings: [
        {
          symbol: "A",
          isListed: true,
          isGiftedAsset: true,
          quantity: 1,
          costBasisJpy: 30_000_000,
          valuationPriceJpy: 90_000_000,
        },
        {
          symbol: "B",
          isListed: true,
          isGiftedAsset: true,
          quantity: 1,
          costBasisJpy: 50_000_000,
          valuationPriceJpy: 40_000_000,
        },
      ],
      domesticResidenceYearsInPast10Years: 6,
    });
    // Aの益6,000万円 + Bの損1,000万円 = 差引5,000万円
    expect(result.listedPool.netGainJpy.toNumber()).toBe(50_000_000);
    expect(result.listedPool.taxableGainJpy.toNumber()).toBe(50_000_000);
  });

  it("保有銘柄が0件の場合は資産基準を満たさず課税対象外", () => {
    const result = estimateGiftExitTax({
      holdings: [],
      domesticResidenceYearsInPast10Years: 10,
    });
    expect(result.totalHoldingsMarketValueJpy.toNumber()).toBe(0);
    expect(result.meetsAssetThreshold).toBe(false);
    expect(result.isSubjectToGiftExitTax).toBe(false);
  });

  it("保有数量が負の値だとエラーになる", () => {
    expect(() =>
      estimateGiftExitTax({
        holdings: [
          {
            symbol: "TEST",
            isListed: true,
            isGiftedAsset: true,
            quantity: -1,
            costBasisJpy: 0,
            valuationPriceJpy: 0,
          },
        ],
        domesticResidenceYearsInPast10Years: 10,
      }),
    ).toThrow();
  });

  it("取得費が負の値だとエラーになる", () => {
    expect(() =>
      estimateGiftExitTax({
        holdings: [
          {
            symbol: "TEST",
            isListed: true,
            isGiftedAsset: true,
            quantity: 1,
            costBasisJpy: -1,
            valuationPriceJpy: 0,
          },
        ],
        domesticResidenceYearsInPast10Years: 10,
      }),
    ).toThrow();
  });

  it("贈与時点の時価が負の値だとエラーになる", () => {
    expect(() =>
      estimateGiftExitTax({
        holdings: [
          {
            symbol: "TEST",
            isListed: true,
            isGiftedAsset: true,
            quantity: 1,
            costBasisJpy: 0,
            valuationPriceJpy: -1,
          },
        ],
        domesticResidenceYearsInPast10Years: 10,
      }),
    ).toThrow();
  });

  it("国内居住期間の年数が負の値だとエラーになる", () => {
    expect(() =>
      estimateGiftExitTax({
        holdings: [],
        domesticResidenceYearsInPast10Years: -1,
      }),
    ).toThrow();
  });
});
