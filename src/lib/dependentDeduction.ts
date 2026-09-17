import { Decimal } from "decimal.js";

/**
 * 配偶者控除・配偶者特別控除(所得税法83条・83条の2)、扶養控除(所得税法84条)を
 * 試算する。他の所得控除試算画面と同様、暗号資産・投資の計算エンジンとは独立した
 * 単体の試算ロジック。
 *
 * **令和7年度税制改正(いわゆる「103万円の壁」対応)への対応状況:**
 * 扶養親族・同一生計配偶者の合計所得金額要件が令和7年分(2025年分)以後
 * 48万円→58万円に引き上げられた点のみ、`year`引数により年分ごとに切り替える
 * (2025年分以後は58万円、2024年分以前は48万円を適用)。配偶者特別控除は
 * この要件緩和により48万円超133万円以下だった対象範囲が58万円超133万円以下に
 * 変わるのみで、上限(133万円)・控除額の段階表自体に変更は無いため据え置いた。
 *
 * **19〜22歳の親族向けに新設された「特定親族特別控除」(令和7年度税制改正):**
 * 合計所得金額が58万円(令和6年分以前は特定扶養親族の対象外)を超え123万円以下の
 * 19〜22歳の親族について、令和7年分(2025年分)以後は「特定親族特別控除」の対象に
 * 追加した(`estimateDependentDeduction`の`SPECIFIED_SPECIAL`区分)。所得税側は
 * 複数の独立した情報源で一致した5万円刻みの控除額の段階表(58万円超85万円以下
 * 63万円〜120万円超123万円以下3万円)をそのまま実装した。住民税側は満額(45万円、
 * 特定扶養親族と同額)の対象範囲(58万円超95万円以下)は複数の自治体公式サイトで
 * 一致して確認できたが、95万円超123万円以下の段階的な逓減額の具体的な金額表は
 * 一次情報(国税庁・総務省等)で確認できていないため、この範囲は住民税側の控除額を
 * 0円として扱い`residentTaxAmountUnverified`フラグと注記で明示する(誤った金額を
 * 組み込むより、未確認である旨を明示する方針。README「ロードマップ」参照)。
 *
 * **基礎控除の引き上げ(令和7年度税制改正)** は`src/lib/basicDeduction.ts`に
 * 分離して実装した(本ファイルの対象外)。
 */

/** 扶養親族・同一生計配偶者の合計所得金額要件が48万円→58万円に引き上げられた年分(令和7年度税制改正) */
const REFORM_YEAR_INCOME_REQUIREMENT_580K = 2025;

function dependentIncomeLimitForYear(year: number): number {
  return year >= REFORM_YEAR_INCOME_REQUIREMENT_580K ? 580_000 : 480_000;
}

export type TaxpayerIncomeBand = "UP_TO_900" | "OVER_900_UP_TO_950" | "OVER_950_UP_TO_1000";

function taxpayerIncomeBand(taxpayerTotalIncomeJpy: Decimal): TaxpayerIncomeBand | null {
  if (taxpayerTotalIncomeJpy.greaterThan(10_000_000)) return null;
  if (taxpayerTotalIncomeJpy.greaterThan(9_500_000)) return "OVER_950_UP_TO_1000";
  if (taxpayerTotalIncomeJpy.greaterThan(9_000_000)) return "OVER_900_UP_TO_950";
  return "UP_TO_900";
}

const BAND_INDEX: Record<TaxpayerIncomeBand, 0 | 1 | 2> = {
  UP_TO_900: 0,
  OVER_900_UP_TO_950: 1,
  OVER_950_UP_TO_1000: 2,
};

/** 配偶者特別控除の対象となる配偶者の合計所得金額の上限 */
const SPOUSE_INCOME_LIMIT_FOR_SPECIAL_DEDUCTION = 1_330_000;

/** 配偶者控除額(一般/老人控除対象配偶者)。[900万以下, 900万超950万以下, 950万超1000万以下] */
const SPOUSE_DEDUCTION_AMOUNTS = {
  general: { incomeTax: [380_000, 260_000, 130_000], residentTax: [330_000, 220_000, 110_000] },
  elderly: { incomeTax: [480_000, 320_000, 160_000], residentTax: [380_000, 260_000, 130_000] },
} as const;

