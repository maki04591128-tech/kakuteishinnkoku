import { Decimal } from "decimal.js";

/**
 * 基礎控除(所得税法86条、地方税法314条の2等)を試算する。他の所得控除試算画面と
 * 同様、暗号資産・投資の計算エンジンとは独立した単体の試算ロジック。
 *
 * **令和7年度税制改正(いわゆる「103万円の壁」対応)への対応状況:**
 * 令和7年分(2025年分)から所得税の基礎控除額が合計所得金額に応じた段階表に変更された。
 * 132万円以下の区分(95万円)と655万円超2,350万円以下の区分(58万円)は令和7年分限りの
 * 数値だが、当初の制度設計では132万円超655万円以下の3区分(88万円/68万円/63万円)は
 * 令和7年分・令和8年分(2026年分)限定の時限的な上乗せで、令和9年分(2027年分)以後は
 * いずれも58万円に統一される予定だった(国税庁「令和７年分 年末調整のしかた」3〜4ページ)。
 *
 * **令和8年度税制改正(物価上昇に連動した基礎控除の引上げ)への対応状況:**
 * 上記の「令和9年分以後は58万円に統一」という制度設計は、令和7年12月26日閣議決定の
 * 令和8年度税制改正の大綱により、施行前に置き換えられた。物価上昇(令和5年11月〜
 * 令和7年10月の消費者物価指数(総合)の上昇率6.0%)に連動して基礎控除等を引き上げる
 * 仕組みが恒久制度として新設され、所得税法86条の基礎控除の本則額そのものが58万円から
 * 62万円に引き上げられた(令和8年分以後)ことに伴い、令和8年分・令和9年分の基礎控除額は
 * 令和7年度税制改正時点の想定より高い水準になっている。国税庁「令和８年度税制改正
 * (所得税の基礎控除の引上げ等関係)Ｑ＆Ａ」(令和8年5月)・「令和８年４月源泉所得税の
 * 改正のあらまし」1〜2ページの表(改正後/改正前の対比表)を突き合わせて確認した結果、
 * 令和8年分・9年分は132万円以下・132万円超336万円以下・336万円超489万円以下の3区分が
 * いずれも104万円に統一され(令和7年分はそれぞれ95万円/88万円/68万円と区分ごとに異なって
 * いたのが統合された形)、489万円超655万円以下は67万円、655万円超2,350万円以下は62万円になる
 * (`NATIONAL_BASIC_DEDUCTION_TABLE_R8_R9`)。令和10年分(2028年分)以後は132万円以下が
 * 99万円、132万円超2,350万円以下は62万円に統一される(`NATIONAL_BASIC_DEDUCTION_TABLE_R10_ONWARD`)。
 * これらの引上げ額は「62万円(本則)+42万円/5万円/37万円」等の加算方式で規定されており、
 * 改正前(令和7年度税制改正時点)の「58万円+37万円/30万円/10万円/5万円」という加算方式と
 * 完全に対応する(改正のQ&A自体の注記で確認)。
 * 2,350万円超の高所得層側の逓減・消失(2,350万円超2,400万円以下48万円・
 * 2,400万円超2,450万円以下32万円・2,450万円超2,500万円以下16万円・2,500万円超0円)は
 * 今回の令和8年度税制改正でも変更が無い(Q&Aの注4に明記)ため、年分を問わず令和2年度
 * 税制改正以来の既存の仕組みがそのまま適用される。
 * 令和6年分(2024年分)以前は合計所得金額2,400万円以下一律48万円のまま据え置く。
 *
 * 住民税の基礎控除は令和7年度・令和8年度いずれの税制改正の対象外(「個人住民税は
 * 地域社会の会費的な性格を踏まえ引き上げない」との説明が財務省・複数の自治体解説で
 * 一致)で、年分に関わらず合計所得金額2,400万円以下一律43万円(高所得層側の逓減・消失は
 * 2,400万円超2,450万円以下29万円・2,450万円超2,500万円以下15万円・2,500万円超0円、
 * 令和2年度税制改正以来の既存の仕組み)のまま。
 *
 * **制約:** 令和10年分以後の基礎控除額は、令和8年度税制改正により「２年ごとに、直前の
 * 見直し後の額に、見直し後2年間の全国消費者物価指数の変化率を乗じた額を基準に見直しを
 * 行う」恒久的な物価連動の仕組みが新設された(前掲「源泉所得税の改正のあらまし」3ページ)。
 * 本モジュールが実装する令和10年分の数値(99万円/62万円)はこの物価連動の仕組みによる
 * 最初の適用結果で一次情報(国税庁)で確認済みだが、令和12年分(2030年分)以後は次回の
 * 物価連動見直しにより数値が変わり得る。見直し後の具体的な金額はまだ公表されていないため
 * 引き続き今後の課題とし、本モジュールは令和12年分以後も令和10年分の数値を暫定適用する
 * (基礎控除の住民税調整控除への影響は`src/lib/residentTaxAdjustmentDeduction.ts`参照)。
 */

