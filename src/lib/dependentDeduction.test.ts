import { describe, expect, it } from "vitest";
import {
  estimateDependentDeduction,
  estimateSpouseDeduction,
  summarizeDependentsDeduction,
} from "./dependentDeduction";

describe("estimateSpouseDeduction", () => {
  it("配偶者がいない場合は0円", () => {
    const result = estimateSpouseDeduction({
      hasEligibleSpouse: false,
      taxpayerTotalIncomeJpy: 4_000_000,
      spouseTotalIncomeJpy: 0,
      spouseIsElderly: false,
    });
    expect(result.category).toBe("NONE");
    expect(result.incomeTaxAmountJpy.toNumber()).toBe(0);
  });

  it("配偶者の所得48万円以下・本人900万円以下は一般の配偶者控除38万円/33万円", () => {
    const result = estimateSpouseDeduction({
      hasEligibleSpouse: true,
      taxpayerTotalIncomeJpy: 6_000_000,
      spouseTotalIncomeJpy: 0,
      spouseIsElderly: false,
    });
    expect(result.category).toBe("SPOUSE_DEDUCTION");
    expect(result.incomeTaxAmountJpy.toNumber()).toBe(380_000);
    expect(result.residentTaxAmountJpy.toNumber()).toBe(330_000);
  });

  it("配偶者が70歳以上(老人控除対象配偶者)は48万円/38万円", () => {
    const result = estimateSpouseDeduction({
      hasEligibleSpouse: true,
      taxpayerTotalIncomeJpy: 6_000_000,
      spouseTotalIncomeJpy: 0,
      spouseIsElderly: true,
    });
    expect(result.incomeTaxAmountJpy.toNumber()).toBe(480_000);
    expect(result.residentTaxAmountJpy.toNumber()).toBe(380_000);
  });

  it("本人の所得が900万円超950万円以下だと控除額が逓減する", () => {
    const result = estimateSpouseDeduction({
      hasEligibleSpouse: true,
      taxpayerTotalIncomeJpy: 9_200_000,
      spouseTotalIncomeJpy: 0,
      spouseIsElderly: false,
    });
    expect(result.incomeTaxAmountJpy.toNumber()).toBe(260_000);
    expect(result.residentTaxAmountJpy.toNumber()).toBe(220_000);
  });

  it("本人の所得が1,000万円超だと配偶者控除・配偶者特別控除いずれも0円", () => {
    const result = estimateSpouseDeduction({
      hasEligibleSpouse: true,
      taxpayerTotalIncomeJpy: 10_500_000,
      spouseTotalIncomeJpy: 0,
      spouseIsElderly: false,
    });
    expect(result.category).toBe("NONE");
    expect(result.incomeTaxAmountJpy.toNumber()).toBe(0);
  });

  it("配偶者の所得が48万円超133万円以下は配偶者特別控除(段階的に逓減)", () => {
    const result = estimateSpouseDeduction({
      hasEligibleSpouse: true,
      taxpayerTotalIncomeJpy: 6_000_000,
      spouseTotalIncomeJpy: 900_000,
      spouseIsElderly: false,
    });
    expect(result.category).toBe("SPOUSE_SPECIAL_DEDUCTION");
    expect(result.incomeTaxAmountJpy.toNumber()).toBe(380_000);
    expect(result.residentTaxAmountJpy.toNumber()).toBe(330_000);
  });

  it("配偶者特別控除は133万円ちょうどで最小額(3万円/3万円)になる", () => {
    const result = estimateSpouseDeduction({
      hasEligibleSpouse: true,
      taxpayerTotalIncomeJpy: 6_000_000,
      spouseTotalIncomeJpy: 1_330_000,
      spouseIsElderly: false,
    });
    expect(result.incomeTaxAmountJpy.toNumber()).toBe(30_000);
    expect(result.residentTaxAmountJpy.toNumber()).toBe(30_000);
  });

  it("配偶者の所得が133万円超は0円", () => {
    const result = estimateSpouseDeduction({
      hasEligibleSpouse: true,
      taxpayerTotalIncomeJpy: 6_000_000,
      spouseTotalIncomeJpy: 1_400_000,
      spouseIsElderly: false,
    });
    expect(result.category).toBe("NONE");
    expect(result.incomeTaxAmountJpy.toNumber()).toBe(0);
  });

  it("令和7年分(2025年分)以後は配偶者の所得58万円以下でも配偶者控除(令和6年分以前は特別控除扱いすらされず対象外)", () => {
    const result2025 = estimateSpouseDeduction({
      hasEligibleSpouse: true,
      taxpayerTotalIncomeJpy: 6_000_000,
      spouseTotalIncomeJpy: 550_000,
      spouseIsElderly: false,
      year: 2025,
    });
    expect(result2025.category).toBe("SPOUSE_DEDUCTION");
    expect(result2025.incomeTaxAmountJpy.toNumber()).toBe(380_000);

    const result2024 = estimateSpouseDeduction({
      hasEligibleSpouse: true,
      taxpayerTotalIncomeJpy: 6_000_000,
      spouseTotalIncomeJpy: 550_000,
      spouseIsElderly: false,
      year: 2024,
    });
    expect(result2024.category).toBe("SPOUSE_SPECIAL_DEDUCTION");
    expect(result2024.incomeTaxAmountJpy.toNumber()).toBe(380_000);
  });

  it("令和7年分は配偶者の所得58万円超133万円以下でも配偶者特別控除の金額表自体は変わらない", () => {
    const result = estimateSpouseDeduction({
      hasEligibleSpouse: true,
      taxpayerTotalIncomeJpy: 6_000_000,
      spouseTotalIncomeJpy: 900_000,
      spouseIsElderly: false,
      year: 2025,
    });
    expect(result.category).toBe("SPOUSE_SPECIAL_DEDUCTION");
    expect(result.incomeTaxAmountJpy.toNumber()).toBe(380_000);
    expect(result.residentTaxAmountJpy.toNumber()).toBe(330_000);
  });
});