/**
 * 配偶者特別控除の速算表。配偶者の合計所得金額の上限(この金額以下)ごとに、
 * 納税者本人の合計所得金額の3区分([900万以下, 900万超950万以下, 950万超1000万以下])に
 * 対応する控除額(所得税・住民税)を並べる。48万円超の最初の区分から順に判定する。
 */
const SPOUSE_SPECIAL_DEDUCTION_TABLE: Array<{
  maxSpouseIncomeJpy: number;
  incomeTax: [number, number, number];
  residentTax: [number, number, number];
}> = [
  { maxSpouseIncomeJpy: 950_000, incomeTax: [380_000, 260_000, 130_000], residentTax: [330_000, 220_000, 110_000] },
  { maxSpouseIncomeJpy: 1_000_000, incomeTax: [360_000, 240_000, 120_000], residentTax: [330_000, 220_000, 110_000] },
  { maxSpouseIncomeJpy: 1_050_000, incomeTax: [310_000, 210_000, 110_000], residentTax: [310_000, 210_000, 110_000] },
  { maxSpouseIncomeJpy: 1_100_000, incomeTax: [260_000, 180_000, 90_000], residentTax: [260_000, 180_000, 90_000] },
  { maxSpouseIncomeJpy: 1_150_000, incomeTax: [210_000, 140_000, 70_000], residentTax: [210_000, 140_000, 70_000] },
  { maxSpouseIncomeJpy: 1_200_000, incomeTax: [160_000, 110_000, 60_000], residentTax: [160_000, 110_000, 60_000] },
  { maxSpouseIncomeJpy: 1_250_000, incomeTax: [110_000, 80_000, 40_000], residentTax: [110_000, 80_000, 40_000] },
  { maxSpouseIncomeJpy: 1_300_000, incomeTax: [60_000, 40_000, 20_000], residentTax: [60_000, 40_000, 20_000] },
  { maxSpouseIncomeJpy: 1_330_000, incomeTax: [30_000, 20_000, 10_000], residentTax: [30_000, 20_000, 10_000] },
];

export interface SpouseDeductionInput {
  /** 控除対象配偶者(民法上の配偶者で、生計を一にし、青色事業専従者等でない)がいるか */
  hasEligibleSpouse: boolean;
  /** 納税者本人のその年の合計所得金額 */
  taxpayerTotalIncomeJpy: Decimal.Value;
  /** 配偶者のその年の合計所得金額 */
  spouseTotalIncomeJpy: Decimal.Value;
  /** 配偶者がその年12月31日時点で70歳以上か(老人控除対象配偶者の判定) */
  spouseIsElderly: boolean;
  /**
   * 課税年分(西暦)。令和7年分(2025年分)以後は同一生計配偶者の合計所得金額要件が
   * 58万円以下(令和6年分以前は48万円以下)になる。省略時は令和6年分以前(48万円)を適用する。
   */
  year?: number;
}

export interface SpouseDeductionResult {
  /** 適用区分 */
  category: "NONE" | "SPOUSE_DEDUCTION" | "SPOUSE_SPECIAL_DEDUCTION";
  incomeTaxAmountJpy: Decimal;
  residentTaxAmountJpy: Decimal;
  notes: string[];
}