/** 所得税の基礎控除が合計所得金額に応じた段階表に変わった年分(令和7年度税制改正) */
const REFORM_START_YEAR = 2025;
/** 令和7年分限定の段階表(95万円/88万円/68万円/63万円/58万円)が適用される年分 */
const REFORM_R7_ONLY_YEAR = 2025;
/** 令和8年度税制改正後の段階表(104万円/67万円/62万円等)が適用される最後の年分 */
const REFORM_R8_R9_LAST_YEAR = 2027;

interface BasicDeductionBracket {
  /** この金額以下ならこの区分を適用する(合計所得金額) */
  maxTotalIncomeJpy: number;
  amountJpy: number;
}

// 所得税の基礎控除(令和7年分限定。令和8年度税制改正前の令和7年度税制改正時点の段階表)
const NATIONAL_BASIC_DEDUCTION_TABLE_R7: BasicDeductionBracket[] = [
  { maxTotalIncomeJpy: 1_320_000, amountJpy: 950_000 },
  { maxTotalIncomeJpy: 3_360_000, amountJpy: 880_000 },
  { maxTotalIncomeJpy: 4_890_000, amountJpy: 680_000 },
  { maxTotalIncomeJpy: 6_550_000, amountJpy: 630_000 },
  { maxTotalIncomeJpy: 23_500_000, amountJpy: 580_000 },
  { maxTotalIncomeJpy: 24_000_000, amountJpy: 480_000 },
  { maxTotalIncomeJpy: 24_500_000, amountJpy: 320_000 },
  { maxTotalIncomeJpy: 25_000_000, amountJpy: 160_000 },
];

// 所得税の基礎控除(令和8年分・9年分。令和8年度税制改正により132万円以下・132万円超336万円
// 以下・336万円超489万円以下の3区分が104万円に統一され、489万円超655万円以下は67万円、
// 655万円超2,350万円以下は62万円に引き上げられた)
const NATIONAL_BASIC_DEDUCTION_TABLE_R8_R9: BasicDeductionBracket[] = [
  { maxTotalIncomeJpy: 4_890_000, amountJpy: 1_040_000 },
  { maxTotalIncomeJpy: 6_550_000, amountJpy: 670_000 },
  { maxTotalIncomeJpy: 23_500_000, amountJpy: 620_000 },
  { maxTotalIncomeJpy: 24_000_000, amountJpy: 480_000 },
  { maxTotalIncomeJpy: 24_500_000, amountJpy: 320_000 },
  { maxTotalIncomeJpy: 25_000_000, amountJpy: 160_000 },
];

