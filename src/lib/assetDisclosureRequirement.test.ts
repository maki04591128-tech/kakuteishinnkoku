import { describe, expect, it } from "vitest";
import { determineAssetDisclosureRequirement } from "./assetDisclosureRequirement";

const baseInput = {
  residencyStatus: "RESIDENT" as const,
  hasIncomeTaxReturnObligationOrEligibleRefundReturn: true,
  aggregateIncomeExcludingRetirementJpy: 0,
  cryptoAssetsJpy: 0,
  nftAssetsJpy: 0,
  overseasAssetsExcludingCryptoAndNftJpy: 0,
  totalAssetsJpy: 0,
  section60SecuritiesEtcJpy: 0,
};

describe("determineAssetDisclosureRequirement", () => {
  describe("国外財産調書", () => {
    it("暗号資産・NFTを除く国外財産が5,000万円を超える居住者は提出義務がある", () => {
      const result = determineAssetDisclosureRequirement({
        ...baseInput,
        overseasAssetsExcludingCryptoAndNftJpy: 50_000_001,
      });
      expect(result.overseasAssetStatement.required).toBe(true);
    });

    it("国外財産が5,000万円ちょうどでは提出義務がない(閾値は「超える」)", () => {
      const result = determineAssetDisclosureRequirement({
        ...baseInput,
        overseasAssetsExcludingCryptoAndNftJpy: 50_000_000,
      });
      expect(result.overseasAssetStatement.required).toBe(false);
    });

    it("国外の交換業者に保有する暗号資産は所在が住所地判定のため国外財産に含めない", () => {
      const result = determineAssetDisclosureRequirement({
        ...baseInput,
        cryptoAssetsJpy: 100_000_000,
        overseasAssetsExcludingCryptoAndNftJpy: 10_000_000,
      });
      expect(result.overseasAssetStatement.required).toBe(false);
      expect(result.overseasAssetStatement.overseasAssetsTotalJpy.toString()).toBe("10000000");
    });

    it("国外のマーケットプレイスで購入したNFTも所在が住所地判定のため国外財産に含めない(NFT FAQ問15)", () => {
      const result = determineAssetDisclosureRequirement({
        ...baseInput,
        nftAssetsJpy: 80_000_000,
        overseasAssetsExcludingCryptoAndNftJpy: 10_000_000,
      });
      expect(result.overseasAssetStatement.required).toBe(false);
      expect(result.overseasAssetStatement.overseasAssetsTotalJpy.toString()).toBe("10000000");
    });

    it("非永住者は国外財産が閾値を超えても提出義務者にならない", () => {
      const result = determineAssetDisclosureRequirement({
        ...baseInput,
        residencyStatus: "NON_PERMANENT_RESIDENT",
        overseasAssetsExcludingCryptoAndNftJpy: 100_000_000,
      });
      expect(result.overseasAssetStatement.required).toBe(false);
    });

    it("非居住者は国外財産が閾値を超えても提出義務者にならない", () => {
      const result = determineAssetDisclosureRequirement({
        ...baseInput,
        residencyStatus: "NON_RESIDENT",
        overseasAssetsExcludingCryptoAndNftJpy: 100_000_000,
      });
      expect(result.overseasAssetStatement.required).toBe(false);
    });
  });

  describe("財産債務調書", () => {
    it("所得2,000万円超かつ財産3億円以上なら要件1により提出義務がある", () => {
      const result = determineAssetDisclosureRequirement({
        ...baseInput,
        aggregateIncomeExcludingRetirementJpy: 20_000_001,
        totalAssetsJpy: 300_000_000,
      });
      expect(result.assetLiabilityStatement.required).toBe(true);
      expect(result.assetLiabilityStatement.satisfiesRequirement1).toBe(true);
    });

    it("所得2,000万円超かつ有価証券等1億円以上でも要件1に該当する(財産3億円未満でも可)", () => {
      const result = determineAssetDisclosureRequirement({
        ...baseInput,
        aggregateIncomeExcludingRetirementJpy: 20_000_001,
        totalAssetsJpy: 150_000_000,
        section60SecuritiesEtcJpy: 100_000_000,
      });
      expect(result.assetLiabilityStatement.required).toBe(true);
      expect(result.assetLiabilityStatement.satisfiesRequirement1).toBe(true);
    });

    it("確定申告義務(還付申告含む)が無ければ所得・財産が閾値超でも要件1に該当しない", () => {
      const result = determineAssetDisclosureRequirement({
        ...baseInput,
        hasIncomeTaxReturnObligationOrEligibleRefundReturn: false,
        aggregateIncomeExcludingRetirementJpy: 30_000_000,
        totalAssetsJpy: 400_000_000,
      });
      expect(result.assetLiabilityStatement.satisfiesRequirement1).toBe(false);
    });

    it("暗号資産は財産の合計額(3億円判定)には算入されるが有価証券等(1億円判定)には算入されない", () => {
      const withCryptoOnly = determineAssetDisclosureRequirement({
        ...baseInput,
        aggregateIncomeExcludingRetirementJpy: 20_000_001,
        cryptoAssetsJpy: 300_000_000,
        totalAssetsJpy: 300_000_000,
        section60SecuritiesEtcJpy: 0,
      });
      expect(withCryptoOnly.assetLiabilityStatement.satisfiesRequirement1).toBe(true);
    });

    it("NFTも暗号資産と同様、財産の合計額(3億円判定)には算入されるが有価証券等(1億円判定)には算入されない(NFT FAQ問13)", () => {
      const withNftOnly = determineAssetDisclosureRequirement({
        ...baseInput,
        aggregateIncomeExcludingRetirementJpy: 20_000_001,
        nftAssetsJpy: 300_000_000,
        totalAssetsJpy: 300_000_000,
        section60SecuritiesEtcJpy: 0,
      });
      expect(withNftOnly.assetLiabilityStatement.satisfiesRequirement1).toBe(true);
      expect(withNftOnly.assetLiabilityStatement.reason).toContain("NFT300000000円");
    });

    it("要件1に該当しなくても財産10億円以上の居住者は要件2により提出義務がある", () => {
      const result = determineAssetDisclosureRequirement({
        ...baseInput,
        aggregateIncomeExcludingRetirementJpy: 0,
        totalAssetsJpy: 1_000_000_000,
      });
      expect(result.assetLiabilityStatement.required).toBe(true);
      expect(result.assetLiabilityStatement.satisfiesRequirement2).toBe(true);
    });

    it("非居住者は財産10億円以上でも要件2の対象にならない", () => {
      const result = determineAssetDisclosureRequirement({
        ...baseInput,
        residencyStatus: "NON_RESIDENT",
        aggregateIncomeExcludingRetirementJpy: 0,
        totalAssetsJpy: 2_000_000_000,
      });
      expect(result.assetLiabilityStatement.required).toBe(false);
    });

    it("非永住者でも要件2(財産10億円以上の居住者)の対象になる", () => {
      const result = determineAssetDisclosureRequirement({
        ...baseInput,
        residencyStatus: "NON_PERMANENT_RESIDENT",
        aggregateIncomeExcludingRetirementJpy: 0,
        totalAssetsJpy: 1_000_000_000,
      });
      expect(result.assetLiabilityStatement.required).toBe(true);
      expect(result.assetLiabilityStatement.satisfiesRequirement2).toBe(true);
    });

    it("いずれの要件にも該当しない場合は提出義務がない", () => {
      const result = determineAssetDisclosureRequirement({
        ...baseInput,
        aggregateIncomeExcludingRetirementJpy: 15_000_000,
        totalAssetsJpy: 200_000_000,
      });
      expect(result.assetLiabilityStatement.required).toBe(false);
    });
  });

  it("負の値を入力するとエラーになる", () => {
    expect(() =>
      determineAssetDisclosureRequirement({
        ...baseInput,
        totalAssetsJpy: -1,
      }),
    ).toThrow();
  });

  it("NFTの価額に負の値を入力するとエラーになる", () => {
    expect(() =>
      determineAssetDisclosureRequirement({
        ...baseInput,
        nftAssetsJpy: -1,
      }),
    ).toThrow();
  });
});
