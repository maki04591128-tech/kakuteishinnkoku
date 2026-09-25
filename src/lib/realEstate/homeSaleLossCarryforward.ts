import { Decimal } from "decimal.js";

/**
 * 特定居住用財産の譲渡損失の損益通算及び繰越控除の特例(租税特別措置法41条の5の2、
 * 国税庁タックスアンサーNo.3390)。
 *
 * 居住用財産(マイホーム)を譲渡した場合の税額試算(src/lib/realEstate/
 * homeSaleTaxSimulation.ts)は譲渡益が生じた場合の特例(3,000万円特別控除・
 * 軽減税率の特例)のみを対象とし、譲渡損失が生じた場合の特例は「買換資産の
 * 借入金等の別データが必要」という理由で対象外としていた。しかしそのうち
 * 「特定居住用財産の譲渡損失の損益通算及び繰越控除の特例」(措置法41条の5の2)は、
 * 買い換え(新居の取得)を要件とせず、譲渡した家屋に係る住宅ローンの残高
 * (譲渡契約締結日の前日時点)のみで損益通算の限度額が決まるため、買換資産の
 * データなしで試算できる。もう一方の「居住用財産の買換え等の場合の譲渡損失の
 * 損益通算及び繰越控除の特例」(措置法41条の5)は、新居の取得価額・床面積・
 * 住宅ローン(償還期間10年以上)等の買換資産側のデータが要件判定に必須のため、
 * 引き続き対象外とする(今後の課題)。
 *
 * 主な要件(措置法41条の5の2・国税庁タックスアンサーNo.3390):
 *  - 譲渡資産が現に又は以前居住していた家屋・その敷地であること(国内に所在)
 *  - 譲渡した年の1月1日時点の所有期間が5年を超えること
 *  - 譲渡契約締結日の前日時点で、その家屋に係る償還期間10年以上の住宅借入金等の
 *    残高があること
 *  - 譲渡価額が上記住宅借入金等の残高を下回ること
 *  - 上記以外の要件(自己の居住用財産であること、配偶者・直系血族等特別の関係が
 *    ある者への譲渡でないこと、前年・前々年に他の居住用財産の譲渡損失の特例や
 *    3,000万円特別控除等の適用を受けていないこと等)は本ツールでは判定せず、
 *    ユーザー自身が確認したうえで入力するチェック項目(otherRequirementsEligible)とする。
 *
 * 損益通算の対象となる譲渡損失額は、次のいずれか少ない額(措置法41条の5の2第1項):
 *  (1) 実際の譲渡損失額(取得費・譲渡費用の合計が譲渡価額を上回る額)
 *  (2) 譲渡契約締結日の前日時点の住宅借入金等残高 - 譲渡価額(損益通算限度額)
 *
 * 損益通算はその年の他の所得(総所得金額等)から控除でき所得制限は無いが、控除
 * しきれなかった金額(譲渡損失の金額)を翌年以後3年間繰り越して控除する場合、
 * その年の合計所得金額が3,000万円を超える年は繰越控除を適用できない(雑損失の
 * 繰越控除・上場株式等の譲渡損失の繰越控除と異なり所得制限がある点に注意)。
 * この所得制限は繰越控除を適用する年ごとの判定であり、国税庁公式ページに
 * 期間延長に関する明記は無いため、超過した年があっても3年間という繰越期間自体は
 * 延長しないものとして扱う(雑損失の繰越控除・上場株式等の譲渡損失の繰越控除
 * (いずれも所得制限自体は無い)と同じ「発生年から3年固定」の解釈を踏襲した)。
 */

const CARRYFORWARD_YEARS = 3;
const CARRYFORWARD_INCOME_LIMIT_JPY = new Decimal(30_000_000);
const MIN_OWNERSHIP_YEARS = 5;

export interface HomeSaleLossInput {
  /** 譲渡価額(売却代金) */
  transferPriceJpy: Decimal.Value;
  /** 取得費 */
  acquisitionCostJpy: Decimal.Value;
  /** 譲渡費用(仲介手数料・印紙税等) */
  transferExpensesJpy: Decimal.Value;
  /** 譲渡した年の1月1日時点の所有期間(年) */
  ownershipYears: number;
  /** 譲渡契約締結日の前日時点の、その家屋に係る償還期間10年以上の住宅借入金等の残高 */
  mortgageBalanceJpy: Decimal.Value;
  /**
   * 所有期間・住宅借入金等残高の要件以外の適用要件(自己の居住用財産であること、
   * 配偶者・直系血族等特別の関係がある者への譲渡でないこと、前年・前々年に
   * 他の居住用財産の譲渡損失の特例や3,000万円特別控除等の適用を受けていないこと等)
   * をユーザー自身が確認したか
   */
  otherRequirementsEligible: boolean;
}

