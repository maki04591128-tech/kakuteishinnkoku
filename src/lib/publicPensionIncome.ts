import { Decimal } from "decimal.js";

/**
 * 公的年金等に係る雑所得の金額(所得税法35条3項、令和2年分(2020年分)以後の
 * 速算表)を試算する。
 *
 * `incomeAmountAdjustmentDeduction.ts`(所得金額調整控除②)は既に計算済みの
 * 「公的年金等に係る雑所得の金額」を入力値として要求していたが、その金額自体を
 * 算出する機能はこれまで無かった(ユーザーが自分で速算表を引いて計算する前提)。
 * 本モジュールは、公的年金等の収入金額・年齢区分・公的年金等以外の合計所得金額を
 * 入力すると、国税庁の速算表(タックスアンサーNo.1600)に基づき公的年金等控除額・
 * 雑所得の金額を計算する。
 *
 * 速算表は年齢区分(収入のあった年の12月31日時点で65歳以上かどうか)と、公的年金等の
 * 収入金額の段階、公的年金等に係る雑所得以外の合計所得金額の区分(1,000万円以下・
 * 1,000万円超2,000万円以下・2,000万円超。令和2年分税制改正で新設された高所得者向けの
 * 逓減区分)の組み合わせで決まる。控除額は「公的年金等の収入金額×控除率-控除額」
 * (最上位・最下位の区分のみ控除率100%の定額控除)で、雑所得の金額はその差額
 * (0円が下限。公的年金等控除額は収入金額を超えない)。
 *
 * 一次情報として、高岡市・伊万里市それぞれの公式ページに掲載された速算表(いずれも
 * 数値が一致)を確認して実装した。この速算表は令和2年分(2020年分)以後、税制改正による
 * 変更が無く現在まで継続している。
 */

export interface PublicPensionIncomeInput {
  /** その年の公的年金等の収入金額の合計(国民年金・厚生年金・企業年金等の合計) */
  pensionIncomeJpy: Decimal.Value;
  /** 収入のあった年の12月31日時点で65歳以上かどうか */
  isAge65OrOlder: boolean;
  /** 公的年金等に係る雑所得以外の合計所得金額(給与所得・事業所得等の合計) */
  otherIncomeExcludingPensionJpy: Decimal.Value;
}

export interface PublicPensionIncomeResult {
  pensionIncomeJpy: Decimal;
  /** 公的年金等控除額(収入金額-雑所得の金額。雑所得が0円未満になる場合は収入金額そのもの) */
  deductionJpy: Decimal;
  /** 公的年金等に係る雑所得の金額(0円が下限) */
  miscIncomeJpy: Decimal;
  notes: string[];
}

interface PensionBracket {
  /** この区分の公的年金等の収入金額の上限(以下)。最上位区分はnull(上限無し) */
  maxJpy: Decimal | null;
  /** 収入金額に乗じる率(最下位・最上位区分は100%の定額控除) */
  rate: Decimal;
  /** 他の所得金額1,000万円以下の場合の控除額(定数項) */
  constantLowJpy: Decimal;
  /** 他の所得金額1,000万円超2,000万円以下の場合の控除額(定数項) */
  constantMidJpy: Decimal;
  /** 他の所得金額2,000万円超の場合の控除額(定数項) */
  constantHighJpy: Decimal;
}

function bracket(
  maxJpy: number | null,
  rate: number,
  constantLowJpy: number,
  constantMidJpy: number,
  constantHighJpy: number,
): PensionBracket {
  return {
    maxJpy: maxJpy === null ? null : new Decimal(maxJpy),
    rate: new Decimal(rate),
    constantLowJpy: new Decimal(constantLowJpy),
    constantMidJpy: new Decimal(constantMidJpy),
    constantHighJpy: new Decimal(constantHighJpy),
  };
}

// 65歳未満(収入のあった年の12月31日時点)の速算表
const BRACKETS_UNDER_65: readonly PensionBracket[] = [
  bracket(1_300_000, 1, 600_000, 500_000, 400_000),
  bracket(4_100_000, 0.75, 275_000, 175_000, 75_000),
  bracket(7_700_000, 0.85, 685_000, 585_000, 485_000),
  bracket(10_000_000, 0.95, 1_455_000, 1_355_000, 1_255_000),
  bracket(null, 1, 1_955_000, 1_855_000, 1_755_000),
];

// 65歳以上(収入のあった年の12月31日時点)の速算表
const BRACKETS_65_OR_OLDER: readonly PensionBracket[] = [
  bracket(3_300_000, 1, 1_100_000, 1_000_000, 900_000),
  bracket(4_100_000, 0.75, 275_000, 175_000, 75_000),
  bracket(7_700_000, 0.85, 685_000, 585_000, 485_000),
  bracket(10_000_000, 0.95, 1_455_000, 1_355_000, 1_255_000),
  bracket(null, 1, 1_955_000, 1_855_000, 1_755_000),
];

function requireNonNegative(value: Decimal, label: string): void {
  if (value.isNegative()) {
    throw new Error(`${label}は0以上である必要があります`);
  }
}

function findBracket(pensionIncomeJpy: Decimal, brackets: readonly PensionBracket[]): PensionBracket {
  for (const b of brackets) {
    if (b.maxJpy === null || pensionIncomeJpy.lessThanOrEqualTo(b.maxJpy)) {
      return b;
    }
  }
  return brackets[brackets.length - 1];
}

export function estimatePublicPensionIncome(
  input: PublicPensionIncomeInput,
): PublicPensionIncomeResult {
  const pensionIncomeJpy = new Decimal(input.pensionIncomeJpy);
  const otherIncomeJpy = new Decimal(input.otherIncomeExcludingPensionJpy);

  requireNonNegative(pensionIncomeJpy, "公的年金等の収入金額");
  requireNonNegative(otherIncomeJpy, "公的年金等に係る雑所得以外の合計所得金額");

  const brackets = input.isAge65OrOlder ? BRACKETS_65_OR_OLDER : BRACKETS_UNDER_65;
  const b = findBracket(pensionIncomeJpy, brackets);
  const constantJpy = otherIncomeJpy.lessThanOrEqualTo(10_000_000)
    ? b.constantLowJpy
    : otherIncomeJpy.lessThanOrEqualTo(20_000_000)
      ? b.constantMidJpy
      : b.constantHighJpy;

  const miscIncomeJpy = Decimal.max(0, pensionIncomeJpy.times(b.rate).minus(constantJpy));
  const deductionJpy = pensionIncomeJpy.minus(miscIncomeJpy);

  const notes: string[] = [
    "国税庁の速算表(タックスアンサーNo.1600)による概算値。公的年金等以外にも遺族年金・障害年金等の非課税の年金がある場合、それらは含めずに公的年金等の収入金額を入力する。",
    "「公的年金等に係る雑所得以外の合計所得金額」は、給与所得・事業所得・投資の譲渡所得等、この雑所得以外の所得の合計額(所得控除前)。不明な場合は1,000万円以下として試算するのが安全側(区分が上がるほど控除額が減るため)。",
    "ここで求めた雑所得の金額は、所得金額調整控除②(`/income-amount-adjustment-deduction`)の「公的年金等に係る雑所得の金額」欄と、総合課税の合計所得金額(`/tax-estimate`の「給与所得等の課税所得金額」に他の所得控除後の金額として合算)に手入力で反映すること。",
  ];

  return { pensionIncomeJpy, deductionJpy, miscIncomeJpy, notes };
}