// 所得税の基礎控除(令和10年分以後。令和8年度税制改正で新設された物価連動の仕組みによる
// 最初の見直し結果。132万円以下は99万円、132万円超2,350万円以下は62万円に統一される)
const NATIONAL_BASIC_DEDUCTION_TABLE_R10_ONWARD: BasicDeductionBracket[] = [
  { maxTotalIncomeJpy: 1_320_000, amountJpy: 990_000 },
  { maxTotalIncomeJpy: 23_500_000, amountJpy: 620_000 },
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
   * 課税年分(西暦)。令和7年分(2025年分)は所得税の基礎控除が合計所得金額に応じた
   * 段階表に変わり、令和8年分(2026年分)・令和9年分(2027年分)は令和8年度税制改正
   * (物価連動の基礎控除引上げ)によりさらに引き上げられた段階表になる。令和10年分
   * (2028年分)以後は同改正で新設された物価連動の仕組みによる最初の見直し結果を適用する
   * (令和12年分以後のさらなる見直しは未確定のため令和10年分の数値を暫定適用)。省略時は
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
  const isR7OnlyYear = year === REFORM_R7_ONLY_YEAR;
  const isR8R9Year = isReformYear && !isR7OnlyYear && year <= REFORM_R8_R9_LAST_YEAR;
  const nationalTable = !isReformYear
    ? NATIONAL_BASIC_DEDUCTION_TABLE_BEFORE_REFORM
    : isR7OnlyYear
      ? NATIONAL_BASIC_DEDUCTION_TABLE_R7
      : isR8R9Year
        ? NATIONAL_BASIC_DEDUCTION_TABLE_R8_R9
        : NATIONAL_BASIC_DEDUCTION_TABLE_R10_ONWARD;
  const incomeTaxAmountJpy = lookupBracketAmountJpy(nationalTable, totalIncomeJpy);
  const residentTaxAmountJpy = lookupBracketAmountJpy(RESIDENT_BASIC_DEDUCTION_TABLE, totalIncomeJpy);

  const notes: string[] = [];
  if (!isReformYear) {
    notes.push("令和6年分(2024年分)以前は所得税の基礎控除は合計所得金額2,400万円以下一律48万円。");
  } else if (isR7OnlyYear) {
    notes.push(
      "令和7年度税制改正により、令和7年分(2025年分)は所得税の基礎控除額が合計所得金額に応じた段階表(132万円以下95万円・132万円超336万円以下88万円・336万円超489万円以下68万円・489万円超655万円以下63万円・655万円超2,350万円以下58万円)に変わった(住民税の基礎控除はこの改正の対象外で従来通り一律43万円)。",
    );
  } else if (isR8R9Year) {
    notes.push(
      "令和8年度税制改正(物価上昇に連動した基礎控除の恒久的な引上げ)により、令和8年分(2026年分)・令和9年分(2027年分)の所得税の基礎控除額は令和7年度税制改正時点の予定(令和9年分は58万円に統一)よりさらに引き上げられた(132万円以下・132万円超336万円以下・336万円超489万円以下がいずれも104万円に統一、489万円超655万円以下は67万円、655万円超2,350万円以下は62万円。住民税の基礎控除はこの改正の対象外で従来通り一律43万円)。",
    );
  } else {
    notes.push(
      "令和10年分(2028年分)以後は、令和8年度税制改正で新設された物価連動の仕組みによる最初の見直し結果として、132万円以下は99万円、132万円超2,350万円以下は62万円に統一される(住民税の基礎控除はこの改正の対象外で従来通り一律43万円)。令和12年分(2030年分)以後の2回目以降の物価連動見直しの具体的な金額は本稿執筆時点で未公表のため、判明するまでは令和10年分の数値を暫定適用する。",
    );
  }
  if (totalIncomeJpy.greaterThan(25_000_000)) {
    notes.push("合計所得金額が2,500万円を超えるため、所得税・住民税とも基礎控除は適用されない。");
  }

  return { incomeTaxAmountJpy, residentTaxAmountJpy, notes };
}