export interface HomeSaleLossResult {
  /** 実際の譲渡損失額(取得費+譲渡費用-譲渡価額。譲渡益の場合は0) */
  transferLossJpy: Decimal;
  /** 所有期間の要件(譲渡年の1月1日時点で5年超)を満たすか */
  ownershipPeriodEligible: boolean;
  /** 住宅借入金等残高の要件(残高が譲渡価額を上回ること)を満たすか */
  mortgageConditionEligible: boolean;
  /** 全ての要件を満たし、この特例の対象になるか */
  eligible: boolean;
  /** 損益通算限度額(住宅借入金等残高-譲渡価額。要件を満たさない場合は0) */
  offsetLimitJpy: Decimal;
  /** 損益通算・繰越控除の対象になる譲渡損失額(transferLossJpyとoffsetLimitJpyのいずれか少ない額) */
  eligibleLossJpy: Decimal;
  notes: string[];
}

/**
 * 譲渡価額・取得費・譲渡費用・所有期間・住宅借入金等残高から、特定居住用財産の
 * 譲渡損失の損益通算及び繰越控除の特例の対象になる譲渡損失額を算出する。
 * DBに依存しない純粋関数。
 */
export function calculateHomeSaleLoss(input: HomeSaleLossInput): HomeSaleLossResult {
  const transferPrice = new Decimal(input.transferPriceJpy);
  const acquisitionCost = new Decimal(input.acquisitionCostJpy);
  const transferExpenses = new Decimal(input.transferExpensesJpy);
  const mortgageBalance = new Decimal(input.mortgageBalanceJpy);

  if (
    transferPrice.isNegative() ||
    acquisitionCost.isNegative() ||
    transferExpenses.isNegative() ||
    mortgageBalance.isNegative()
  ) {
    throw new Error("金額はいずれも0以上である必要があります");
  }
  if (!Number.isInteger(input.ownershipYears) || input.ownershipYears < 0) {
    throw new Error("所有期間は0以上の整数(年)で入力してください");
  }

  const transferLossJpy = Decimal.max(
    0,
    acquisitionCost.plus(transferExpenses).minus(transferPrice),
  );
  const ownershipPeriodEligible = input.ownershipYears > MIN_OWNERSHIP_YEARS;
  const mortgageConditionEligible = mortgageBalance.greaterThan(transferPrice);
  const eligible =
    ownershipPeriodEligible &&
    mortgageConditionEligible &&
    input.otherRequirementsEligible &&
    transferLossJpy.greaterThan(0);

  const offsetLimitJpy = mortgageConditionEligible
    ? mortgageBalance.minus(transferPrice)
    : new Decimal(0);
  const eligibleLossJpy = eligible ? Decimal.min(transferLossJpy, offsetLimitJpy) : new Decimal(0);

  const notes: string[] = [];
  if (transferLossJpy.isZero()) {
    notes.push(
      "譲渡益が生じているためこの特例の対象外(譲渡益の場合は居住用財産の3,000万円特別控除・軽減税率の特例(homeSaleTaxSimulation.ts)を参照)。",
    );
  }
  if (!ownershipPeriodEligible) {
    notes.push(
      `所有期間が譲渡年の1月1日時点で${MIN_OWNERSHIP_YEARS}年以下のため対象外(要件: ${MIN_OWNERSHIP_YEARS}年超)。`,
    );
  }
  if (!mortgageConditionEligible) {
    notes.push(
      "譲渡価額が住宅借入金等残高以上のため対象外(要件: 譲渡契約締結日の前日時点の住宅借入金等残高が譲渡価額を上回ること)。",
    );
  }
  if (!input.otherRequirementsEligible) {
    notes.push(
      "所有期間・住宅借入金等残高の要件以外(自己の居住用財産であること、配偶者・直系血族等特別の関係がある者への譲渡でないこと、前年・前々年に他の居住用財産譲渡の特例の適用を受けていないこと等)を満たすかどうかは自身で確認すること。",
    );
  }
  if (eligible && eligibleLossJpy.lessThan(transferLossJpy)) {
    notes.push(
      "譲渡損失額が損益通算限度額(住宅借入金等残高-譲渡価額)を上回るため、限度額までのみが損益通算・繰越控除の対象になる。",
    );
  }

  return {
    transferLossJpy,
    ownershipPeriodEligible,
    mortgageConditionEligible,
    eligible,
    offsetLimitJpy,
    eligibleLossJpy,
    notes,
  };
}