export function estimateSpouseDeduction(input: SpouseDeductionInput): SpouseDeductionResult {
  const taxpayerTotalIncomeJpy = new Decimal(input.taxpayerTotalIncomeJpy);
  const spouseTotalIncomeJpy = new Decimal(input.spouseTotalIncomeJpy);
  if (taxpayerTotalIncomeJpy.isNegative()) {
    throw new Error("納税者本人の合計所得金額は0以上である必要があります");
  }
  if (spouseTotalIncomeJpy.isNegative()) {
    throw new Error("配偶者の合計所得金額は0以上である必要があります");
  }

  const notes: string[] = [];
  const zero: SpouseDeductionResult = {
    category: "NONE",
    incomeTaxAmountJpy: new Decimal(0),
    residentTaxAmountJpy: new Decimal(0),
    notes,
  };

  if (!input.hasEligibleSpouse) {
    notes.push("控除対象配偶者がいないため、配偶者控除・配偶者特別控除は適用されない。");
    return zero;
  }

  const band = taxpayerIncomeBand(taxpayerTotalIncomeJpy);
  if (band === null) {
    notes.push("納税者本人の合計所得金額が1,000万円を超えるため、配偶者控除・配偶者特別控除のいずれも適用されない。");
    return zero;
  }
  const bandIndex = BAND_INDEX[band];

  const spouseIncomeLimitForRegularDeduction = dependentIncomeLimitForYear(input.year ?? 0);
  const spouseIncomeLimitJpyLabel = spouseIncomeLimitForRegularDeduction === 580_000 ? "58万円" : "48万円";

  if (spouseTotalIncomeJpy.lessThanOrEqualTo(spouseIncomeLimitForRegularDeduction)) {
    const amounts = input.spouseIsElderly
      ? SPOUSE_DEDUCTION_AMOUNTS.elderly
      : SPOUSE_DEDUCTION_AMOUNTS.general;
    notes.push(
      input.spouseIsElderly
        ? "配偶者が70歳以上(老人控除対象配偶者)のため、通常より控除額が大きい区分を適用した。"
        : `配偶者の合計所得金額が${spouseIncomeLimitJpyLabel}以下のため、配偶者控除(一般の控除対象配偶者)を適用した。`,
    );
    return {
      category: "SPOUSE_DEDUCTION",
      incomeTaxAmountJpy: new Decimal(amounts.incomeTax[bandIndex]),
      residentTaxAmountJpy: new Decimal(amounts.residentTax[bandIndex]),
      notes,
    };
  }

  if (spouseTotalIncomeJpy.lessThanOrEqualTo(SPOUSE_INCOME_LIMIT_FOR_SPECIAL_DEDUCTION)) {
    const row = SPOUSE_SPECIAL_DEDUCTION_TABLE.find((r) =>
      spouseTotalIncomeJpy.lessThanOrEqualTo(r.maxSpouseIncomeJpy),
    );
    if (!row) {
      notes.push("配偶者の合計所得金額が133万円を超えるため、配偶者特別控除は適用されない。");
      return zero;
    }
    notes.push(`配偶者の合計所得金額が${spouseIncomeLimitJpyLabel}超133万円以下のため、配偶者特別控除を適用した。`);
    return {
      category: "SPOUSE_SPECIAL_DEDUCTION",
      incomeTaxAmountJpy: new Decimal(row.incomeTax[bandIndex]),
      residentTaxAmountJpy: new Decimal(row.residentTax[bandIndex]),
      notes,
    };
  }

  notes.push("配偶者の合計所得金額が133万円を超えるため、配偶者特別控除は適用されない。");
  return zero;
}

export type DependentCategory =
  | "UNDER_16"
  | "GENERAL"
  | "SPECIFIED"
  | "SPECIFIED_SPECIAL"
  | "ELDERLY_COHABITING"
  | "ELDERLY_OTHER";

/**
 * 特定親族特別控除(所得税)の控除額の速算表。合計所得金額の上限(この金額以下)ごとの
 * 控除額。58万円超85万円以下の最初の区分から順に判定する。
 */
const SPECIFIED_SPECIAL_DEDUCTION_TABLE: Array<{ maxTotalIncomeJpy: number; incomeTaxJpy: number }> = [
  { maxTotalIncomeJpy: 850_000, incomeTaxJpy: 630_000 },
  { maxTotalIncomeJpy: 900_000, incomeTaxJpy: 610_000 },
  { maxTotalIncomeJpy: 950_000, incomeTaxJpy: 510_000 },
  { maxTotalIncomeJpy: 1_000_000, incomeTaxJpy: 410_000 },
  { maxTotalIncomeJpy: 1_050_000, incomeTaxJpy: 310_000 },
  { maxTotalIncomeJpy: 1_100_000, incomeTaxJpy: 210_000 },
  { maxTotalIncomeJpy: 1_150_000, incomeTaxJpy: 110_000 },
  { maxTotalIncomeJpy: 1_200_000, incomeTaxJpy: 60_000 },
  { maxTotalIncomeJpy: 1_230_000, incomeTaxJpy: 30_000 },
];