describe("estimateDependentDeduction", () => {
  it("16歳未満は対象外", () => {
    const result = estimateDependentDeduction({ ageAtYearEnd: 10, totalIncomeJpy: 0 });
    expect(result.eligible).toBe(false);
    expect(result.category).toBe("UNDER_16");
  });

  it("合計所得金額が48万円を超えると対象外", () => {
    const result = estimateDependentDeduction({ ageAtYearEnd: 20, totalIncomeJpy: 500_000 });
    expect(result.eligible).toBe(false);
  });

  it("令和7年分(2025年分)以後は合計所得金額要件が58万円に緩和される", () => {
    // 19〜22歳は令和7年分以後の58万円超は特定親族特別控除の対象になるため、
    // ここでは要件緩和そのものの検証として対象外の年齢層(一般の控除対象扶養親族)を使う
    const result2025 = estimateDependentDeduction({
      ageAtYearEnd: 30,
      totalIncomeJpy: 550_000,
      year: 2025,
    });
    expect(result2025.eligible).toBe(true);

    const result2024 = estimateDependentDeduction({
      ageAtYearEnd: 30,
      totalIncomeJpy: 550_000,
      year: 2024,
    });
    expect(result2024.eligible).toBe(false);

    const result2025Over = estimateDependentDeduction({
      ageAtYearEnd: 30,
      totalIncomeJpy: 600_000,
      year: 2025,
    });
    expect(result2025Over.eligible).toBe(false);
  });

  it("一般の控除対象扶養親族(16〜18歳)は38万円/33万円", () => {
    const result = estimateDependentDeduction({ ageAtYearEnd: 17, totalIncomeJpy: 0 });
    expect(result.category).toBe("GENERAL");
    expect(result.incomeTaxAmountJpy.toNumber()).toBe(380_000);
    expect(result.residentTaxAmountJpy.toNumber()).toBe(330_000);
  });

  it("特定扶養親族(19〜22歳)は63万円/45万円", () => {
    const result = estimateDependentDeduction({ ageAtYearEnd: 20, totalIncomeJpy: 0 });
    expect(result.category).toBe("SPECIFIED");
    expect(result.incomeTaxAmountJpy.toNumber()).toBe(630_000);
    expect(result.residentTaxAmountJpy.toNumber()).toBe(450_000);
  });

  it("同居老親等(70歳以上)は58万円/45万円", () => {
    const result = estimateDependentDeduction({
      ageAtYearEnd: 75,
      totalIncomeJpy: 0,
      cohabitingElderlyRelative: true,
    });
    expect(result.category).toBe("ELDERLY_COHABITING");
    expect(result.incomeTaxAmountJpy.toNumber()).toBe(580_000);
    expect(result.residentTaxAmountJpy.toNumber()).toBe(450_000);
  });

  it("同居老親等以外の老人扶養親族(70歳以上)は48万円/38万円", () => {
    const result = estimateDependentDeduction({
      ageAtYearEnd: 75,
      totalIncomeJpy: 0,
      cohabitingElderlyRelative: false,
    });
    expect(result.category).toBe("ELDERLY_OTHER");
    expect(result.incomeTaxAmountJpy.toNumber()).toBe(480_000);
    expect(result.residentTaxAmountJpy.toNumber()).toBe(380_000);
  });

  it("23〜69歳は一般の控除対象扶養親族", () => {
    const result = estimateDependentDeduction({ ageAtYearEnd: 45, totalIncomeJpy: 0 });
    expect(result.category).toBe("GENERAL");
  });

  it("令和7年分以後、19〜22歳で合計所得金額58万円超は特定親族特別控除(所得税は段階表)", () => {
    const result85 = estimateDependentDeduction({
      ageAtYearEnd: 20,
      totalIncomeJpy: 850_000,
      year: 2025,
    });
    expect(result85.category).toBe("SPECIFIED_SPECIAL");
    expect(result85.eligible).toBe(true);
    expect(result85.incomeTaxAmountJpy.toNumber()).toBe(630_000);
    expect(result85.residentTaxAmountJpy.toNumber()).toBe(450_000);
    expect(result85.residentTaxAmountUnverified).toBeFalsy();

    expect(
      estimateDependentDeduction({
        ageAtYearEnd: 20,
        totalIncomeJpy: 1_000_000,
        year: 2025,
      }).incomeTaxAmountJpy.toNumber(),
    ).toBe(410_000);

    const result123 = estimateDependentDeduction({
      ageAtYearEnd: 20,
      totalIncomeJpy: 1_230_000,
      year: 2025,
    });
    expect(result123.incomeTaxAmountJpy.toNumber()).toBe(30_000);
  });

  it("特定親族特別控除の住民税は合計所得金額95万円以下は45万円、超えると未確認(0円扱い)", () => {
    const within = estimateDependentDeduction({
      ageAtYearEnd: 20,
      totalIncomeJpy: 950_000,
      year: 2025,
    });
    expect(within.residentTaxAmountJpy.toNumber()).toBe(450_000);
    expect(within.residentTaxAmountUnverified).toBeFalsy();

    const over = estimateDependentDeduction({
      ageAtYearEnd: 20,
      totalIncomeJpy: 1_000_000,
      year: 2025,
    });
    expect(over.residentTaxAmountJpy.toNumber()).toBe(0);
    expect(over.residentTaxAmountUnverified).toBe(true);
    expect(over.notes?.length).toBeGreaterThan(0);
  });

  it("特定親族特別控除は合計所得金額123万円超だと対象外(令和7年分以後)", () => {
    const result = estimateDependentDeduction({
      ageAtYearEnd: 20,
      totalIncomeJpy: 1_300_000,
      year: 2025,
    });
    expect(result.eligible).toBe(false);
  });

  it("令和6年分以前は特定親族特別控除が存在しないため58万円超で対象外", () => {
    const result = estimateDependentDeduction({
      ageAtYearEnd: 20,
      totalIncomeJpy: 850_000,
      year: 2024,
    });
    expect(result.category).toBe("SPECIFIED");
    expect(result.eligible).toBe(false);
  });
});

describe("summarizeDependentsDeduction", () => {
  it("複数の扶養親族を合算する", () => {
    const summary = summarizeDependentsDeduction([
      { ageAtYearEnd: 20, totalIncomeJpy: 0 }, // 特定扶養親族 63万/45万
      { ageAtYearEnd: 45, totalIncomeJpy: 0 }, // 一般 38万/33万
      { ageAtYearEnd: 10, totalIncomeJpy: 0 }, // 対象外
    ]);
    expect(summary.incomeTaxAmountJpy.toNumber()).toBe(1_010_000);
    expect(summary.residentTaxAmountJpy.toNumber()).toBe(780_000);
    expect(summary.results).toHaveLength(3);
  });

  it("扶養親族がいない場合は0円", () => {
    const summary = summarizeDependentsDeduction([]);
    expect(summary.incomeTaxAmountJpy.toNumber()).toBe(0);
    expect(summary.residentTaxAmountJpy.toNumber()).toBe(0);
  });
});