export interface HomeSaleLossCarryforwardEntry {
  /** 譲渡損失が発生した年(暦年) */
  originYear: number;
  /** 計算対象年の年初時点で残っている繰越控除可能な譲渡損失額 */
  remainingAmountJpy: Decimal.Value;
}

export interface HomeSaleLossCarryforwardUsage {
  originYear: number;
  usedAmountJpy: Decimal;
}

export interface HomeSaleLossCarryforwardExpiry {
  originYear: number;
  expiredAmountJpy: Decimal;
}

export interface HomeSaleLossCarryforwardBalance {
  originYear: number;
  remainingAmountJpy: Decimal;
}

export interface HomeSaleLossCarryforwardResult {
  currentYear: number;
  /** その年の総所得金額等(繰越控除・当年分の損益通算を差し引く前) */
  totalIncomeJpy: Decimal;
  /** 当年新たに発生した損益通算対象の譲渡損失額(calculateHomeSaleLossのeligibleLossJpy) */
  currentYearEligibleLossJpy: Decimal;
  /** その年の合計所得金額(totalIncomeJpyと同値として判定)が3,000万円を超え、
   * 前年以前からの繰越控除を適用できない年かどうか(当年発生分の損益通算には適用されない) */
  carryforwardIncomeLimitExceeded: boolean;
  /** 前年以前からの繰越控除の使用内訳(発生年の古い順に使用) */
  usedCarryforwardByOriginYear: HomeSaleLossCarryforwardUsage[];
  /** 前年以前からの繰越控除の使用合計額 */
  totalCarryforwardUsedJpy: Decimal;
  /** 当年発生分の譲渡損失額のうち、繰越控除使用後の残り所得枠から当年の所得に適用できた金額 */
  currentYearLossUsedJpy: Decimal;
  /** 実際にその年の総所得金額等から控除された合計額(繰越控除使用額+当年発生分適用額) */
  totalDeductionAppliedJpy: Decimal;
  /** 損益通算・繰越控除後の総所得金額等(0未満にはならない) */
  taxableIncomeAfterCarryforwardJpy: Decimal;
  /** 控除期限(発生年から3年)を過ぎて当年は使用できなかった繰越譲渡損失 */
  expiredByOriginYear: HomeSaleLossCarryforwardExpiry[];
  /** 当年発生分の譲渡損失額のうち総所得金額等から控除しきれず、翌年以後に新たに繰り越す金額 */
  newLossJpy: Decimal;
  /** 翌年に繰り越す残高(発生年ごと。当年の新規繰越損失を含む) */
  carryforwardToNextYear: HomeSaleLossCarryforwardBalance[];
}

/**
 * 当年発生分の損益通算対象額(calculateHomeSaleLossのeligibleLossJpy。無ければ0)・
 * 総所得金額等と、年初時点で残っている発生年ごとの繰越譲渡損失残高から、
 * 損益通算及び繰越控除の適用結果を計算する。DBに依存しない純粋関数。
 *
 * 上場株式等の譲渡損失の繰越控除(src/lib/investment/lossCarryforward.ts)・
 * 雑損失の繰越控除(src/lib/casualtyLossCarryforward.ts)と同様、複数年分の
 * 繰越譲渡損失が残っている場合は発生年が古いものから優先して総所得金額等に
 * 充当する。ただし本特例は繰越控除の適用年について合計所得金額3,000万円以下の
 * 要件があるため、その年の総所得金額等(totalIncomeJpy)が3,000万円を超える場合は
 * 前年以前からの繰越控除を一切使用できない(当年発生分の損益通算には所得制限が
 * 無いため、currentYearEligibleLossJpyの適用には影響しない)。
 */