/** 特定親族特別控除の対象となる合計所得金額の上限 */
const SPECIFIED_SPECIAL_INCOME_LIMIT = 1_230_000;
/** 住民税の特定親族特別控除が満額(45万円)になる合計所得金額の上限(これを超える範囲は逓減額が未確認) */
const SPECIFIED_SPECIAL_RESIDENT_TAX_FULL_AMOUNT_LIMIT = 950_000;

function specifiedSpecialResidentTaxAmount(totalIncomeJpy: Decimal): {
  amountJpy: Decimal;
  unverified: boolean;
} {
  if (totalIncomeJpy.lessThanOrEqualTo(SPECIFIED_SPECIAL_RESIDENT_TAX_FULL_AMOUNT_LIMIT)) {
    return { amountJpy: new Decimal(450_000), unverified: false };
  }
  return { amountJpy: new Decimal(0), unverified: true };
}

const DEPENDENT_DEDUCTION_AMOUNTS: Record<
  Exclude<DependentCategory, "UNDER_16" | "SPECIFIED_SPECIAL">,
  { incomeTaxJpy: number; residentTaxJpy: number; label: string }
> = {
  GENERAL: { incomeTaxJpy: 380_000, residentTaxJpy: 330_000, label: "一般の控除対象扶養親族" },
  SPECIFIED: { incomeTaxJpy: 630_000, residentTaxJpy: 450_000, label: "特定扶養親族(19〜22歳)" },
  ELDERLY_COHABITING: {
    incomeTaxJpy: 580_000,
    residentTaxJpy: 450_000,
    label: "老人扶養親族(70歳以上・同居老親等)",
  },
  ELDERLY_OTHER: {
    incomeTaxJpy: 480_000,
    residentTaxJpy: 380_000,
    label: "老人扶養親族(70歳以上・同居老親等以外)",
  },
};

export interface DependentInput {
  /** その年12月31日時点の年齢 */
  ageAtYearEnd: number;
  /** その年の合計所得金額 */
  totalIncomeJpy: Decimal.Value;
  /** 70歳以上の場合、納税者本人またはその配偶者の直系尊属(父母・祖父母等)と同居しているか */
  cohabitingElderlyRelative?: boolean;
  /**
   * 課税年分(西暦)。令和7年分(2025年分)以後は扶養親族の合計所得金額要件が
   * 58万円以下(令和6年分以前は48万円以下)になる。省略時は令和6年分以前(48万円)を適用する。
   */
  year?: number;
}

export interface DependentResult {
  category: DependentCategory;
  categoryLabel: string;
  eligible: boolean;
  incomeTaxAmountJpy: Decimal;
  residentTaxAmountJpy: Decimal;
  /**
   * 住民税の控除額が一次情報で確認できていない所得区分(特定親族特別控除の
   * 合計所得金額95万円超123万円以下)に該当する場合true。この場合
   * `residentTaxAmountJpy`は0円として扱っている暫定値であり、実際の申告には
   * 使用せず最新の控除額表を確認すること。
   */
  residentTaxAmountUnverified?: boolean;
  notes?: string[];
}

function categorizeDependent(
  input: DependentInput,
  dependentIncomeLimit: number,
): DependentCategory {
  if (input.ageAtYearEnd < 16) return "UNDER_16";
  if (input.ageAtYearEnd >= 70) {
    return input.cohabitingElderlyRelative ? "ELDERLY_COHABITING" : "ELDERLY_OTHER";
  }
  if (input.ageAtYearEnd >= 19 && input.ageAtYearEnd <= 22) {
    const totalIncomeJpy = new Decimal(input.totalIncomeJpy);
    const isSpecifiedSpecialEligibleYear = (input.year ?? 0) >= REFORM_YEAR_INCOME_REQUIREMENT_580K;
    if (
      isSpecifiedSpecialEligibleYear &&
      totalIncomeJpy.greaterThan(dependentIncomeLimit) &&
      totalIncomeJpy.lessThanOrEqualTo(SPECIFIED_SPECIAL_INCOME_LIMIT)
    ) {
      return "SPECIFIED_SPECIAL";
    }
    return "SPECIFIED";
  }
  return "GENERAL";
}

