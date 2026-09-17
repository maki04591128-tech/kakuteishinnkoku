import { Decimal } from "decimal.js";

/**
 * 基礎控除(所得税法86条、地方税法314条の2等)を試算する。他の所得控除試算画面と
 * 同様、暗号資産・投資の計算エンジンとは独立した単体の試算ロジック。
 *
 * **令和7年度税制改正(いわゆる「103万円の壁」対応)への対応状況:**
 * 所得税の基礎控除額は、令和7年分(2025年分)・令和8年分(2026年分)以後、
 * 合計所得金額に応じた段階表(132万円以下95万円〜655万円超2,350万円以下58万円)に
 * 変更された。2,350万円超の高所得層側の逓減・消失(2,350万円超2,400万円以下48万円・
 * 2,400万円超2,450万円以下32万円・2,450万円超2,500万円以下16万円・2,500万円超0円)は
 * 令和2年度税制改正以来の既存の仕組みがそのまま適用される(今回の改正はその手前の
 * 段階を細分化したものであり、複数の独立した情報源で数値が一致した)。
 * 令和6年分(2024年分)以前は合計所得金額2,400万円以下一律48万円のまま据え置く。
 *
 * 住民税の基礎控除は今回の改正の対象外で、年分に関わらず合計所得金額2,400万円以下
 * 一律43万円(高所得層側の逓減・消失は2,400万円超2,450万円以下29万円・2,450万円超
 * 2,500万円以下15万円・2,500万円超0円、令和2年度税制改正以来の既存の仕組み)のまま。
 *
 * なお令和8年度税制改正の大綱(令和7年12月26日閣議決定)で物価上昇に連動して
 * 基礎控除等をさらに引き上げる仕組みが決定されているが、これは令和9年分以後の
 * 話であり本モジュールの対象外(今後の課題)。
 */

/** 所得税の基礎控除が合計所得金額に応じた段階表に変わった年分(令和7年度税制改正) */
const REFORM_YEAR = 2025;

interface BasicDeductionBracket {
  /** この金額以下ならこの区分を適用する(合計所得金額) */
  maxTotalIncomeJpy: number;
  amountJpy: number;
}

// 所得税の基礎控除(令和7年分・8年分)
const NATIONAL_BASIC_DEDUCTION_TABLE_AFTER_REFORM: BasicDeductionBracket[] = [
  { maxTotalIncomeJpy: 1_320_000, amountJpy: 950_000 },
  { maxTotalIncomeJpy: 3_360_000, amountJpy: 880_000 },
  { maxTotalIncomeJpy: 4_890_000, amountJpy: 680_000 },
  { maxTotalIncomeJpy: 6_550_000, amountJpy: 630_000 },
  { maxTotalIncomeJpy: 23_500_000, amountJpy: 580_000 },
  { maxTotalIncomeJpy: 24_000_000, amountJpy: 480_000 },
  { maxTotalIncomeJpy: 24_500_000, amountJpy: 320_000 },
  { maxTotalIncomeJpy: 25_000_000, amountJpy: 160_000 },
];

// 所得税の基礎控除(令和6年分以前。2,400万円以下は一律48万円)
const NATIONAL_BASIC_DEDUCTION_TABLE_BEFORE_REFORM: BasicDeductionBracket[] = [
  { maxTotalIncomeJpy: 24_000_000, amountJpy: 480_000 },
  { maxTotalIncomeJpy: 24_500_000, amountJpy: 320_000 },
  { maxTotalIncomeJpy: 25_000_000, amountJpy: 160_000 },
];

// 住民税の基礎控除(令和7年度税制改正の対象外。年分に関わらず同じ表。2,400万円以下は一律43万円)
const RESIDENT_BASIC_DEDUCTION_TABLE: BasicDeductionBracket[] = [
  { maxTotalIncomeJpy: 24_000_000, amountJpy: 430_000 },
  { maxTotalIncomeJpy: 24_500_000, amountJpy: 290_000 },
  { maxTotalIncomeJpy: 25_000_000, amountJpy: 150_000 },
];

function lookupBracketAmountJpy(table: BasicDeductionBracket[], totalIncomeJpy: Decimal): Decimal {
  const row = table.find((r) => totalIncomeJpy.lessThanOrEqualTo(r.maxTotalIncomeJpy));
  return new Decimal(row?.amountJpy ?? 0);
}

export interface BasicDeductionInput {
  /** その年の合計所得金額 */
  totalIncomeJpy: Decimal.Value;
  /**
   * 課税年分(西暦)。令和7年分(2025年分)以後は所得税の基礎控除が合計所得金額に
   * 応じた段階表に変わる。省略時は令和6年分以前(一律48万円)を適用する。
   */
  year?: number;
}

export interface BasicDeductionResult {
  incomeTaxAmountJpy: Decimal;
  residentTaxAmountJpy: Decimal;
  notes: string[];
}

export function estimateBasicDeduction(input: BasicDeductionInput): BasicDeductionResult {
  const totalIncomeJpy = new Decimal(input.totalIncomeJpy);
  if (totalIncomeJpy.isNegative()) {
    throw new Error("合計所得金額は0以上である必要があります");
  }

  const isReformYear = (input.year ?? 0) >= REFORM_YEAR;
  const incomeTaxAmountJpy = lookupBracketAmountJpy(
    isReformYear
      ? NATIONAL_BASIC_DEDUCTION_TABLE_AFTER_REFORM
      : NATIONAL_BASIC_DEDUCTION_TABLE_BEFORE_REFORM,
    totalIncomeJpy,
  );
  const residentTaxAmountJpy = lookupBracketAmountJpy(RESIDENT_BASIC_DEDUCTION_TABLE, totalIncomeJpy);

  const notes: string[] = [];
  notes.push(
    isReformYear
      ? "令和7年度税制改正により、令和7年分(2025年分)以後は所得税の基礎控除額が合計所得金額に応じた段階表に変わった(住民税の基礎控除はこの改正の対象外で従来通り一律43万円)。"
      : "令和6年分(2024年分)以前は所得税の基礎控除は合計所得金額2,400万円以下一律48万円。",
  );
  if (totalIncomeJpy.greaterThan(25_000_000)) {
    notes.push("合計所得金額が2,500万円を超えるため、所得税・住民税とも基礎控除は適用されない。");
  }

  return { incomeTaxAmountJpy, residentTaxAmountJpy, notes };
}
