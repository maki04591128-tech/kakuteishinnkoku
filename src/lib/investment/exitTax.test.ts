import { describe, expect, it } from "vitest";
import { estimateExitTax, estimateExitTaxCancellation } from "./exitTax";

describe("estimateExitTax", () => {
  it("対象資産1億円以上・居住期間5年超の場合、みなし譲渡益に20.315%課税する", () => {
    // 上場株式: 時価1.2億円(10,000株×12,000円)、取得費8,000万円 => みなし譲渡益4,000万円
    const result = estimateExitTax({
      holdings: [
        {
          symbol: "TEST",
          isListed: true,
          quantity: 10_000,
          costBasisJpy: 80_000_000,
          valuationPriceJpy: 12_000,
        },
      ],
      domesticResidenceYearsInPast10Years: 10,
    });

    expect(result.totalMarketValueJpy.toNumber()).toBe(120_000_000);
    expect(result.meetsAssetThreshold).toBe(true);
    expect(result.meetsResidencyRequirement).toBe(true);
    expect(result.isSubjectToExitTax).toBe(true);
    expect(result.listedPool.netGainJpy.toNumber()).toBe(40_000_000);
    expect(result.totalTaxableGainJpy.toNumber()).toBe(40_000_000);
    // 所得税15.315% = 6,126,000円、住民税5% = 2,000,000円
    expect(result.nationalTaxJpy.toNumber()).toBeCloseTo(6_126_000, 0);
    expect(result.residentTaxJpy.toNumber()).toBe(2_000_000);
    expect(result.totalTaxJpy.toNumber()).toBeCloseTo(8_126_000, 0);
  });

  it("対象資産の価額の合計が1億円ちょうどの場合は資産基準を満たす(1億円以上)", () => {
    const result = estimateExitTax({
      holdings: [
        {
          symbol: "TEST",
          isListed: true,
          quantity: 1,
          costBasisJpy: 0,
          valuationPriceJpy: 100_000_000,
        },
      ],
      domesticResidenceYearsInPast10Years: 6,
    });
    expect(result.meetsAssetThreshold).toBe(true);
    expect(result.isSubjectToExitTax).toBe(true);
  });

  it("対象資産の価額の合計が1億円未満の場合は課税対象外(税額0円)", () => {
    const result = estimateExitTax({
      holdings: [
        {
          symbol: "TEST",
          isListed: true,
          quantity: 1,
          costBasisJpy: 0,
          valuationPriceJpy: 99_999_999,
        },
      ],
      domesticResidenceYearsInPast10Years: 10,
    });
    expect(result.meetsAssetThreshold).toBe(false);
    expect(result.isSubjectToExitTax).toBe(false);
    expect(result.totalTaxableGainJpy.toNumber()).toBe(0);
    expect(result.totalTaxJpy.toNumber()).toBe(0);
  });

  it("国内居住期間が過去10年以内にちょうど5年の場合は要件を満たさない(5年超が必要)", () => {
    const result = estimateExitTax({
      holdings: [
        {
          symbol: "TEST",
          isListed: true,
          quantity: 1,
          costBasisJpy: 0,
          valuationPriceJpy: 200_000_000,
        },
      ],
      domesticResidenceYearsInPast10Years: 5,
    });
    expect(result.meetsResidencyRequirement).toBe(false);
    expect(result.isSubjectToExitTax).toBe(false);
    expect(result.totalTaxJpy.toNumber()).toBe(0);
  });

  it("国内居住期間が5年を超えていれば要件を満たす", () => {
    const result = estimateExitTax({
      holdings: [
        {
          symbol: "TEST",
          isListed: true,
          quantity: 1,
          costBasisJpy: 0,
          valuationPriceJpy: 200_000_000,
        },
      ],
      domesticResidenceYearsInPast10Years: 5.1,
    });
    expect(result.meetsResidencyRequirement).toBe(true);
    expect(result.isSubjectToExitTax).toBe(true);
  });

  it("上場株式等・一般株式等は別プールで損益通算し、一方の含み損は他方の含み益と通算しない", () => {
    const result = estimateExitTax({
      holdings: [
        // 上場株式等: みなし譲渡益6,000万円
        {
          symbol: "LISTED_GAIN",
          isListed: true,
          quantity: 1,
          costBasisJpy: 40_000_000,
          valuationPriceJpy: 100_000_000,
        },
        // 一般株式等: みなし譲渡損2,000万円(取得費80,000,000円、時価60,000,000円)
        {
          symbol: "UNLISTED_LOSS",
          isListed: false,
          quantity: 1,
          costBasisJpy: 80_000_000,
          valuationPriceJpy: 60_000_000,
        },
      ],
      domesticResidenceYearsInPast10Years: 8,
    });

    expect(result.totalMarketValueJpy.toNumber()).toBe(160_000_000);
    expect(result.listedPool.netGainJpy.toNumber()).toBe(60_000_000);
    expect(result.listedPool.taxableGainJpy.toNumber()).toBe(60_000_000);
    expect(result.unlistedPool.netGainJpy.toNumber()).toBe(-20_000_000);
    // 一般株式等プールの含み損は0円に切り下げ、上場株式等プールとは通算しない
    expect(result.unlistedPool.taxableGainJpy.toNumber()).toBe(0);
    expect(result.totalTaxableGainJpy.toNumber()).toBe(60_000_000);
  });

  it("同一プール内は複数銘柄の含み益・含み損を合算できる", () => {
    const result = estimateExitTax({
      holdings: [
        {
          symbol: "A",
          isListed: true,
          quantity: 1,
          costBasisJpy: 30_000_000,
          valuationPriceJpy: 90_000_000,
        },
        {
          symbol: "B",
          isListed: true,
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
    const result = estimateExitTax({
      holdings: [],
      domesticResidenceYearsInPast10Years: 10,
    });
    expect(result.totalMarketValueJpy.toNumber()).toBe(0);
    expect(result.meetsAssetThreshold).toBe(false);
    expect(result.isSubjectToExitTax).toBe(false);
  });

  it("保有数量が負の値だとエラーになる", () => {
    expect(() =>
      estimateExitTax({
        holdings: [
          { symbol: "TEST", isListed: true, quantity: -1, costBasisJpy: 0, valuationPriceJpy: 0 },
        ],
        domesticResidenceYearsInPast10Years: 10,
      }),
    ).toThrow();
  });

  it("取得費が負の値だとエラーになる", () => {
    expect(() =>
      estimateExitTax({
        holdings: [
          { symbol: "TEST", isListed: true, quantity: 1, costBasisJpy: -1, valuationPriceJpy: 0 },
        ],
        domesticResidenceYearsInPast10Years: 10,
      }),
    ).toThrow();
  });

  it("判定日時点の時価が負の値だとエラーになる", () => {
    expect(() =>
      estimateExitTax({
        holdings: [
          { symbol: "TEST", isListed: true, quantity: 1, costBasisJpy: 0, valuationPriceJpy: -1 },
        ],
        domesticResidenceYearsInPast10Years: 10,
      }),
    ).toThrow();
  });

  it("国内居住期間の年数が負の値だとエラーになる", () => {
    expect(() =>
      estimateExitTax({
        holdings: [],
        domesticResidenceYearsInPast10Years: -1,
      }),
    ).toThrow();
  });
});

describe("estimateExitTaxCancellation", () => {
  it("帰国期限(5年)以内に帰国し、引き続き保有していた銘柄分の課税を取り消せる", () => {
    const result = estimateExitTaxCancellation({
      holdings: [
        // 引き続き保有(帰国時まで手放していない): みなし譲渡益6,000万円
        {
          symbol: "HELD",
          isListed: true,
          quantity: 1,
          costBasisJpy: 40_000_000,
          valuationPriceJpy: 100_000_000,
          stillHeldAtReturn: true,
        },
        // 帰国前に譲渡済み: みなし譲渡益3,000万円(取消しの対象外、当初どおり課税)
        {
          symbol: "SOLD",
          isListed: true,
          quantity: 1,
          costBasisJpy: 70_000_000,
          valuationPriceJpy: 100_000_000,
          stillHeldAtReturn: false,
        },
      ],
      domesticResidenceYearsInPast10Years: 10,
      exitDate: "2020-01-10",
      returnDate: "2024-06-01",
      hasTaxDeferralExtension: false,
    });

    expect(result.isSubjectToExitTax).toBe(true);
    expect(result.deadlineYears).toBe(5);
    expect(result.meetsReturnDeadline).toBe(true);
    expect(result.amendedReturnDeadlineDate).toBe("2024-10-01");

    expect(result.originalResult.totalTaxableGainJpy.toNumber()).toBe(90_000_000);
    // 引き続き保有していたHELD分を除いた、SOLD分3,000万円のみが残る
    expect(result.revisedResult.totalTaxableGainJpy.toNumber()).toBe(30_000_000);
    // 取り消される課税対象額6,000万円 × 20.315% = 12,189,000円
    expect(result.refundableTaxJpy.toNumber()).toBeCloseTo(12_189_000, 0);
  });

  it("帰国期限(5年)を超えて帰国した場合は取消しの対象にならない(還付税額0円)", () => {
    const result = estimateExitTaxCancellation({
      holdings: [
        {
          symbol: "HELD",
          isListed: true,
          quantity: 1,
          costBasisJpy: 40_000_000,
          valuationPriceJpy: 100_000_000,
          stillHeldAtReturn: true,
        },
        {
          symbol: "SOLD",
          isListed: true,
          quantity: 1,
          costBasisJpy: 70_000_000,
          valuationPriceJpy: 100_000_000,
          stillHeldAtReturn: false,
        },
      ],
      domesticResidenceYearsInPast10Years: 10,
      exitDate: "2015-01-10",
      returnDate: "2021-06-01",
      hasTaxDeferralExtension: false,
    });

    expect(result.meetsReturnDeadline).toBe(false);
    expect(result.revisedResult.totalTaxableGainJpy.toNumber()).toBe(
      result.originalResult.totalTaxableGainJpy.toNumber(),
    );
    expect(result.refundableTaxJpy.toNumber()).toBe(0);
  });

  it("納税猶予制度の適用を受けている場合は帰国期限が10年に延長される", () => {
    const result = estimateExitTaxCancellation({
      holdings: [
        {
          symbol: "HELD",
          isListed: true,
          quantity: 1,
          costBasisJpy: 0,
          valuationPriceJpy: 200_000_000,
          stillHeldAtReturn: true,
        },
      ],
      domesticResidenceYearsInPast10Years: 10,
      exitDate: "2015-01-10",
      returnDate: "2023-06-01",
      hasTaxDeferralExtension: true,
    });

    expect(result.deadlineYears).toBe(10);
    expect(result.meetsReturnDeadline).toBe(true);
    expect(result.refundableTaxJpy.toNumber()).toBeGreaterThan(0);
  });

  it("当初から国外転出時課税の対象外(1億円未満)の場合は還付税額0円", () => {
    const result = estimateExitTaxCancellation({
      holdings: [
        {
          symbol: "HELD",
          isListed: true,
          quantity: 1,
          costBasisJpy: 0,
          valuationPriceJpy: 50_000_000,
          stillHeldAtReturn: true,
        },
      ],
      domesticResidenceYearsInPast10Years: 10,
      exitDate: "2020-01-10",
      returnDate: "2021-01-10",
      hasTaxDeferralExtension: false,
    });

    expect(result.isSubjectToExitTax).toBe(false);
    expect(result.refundableTaxJpy.toNumber()).toBe(0);
  });

  it("引き続き保有していた銘柄が含み損の場合、除外すると課税対象額が増え還付税額がマイナスになりうる", () => {
    const result = estimateExitTaxCancellation({
      holdings: [
        // 帰国前に譲渡済み: みなし譲渡益5,000万円
        {
          symbol: "SOLD_GAIN",
          isListed: true,
          quantity: 1,
          costBasisJpy: 50_000_000,
          valuationPriceJpy: 100_000_000,
          stillHeldAtReturn: false,
        },
        // 引き続き保有: みなし譲渡損3,000万円(除外するとプールの損失が無くなる)
        {
          symbol: "HELD_LOSS",
          isListed: true,
          quantity: 1,
          costBasisJpy: 80_000_000,
          valuationPriceJpy: 50_000_000,
          stillHeldAtReturn: true,
        },
      ],
      domesticResidenceYearsInPast10Years: 10,
      exitDate: "2020-01-10",
      returnDate: "2024-06-01",
      hasTaxDeferralExtension: false,
    });

    expect(result.originalResult.totalTaxableGainJpy.toNumber()).toBe(20_000_000);
    expect(result.revisedResult.totalTaxableGainJpy.toNumber()).toBe(50_000_000);
    expect(result.refundableTaxJpy.toNumber()).toBeLessThan(0);
    expect(result.refundableTaxJpy.toNumber()).toBeCloseTo(-6_094_500, 0);
  });

  it("帰国の日が国外転出の日より前だとエラーになる", () => {
    expect(() =>
      estimateExitTaxCancellation({
        holdings: [],
        domesticResidenceYearsInPast10Years: 10,
        exitDate: "2024-01-01",
        returnDate: "2023-01-01",
        hasTaxDeferralExtension: false,
      }),
    ).toThrow();
  });

  it("国外転出の日の形式が不正だとエラーになる", () => {
    expect(() =>
      estimateExitTaxCancellation({
        holdings: [],
        domesticResidenceYearsInPast10Years: 10,
        exitDate: "not-a-date",
        returnDate: "2023-01-01",
        hasTaxDeferralExtension: false,
      }),
    ).toThrow();
  });

  it("帰国の日の形式が不正だとエラーになる", () => {
    expect(() =>
      estimateExitTaxCancellation({
        holdings: [],
        domesticResidenceYearsInPast10Years: 10,
        exitDate: "2020-01-01",
        returnDate: "not-a-date",
        hasTaxDeferralExtension: false,
      }),
    ).toThrow();
  });
});