export function estimateDependentDeduction(input: DependentInput): DependentResult {
  if (input.ageAtYearEnd < 0) {
    throw new Error("年齢は0以上である必要があります");
  }
  const totalIncomeJpy = new Decimal(input.totalIncomeJpy);
  if (totalIncomeJpy.isNegative()) {
    throw new Error("合計所得金額は0以上である必要があります");
  }

  const dependentIncomeLimit = dependentIncomeLimitForYear(input.year ?? 0);
  const category = categorizeDependent(input, dependentIncomeLimit);

  if (category === "SPECIFIED_SPECIAL") {
    const row = SPECIFIED_SPECIAL_DEDUCTION_TABLE.find((r) =>
      totalIncomeJpy.lessThanOrEqualTo(r.maxTotalIncomeJpy),
    );
    const incomeTaxAmountJpy = new Decimal(row?.incomeTaxJpy ?? 0);
    const resident = specifiedSpecialResidentTaxAmount(totalIncomeJpy);
    const notes: string[] = [];
    if (resident.unverified) {
      notes.push(
        "住民税の特定親族特別控除額は、合計所得金額が95万円を超える場合の逓減額の表が一次情報で確認できていないため試算対象外(0円として扱う)。実際の申告では最新の控除額表を確認すること。",
      );
    }
    return {
      category,
      categoryLabel: "特定親族特別控除の対象(19〜22歳・合計所得金額58万円超123万円以下)",
      eligible: true,
      incomeTaxAmountJpy,
      residentTaxAmountJpy: resident.amountJpy,
      residentTaxAmountUnverified: resident.unverified,
      notes,
    };
  }

  if (category === "UNDER_16" || totalIncomeJpy.greaterThan(dependentIncomeLimit)) {
    return {
      category,
      categoryLabel:
        category === "UNDER_16"
          ? "16歳未満(扶養控除の対象外。児童手当の対象)"
          : DEPENDENT_DEDUCTION_AMOUNTS[
              category as Exclude<DependentCategory, "UNDER_16" | "SPECIFIED_SPECIAL">
            ].label,
      eligible: false,
      incomeTaxAmountJpy: new Decimal(0),
      residentTaxAmountJpy: new Decimal(0),
    };
  }

  const amounts =
    DEPENDENT_DEDUCTION_AMOUNTS[category as Exclude<DependentCategory, "UNDER_16" | "SPECIFIED_SPECIAL">];
  return {
    category,
    categoryLabel: amounts.label,
    eligible: true,
    incomeTaxAmountJpy: new Decimal(amounts.incomeTaxJpy),
    residentTaxAmountJpy: new Decimal(amounts.residentTaxJpy),
  };
}

export interface DependentsDeductionSummary {
  results: DependentResult[];
  incomeTaxAmountJpy: Decimal;
  residentTaxAmountJpy: Decimal;
  /** 各扶養親族の`notes`をまとめたもの(重複するメッセージは1件にまとめる) */
  notes: string[];
}

/** 複数の扶養親族の控除額を合算する */
export function summarizeDependentsDeduction(dependents: DependentInput[]): DependentsDeductionSummary {
  const results = dependents.map(estimateDependentDeduction);
  const incomeTaxAmountJpy = results.reduce(
    (total, r) => total.plus(r.incomeTaxAmountJpy),
    new Decimal(0),
  );
  const residentTaxAmountJpy = results.reduce(
    (total, r) => total.plus(r.residentTaxAmountJpy),
    new Decimal(0),
  );
  const notes = [...new Set(results.flatMap((r) => r.notes ?? []))];
  return { results, incomeTaxAmountJpy, residentTaxAmountJpy, notes };
}