export function calculateHomeSaleLossCarryforward(
  currentYear: number,
  currentYearEligibleLossJpy: Decimal.Value,
  totalIncomeJpy: Decimal.Value,
  entries: HomeSaleLossCarryforwardEntry[],
): HomeSaleLossCarryforwardResult {
  const loss = new Decimal(currentYearEligibleLossJpy);
  const totalIncome = new Decimal(totalIncomeJpy);

  if (loss.isNegative()) {
    throw new Error("当年分の損益通算対象額は0以上である必要があります");
  }
  if (totalIncome.isNegative()) {
    throw new Error("総所得金額等は0以上である必要があります");
  }

  const carryforwardIncomeLimitExceeded = totalIncome.greaterThan(
    CARRYFORWARD_INCOME_LIMIT_JPY,
  );

  const sorted = entries
    .map((e) => ({
      originYear: e.originYear,
      remainingAmountJpy: new Decimal(e.remainingAmountJpy),
    }))
    .filter((e) => e.remainingAmountJpy.greaterThan(0))
    .sort((a, b) => a.originYear - b.originYear);

  const expiredByOriginYear: HomeSaleLossCarryforwardExpiry[] = [];
  const usable: HomeSaleLossCarryforwardBalance[] = [];

  for (const e of sorted) {
    // originYear の譲渡損失は originYear+1 〜 originYear+3 の3年間のみ控除に使える
    if (currentYear > e.originYear + CARRYFORWARD_YEARS) {
      expiredByOriginYear.push({
        originYear: e.originYear,
        expiredAmountJpy: e.remainingAmountJpy,
      });
    } else {
      usable.push(e);
    }
  }

  let availableForCarryforward = carryforwardIncomeLimitExceeded
    ? new Decimal(0)
    : totalIncome;
  const usedCarryforwardByOriginYear: HomeSaleLossCarryforwardUsage[] = [];
  const carryforwardToNextYear: HomeSaleLossCarryforwardBalance[] = [];

  for (const e of usable) {
    if (availableForCarryforward.isZero()) {
      carryforwardToNextYear.push(e);
      continue;
    }
    const used = Decimal.min(availableForCarryforward, e.remainingAmountJpy);
    if (used.greaterThan(0)) {
      usedCarryforwardByOriginYear.push({ originYear: e.originYear, usedAmountJpy: used });
    }
    availableForCarryforward = availableForCarryforward.minus(used);
    const remaining = e.remainingAmountJpy.minus(used);
    if (remaining.greaterThan(0)) {
      carryforwardToNextYear.push({
        originYear: e.originYear,
        remainingAmountJpy: remaining,
      });
    }
  }

  const totalCarryforwardUsedJpy = usedCarryforwardByOriginYear.reduce(
    (sum, u) => sum.plus(u.usedAmountJpy),
    new Decimal(0),
  );

  // 損益通算(当年発生分)には所得制限が無いため、繰越控除の使用額を差し引いた
  // 残り所得枠全体を当年発生分に充てられる。
  const availableForCurrentYear = totalIncome.minus(totalCarryforwardUsedJpy);
  const currentYearLossUsedJpy = Decimal.min(availableForCurrentYear, loss);
  const newLossJpy = loss.minus(currentYearLossUsedJpy);
  const totalDeductionAppliedJpy = totalCarryforwardUsedJpy.plus(currentYearLossUsedJpy);
  const taxableIncomeAfterCarryforwardJpy = totalIncome.minus(totalDeductionAppliedJpy);

  if (newLossJpy.greaterThan(0)) {
    carryforwardToNextYear.push({
      originYear: currentYear,
      remainingAmountJpy: newLossJpy,
    });
  }

  return {
    currentYear,
    totalIncomeJpy: totalIncome,
    currentYearEligibleLossJpy: loss,
    carryforwardIncomeLimitExceeded,
    usedCarryforwardByOriginYear,
    totalCarryforwardUsedJpy,
    currentYearLossUsedJpy,
    totalDeductionAppliedJpy,
    taxableIncomeAfterCarryforwardJpy,
    expiredByOriginYear,
    newLossJpy,
    carryforwardToNextYear: carryforwardToNextYear.sort(
      (a, b) => a.originYear - b.originYear,
    ),
  };
}
