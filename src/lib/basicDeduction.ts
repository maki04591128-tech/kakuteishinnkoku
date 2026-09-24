import { Decimal } from "decimal.js";

/**
 * 基礎控除(所得税法86条、地方税法314条の2等)を試算する。他の所得控除試算画面と
 * 同様、暗号資産・投資の計算エンジンとは独立した単体の試算ロジック。
 *
 * **令和7年度税制改正(いわゆる「103万円の壁」対応)への対応状況:**
 * 所得税の基礎控除額は、合計所得金額に応じた段階表に変更されたが、国税庁「令和７年分
 * 年末調整のしかた」(3〜4ページ)によれば、この段階表は**令和7年分・令和8年分限定の
 * 時限的な上乗せ**であり、令和9年分(2027年分)以後は一部の区分がさらに変わる
 * 2段階の改正になっている(以下の`NATIONAL_BASIC_DEDUCTION_TABLE_R7_R8`・
 * `NATIONAL_BASIC_DEDUCTION_TABLE_R9_ONWARD`を参照。以前のコメントでは令和7年分・8年分の
 * 表がそのまま令和9年分以後も続くかのように誤って読めたため修正した)。
 * 132万円以下の区分(95万円)と655万円超2,350万円以下の区分(58万円)は令和7年分以後
 * 恒久的に変わらないが、132万円超655万円以下の3区分(令和7・8年分は88万円/68万円/63万円)は
 * 令和9年分以後はいずれも58万円に統一される(時限的な上乗せが終了する)。
 * 2,350万円超の高所得層側の逓減・消失(2,350万円超2,400万円以下48万円・
 * 2,400万円超2,450万円以下32万円・2,450万円超2,500万円以下16万円・2,500万円超0円)は
 * 年分を問わず令和2年度税制改正以来の既存の仕組みがそのまま適用される(今回の改正は
 * その手前の段階を細分化したものであり、複数の独立した情報源で数値が一致した)。
 * 令和6年分(2024年分)以前は合計所得金額2,400万円以下一律48万円のまま据え置く。
 *
 * 住民税の基礎控除は今回の改正の対象外で、年分に関わらず合計所得金額2,400万円以下
 * 一律43万円(高所得層側の逓減・消失は2,400万円超2,450万円以下29万円・2,450万円超
 * 2,500万円以下15万円・2,500万円超0円、令和2年度税制改正以来の既存の仕組み)のまま。
 *
 * なお令和8年度税制改正の大綱(令和7年12月26日閣議決定)で物価上昇に連動して
 * 基礎控除等をさらに引き上げる仕組みが決定されているが、これは上記の令和9年分以後の
 * 表(58万円への統一)とは別の、さらなる将来の話であり本モジュールの対象外(今後の課題)。
 */

/** 所得税の基礎控除が合計所得金額に応じた段階表に変わった年分(令和7年度税制改正) */
const REFORM_START_YEAR = 2025;
/** 132万円超655万円以下の時限的な上乗せ(88万円/68万円/63万円)が適用される最後の年分 */
const REFORM_TIME_LIMITED_UPLIFT_LAST_YEAR = 2026;

interface BasicDeductionBracket {
  /** この金額以下ならこの区分を適用する(合計所得金額) */
  maxTotalIncomeJpy: number;
  amountJpy: number;
}

// 所得税の基礎控除(令和7年分・8年分限定。132万円超655万円以下は時限的な上乗せ)
const NATIONAL_BASIC_DEDUCTION_TABLE_R7_R8: BasicDeductionBracket[] = [
  { maxTotalIncomeJpy: 1_320_000, amountJpy: 950_000 },
  { maxTotalIncomeJpy: 3_360_000, amountJpy: 880_000 },
  { maxTotalIncomeJpy: 4_890_000, amountJpy: 680_000 },
  { maxTotalIncomeJpy: 6_550_000, amountJpy: 630_000 },
  { maxTotalIncomeJpy: 23_500_000, amountJpy: 580_000 },
  { maxTotalIncomeJpy: 24_000_000, amountJpy: 480_000 },
  { maxTotalIncomeJpy: 24_500_000, amountJpy: 320_000 },
  { maxTotalIncomeJpy: 25_000_000, amountJpy: 160_000 },
];

// 所得税の基礎控除(令和9年分(2027年分)以後。132万円超655万円以下の時限的な上乗せが終了し
// 58万円に統一される。132万円以下(95万円)と655万円超2,350万円以下(58万円)は令和7・8年分と同じ)
const NATIONAL_BASIC_DEDUCTION_TABLE_R9_ONWARD: BasicDeductionBracket[] = [
  { maxTotalIncomeJpy: 1_320_000, amountJpy: 950_000 },
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
   * 課税年分(西暦)。令和7年分(2025年分)・令和8年分(2026年分)は所得税の基礎控除が
   * 合計所得金額に応じた段階表(132万円超655万円以下は時限的な上乗せ)に変わり、
   * 令和9年分(2027年分)以後はその時限的な上乗せが終了した表に変わる。省略時は
   * 令和6年分以前(一律48万円)を適用する。
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

  const year = input.year ?? 0;
  const isReformYear = year >= REFORM_START_YEAR;
  const isTimeLimitedUpliftYear = isReformYear && year <= REFORM_TIME_LIMITED_UPLIFT_LAST_YEAR;
  const nationalTable = !isReformYear
    ? NATIONAL_BASIC_DEDUCTION_TABLE_BEFORE_REFORM
    : isTimeLimitedUpliftYear
      ? NATIONAL_BASIC_DEDUCTION_TABLE_R7_R8
      : NATIONAL_BASIC_DEDUCTION_TABLE_R9_ONWARD;
  const incomeTaxAmountJpy = lookupBracketAmountJpy(nationalTable, totalIncomeJpy);
  const residentTaxAmountJpy = lookupBracketAmountJpy(RESIDENT_BASIC_DEDUCTION_TABLE, totalIncomeJpy);

  const notes: string[] = [];
  if (!isReformYear) {
    notes.push("令和6年分(2024年分)以前は所得税の基礎控除は合計所得金額2,400万円以下一律48万円。");
  } else if (isTimeLimitedUpliftYear) {
    notes.push(
      "令和7年度税制改正により、令和7年分(2025年分)・令和8年分(2026年分)は所得税の基礎控除額が合計所得金額に応じた段階表(132万円超655万円以下は時限的な上乗せ)に変わった(住民税の基礎控除はこの改正の対象外で従来通り一律43万円)。",
    );
  } else {
    notes.push(
      "令和9年分(2027年分)以後は、令和7年度税制改正で令和7・8年分限定だった132万円超655万円以下の時限的な上乗せ(88万円/68万円/63万円)が終了し、その区分は58万円に統一される(132万円以下95万円・655万円超2,350万円以下58万円は変わらず。住民税の基礎控除はこの改正の対象外で従来通り一律43万円)。",
    );
  }
  if (totalIncomeJpy.greaterThan(25_000_000)) {
    notes.push("合計所得金額が2,500万円を超えるため、所得税・住民税とも基礎控除は適用されない。");
  }

  return { incomeTaxAmountJpy, residentTaxAmountJpy, notes };
}
