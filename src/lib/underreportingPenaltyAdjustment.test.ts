import { describe, expect, it } from "vitest";
import { determinePenaltyAdjustment } from "./underreportingPenaltyAdjustment";

const base = {
  statementType: "OVERSEAS_ASSET" as const,
  underreportingTaxType: "OWN_INCOME_TAX" as const,
  hasUnderreporting: true,
  filedByDeadlineOrDeemedTimely: true,
  assetOrDebtWasListed: true,
};

describe("determinePenaltyAdjustment", () => {
  it("申告漏れが無い場合は軽減・加重いずれも適用されない", () => {
    const result = determinePenaltyAdjustment({ ...base, hasUnderreporting: false });
    expect(result.applicable).toBe(false);
    expect(result.reductionPercent).toBe(0);
    expect(result.increasePercent).toBe(0);
  });

  it("期限内提出・記載ありなら5%軽減され、加重は無い", () => {
    const result = determinePenaltyAdjustment(base);
    expect(result.reductionPercent).toBe(5);
    expect(result.increasePercent).toBe(0);
  });

  it("提出等が無い場合は5%加重され、軽減は無い", () => {
    const result = determinePenaltyAdjustment({
      ...base,
      filedByDeadlineOrDeemedTimely: false,
      assetOrDebtWasListed: false,
    });
    expect(result.reductionPercent).toBe(0);
    expect(result.increasePercent).toBe(5);
  });

  it("記載すべき資産の記載が無いだけでも提出等が無い扱いで5%加重される", () => {
    const result = determinePenaltyAdjustment({
      ...base,
      filedByDeadlineOrDeemedTimely: true,
      assetOrDebtWasListed: false,
    });
    expect(result.increasePercent).toBe(5);
  });

  it("調査通知前提出によるみなし提出でも期限内提出として軽減が適用される", () => {
    const result = determinePenaltyAdjustment({ ...base, filedByDeadlineOrDeemedTimely: true });
    expect(result.reductionPercent).toBe(5);
  });

  describe("国外財産調書の書類提示等の特例", () => {
    it("書類の提示等に応じなかった場合、記載があっても軽減措置は適用されない", () => {
      const result = determinePenaltyAdjustment({
        ...base,
        overseasDocumentsNotProvided: true,
      });
      expect(result.reductionPercent).toBe(0);
    });

    it("提出等が無く書類の提示等にも応じなかった場合は10%加重される", () => {
      const result = determinePenaltyAdjustment({
        ...base,
        filedByDeadlineOrDeemedTimely: false,
        assetOrDebtWasListed: false,
        overseasDocumentsNotProvided: true,
      });
      expect(result.increasePercent).toBe(10);
    });

    it("財産債務調書には書類提示等の特例が無いため、フラグを立てても10%にならない", () => {
      const result = determinePenaltyAdjustment({
        ...base,
        statementType: "ASSET_LIABILITY",
        filedByDeadlineOrDeemedTimely: false,
        assetOrDebtWasListed: false,
        overseasDocumentsNotProvided: true,
      });
      expect(result.increasePercent).toBe(5);
      expect(result.reductionPercent).toBe(0);
    });
  });

  describe("加重措置の除外対象(死亡した方・相続税)", () => {
    it("死亡した方自身の所得税(準確定申告)の申告漏れは、国外財産調書でも加重措置の対象外", () => {
      const result = determinePenaltyAdjustment({
        ...base,
        underreportingTaxType: "DECEASED_PERSON_INCOME_TAX",
        filedByDeadlineOrDeemedTimely: false,
        assetOrDebtWasListed: false,
      });
      expect(result.increasePercent).toBe(0);
    });

    it("死亡した方自身の所得税の申告漏れは、財産債務調書でも加重措置の対象外", () => {
      const result = determinePenaltyAdjustment({
        ...base,
        statementType: "ASSET_LIABILITY",
        underreportingTaxType: "DECEASED_PERSON_INCOME_TAX",
        filedByDeadlineOrDeemedTimely: false,
        assetOrDebtWasListed: false,
      });
      expect(result.increasePercent).toBe(0);
    });

    it("相続人自身の相続税の申告漏れは、国外財産調書では通常どおり加重措置の対象になる", () => {
      const result = determinePenaltyAdjustment({
        ...base,
        underreportingTaxType: "INHERITANCE_TAX",
        filedByDeadlineOrDeemedTimely: false,
        assetOrDebtWasListed: false,
      });
      expect(result.increasePercent).toBe(5);
    });

    it("相続税の申告漏れは、財産債務調書では加重措置の対象から除外される", () => {
      const result = determinePenaltyAdjustment({
        ...base,
        statementType: "ASSET_LIABILITY",
        underreportingTaxType: "INHERITANCE_TAX",
        filedByDeadlineOrDeemedTimely: false,
        assetOrDebtWasListed: false,
      });
      expect(result.increasePercent).toBe(0);
    });

    it("相続財産について本人に帰責事由が無い場合、国外財産調書の相続税加重は適用されない", () => {
      const result = determinePenaltyAdjustment({
        ...base,
        underreportingTaxType: "INHERITANCE_TAX",
        filedByDeadlineOrDeemedTimely: false,
        assetOrDebtWasListed: false,
        noFaultForInheritedProperty: true,
      });
      expect(result.increasePercent).toBe(0);
    });

    it("帰責事由が無くても提出等自体があれば軽減措置の対象になる(相続税)", () => {
      const result = determinePenaltyAdjustment({
        ...base,
        underreportingTaxType: "INHERITANCE_TAX",
      });
      expect(result.reductionPercent).toBe(5);
    });
  });
});
