import { Decimal } from "decimal.js";

/**
 * 居住用財産の買換え等の場合の譲渡損失の損益通算及び繰越控除の特例
 * (租税特別措置法41条の5、国税庁タックスアンサーNo.3370)。
 *
 * 特定居住用財産の譲渡損失の損益通算及び繰越控除の特例(措置法41条の5の2、
 * homeSaleLossCarryforward.ts)は、買い換え(新居の取得)を要件とせず譲渡した
 * 家屋に係る住宅ローンの残高のみで損益通算の限度額が決まる特例だったが、もう一方の
 * 本特例(措置法41条の5)は、旧居宅を売って新居宅に買い換えた場合が対象で、買換資産
 * (新居宅)側の床面積・住宅ローンのデータが要件判定に必須になる点が異なる
 * (homeSaleLossCarryforward.tsが「今後の課題」としていた項目)。
 *
 * 主な要件(措置法41条の5・国税庁タックスアンサーNo.3370):
 *  - 譲渡資産(旧居宅)が現に又は以前居住していた家屋・その敷地であること(国内に所在)
 *  - 譲渡した年の1月1日時点で旧居宅の所有期間が5年を超えること
 *  - 買換資産(新居宅)の床面積が50㎡以上であること
 *  - 買換資産を取得した年の12月31日時点で、その家屋に係る償還期間10年以上の
 *    住宅借入金等を有すること
 *  - 買換資産に、取得した年の翌年12月31日までの間に居住すること(または居住する
 *    見込みであること)
 *  - 上記以外の要件(自己の居住用財産であること、配偶者・直系血族等特別の関係が
 *    ある者への譲渡でないこと、前年・前々年に他の居住用財産の譲渡損失の特例や
 *    3,000万円特別控除等の適用を受けていないこと等)は本ツールでは判定せず、
 *    ユーザー自身が確認したうえで入力するチェック項目(otherRequirementsEligible)とする。
 *
 * 措置法41条の5の2と異なり、旧居宅の住宅ローン残高による損益通算限度額は無いが、
 * 旧居宅の敷地面積が500㎡を超える場合は、500㎡を超える部分に対応する譲渡損失の
 * 金額は損益通算・繰越控除の対象にならない(措置法41条の5第1項)。按分計算式は
 * 「譲渡損失の金額 × 500㎡ ÷ 敷地面積」(500㎡以下の場合は全額が対象)とした。
 *
 * 損益通算はその年の他の所得(総所得金額等)から控除でき、その年についての合計所得
 * 金額の制限は無い。ただし控除しきれなかった金額(譲渡損失の金額)を翌年以後3年間
 * 繰り越して控除する場合、その年の合計所得金額が3,000万円を超える年に加え、その年の
 * 12月31日時点で買換資産に係る償還期間10年以上の住宅借入金等を有しない年
 * (繰上げ完済等により要件を満たさなくなった年)も繰越控除を適用できない
 * (措置法41条の5第4項)。この点も措置法41条の5の2には無い、買換えの場合固有の
 * 繰越控除年ごとの要件である。
 */

const CARRYFORWARD_YEARS = 3;
const CARRYFORWARD_INCOME_LIMIT_JPY = new Decimal(30_000_000);
const MIN_OWNERSHIP_YEARS = 5;
const MIN_NEW_HOME_FLOOR_AREA_SQM = 50;
const MAX_PRORATED_SITE_AREA_SQM = 500;

export interface HomeReplacementLossInput {
  /** 譲渡価額(旧居宅の売却代金) */
  transferPriceJpy: Decimal.Value;
  /** 取得費(旧居宅) */
  acquisitionCostJpy: Decimal.Value;
  /** 譲渡費用(仲介手数料・印紙税等) */
  transferExpensesJpy: Decimal.Value;
  /** 譲渡した年の1月1日時点の、旧居宅の所有期間(年) */
  ownershipYears: number;
  /** 旧居宅の敷地面積(㎡)。500㎡超の場合は超過部分に対応する譲渡損失を除外する */
  oldSiteAreaSqm: Decimal.Value;
  /** 買換資産(新居宅)の床面積(㎡) */
  newHomeFloorAreaSqm: Decimal.Value;
  /** 買換資産を取得した年の12月31日時点で、償還期間10年以上の住宅借入金等を有するか */
  newHomeMortgageExists: boolean;
  /** 買換資産に取得した年の翌年12月31日までの間に居住した(または居住する見込みである)か */
  movedInByDeadline: boolean;
  /**
   * 所有期間・床面積・住宅ローン・居住期限の要件以外の適用要件(自己の居住用財産で
   * あること、配偶者・直系血族等特別の関係がある者への譲渡でないこと、前年・前々年に
   * 他の居住用財産の譲渡損失の特例や3,000万円特別控除等の適用を受けていないこと等)を
   * ユーザー自身が確認したか
   */
  otherRequirementsEligible: boolean;
}

export interface HomeReplacementLossResult {
  /** 実際の譲渡損失額(取得費+譲渡費用-譲渡価額。譲渡益の場合は0) */
  transferLossJpy: Decimal;
  /** 所有期間の要件(譲渡年の1月1日時点で5年超)を満たすか */
  ownershipPeriodEligible: boolean;
  /** 買換資産の床面積の要件(50㎡以上)を満たすか */
  floorAreaEligible: boolean;
  /** 旧居宅の敷地面積が500㎡を超え、按分計算の対象になるか */
  siteAreaExceeded: boolean;
  /** 敷地面積按分割合(500㎡以下なら1。500㎡超なら500÷敷地面積) */
  siteAreaProrationRatio: Decimal;
  /** 全ての要件を満たし、この特例の対象になるか */
  eligible: boolean;
  /** 損益通算・繰越控除の対象になる譲渡損失額(transferLossJpy×siteAreaProrationRatio) */
  eligibleLossJpy: Decimal;
  notes: string[];
}

/**
 * 譲渡価額・取得費・譲渡費用・所有期間・敷地面積・買換資産の床面積及び住宅ローンの
 * 有無・居住期限から、居住用財産の買換え等の場合の譲渡損失の損益通算及び繰越控除の
 * 特例の対象になる譲渡損失額を算出する。DBに依存しない純粋関数。
 */
export function calculateHomeReplacementLoss(
  input: HomeReplacementLossInput,
): HomeReplacementLossResult {
  const transferPrice = new Decimal(input.transferPriceJpy);
  const acquisitionCost = new Decimal(input.acquisitionCostJpy);
  const transferExpenses = new Decimal(input.transferExpensesJpy);
  const oldSiteArea = new Decimal(input.oldSiteAreaSqm);
  const newHomeFloorArea = new Decimal(input.newHomeFloorAreaSqm);

  if (
    transferPrice.isNegative() ||
    acquisitionCost.isNegative() ||
    transferExpenses.isNegative() ||
    oldSiteArea.isNegative() ||
    newHomeFloorArea.isNegative()
  ) {
    throw new Error("金額・面積はいずれも0以上である必要があります");
  }
  if (!Number.isInteger(input.ownershipYears) || input.ownershipYears < 0) {
    throw new Error("所有期間は0以上の整数(年)で入力してください");
  }

  const transferLossJpy = Decimal.max(
    0,
    acquisitionCost.plus(transferExpenses).minus(transferPrice),
  );
  const ownershipPeriodEligible = input.ownershipYears > MIN_OWNERSHIP_YEARS;
  const floorAreaEligible = newHomeFloorArea.greaterThanOrEqualTo(
    MIN_NEW_HOME_FLOOR_AREA_SQM,
  );
  const siteAreaExceeded = oldSiteArea.greaterThan(MAX_PRORATED_SITE_AREA_SQM);
  const siteAreaProrationRatio = siteAreaExceeded
    ? new Decimal(MAX_PRORATED_SITE_AREA_SQM).dividedBy(oldSiteArea)
    : new Decimal(1);

  const eligible =
    ownershipPeriodEligible &&
    floorAreaEligible &&
    input.newHomeMortgageExists &&
    input.movedInByDeadline &&
    input.otherRequirementsEligible &&
    transferLossJpy.greaterThan(0);

  const eligibleLossJpy = eligible
    ? transferLossJpy.times(siteAreaProrationRatio)
    : new Decimal(0);

  const notes: string[] = [];
  if (transferLossJpy.isZero()) {
    notes.push(
      "譲渡益が生じているためこの特例の対象外(譲渡益の場合は居住用財産の3,000万円特別控除・軽減税率の特例(homeSaleTaxSimulation.ts)を参照)。",
    );
  }
  if (!ownershipPeriodEligible) {
    notes.push(
      `旧居宅の所有期間が譲渡年の1月1日時点で${MIN_OWNERSHIP_YEARS}年以下のため対象外(要件: ${MIN_OWNERSHIP_YEARS}年超)。`,
    );
  }
  if (!floorAreaEligible) {
    notes.push(
      `買換資産(新居宅)の床面積が${MIN_NEW_HOME_FLOOR_AREA_SQM}㎡未満のため対象外(要件: ${MIN_NEW_HOME_FLOOR_AREA_SQM}㎡以上)。`,
    );
  }
  if (!input.newHomeMortgageExists) {
    notes.push(
      "買換資産を取得した年の12月31日時点で償還期間10年以上の住宅借入金等が無いため対象外。",
    );
  }
  if (!input.movedInByDeadline) {
    notes.push(
      "買換資産に取得した年の翌年12月31日までに居住した(または居住する見込みである)ことの要件を満たさないため対象外。",
    );
  }
  if (!input.otherRequirementsEligible) {
    notes.push(
      "所有期間・床面積・住宅ローン・居住期限の要件以外(自己の居住用財産であること、配偶者・直系血族等特別の関係がある者への譲渡でないこと、前年・前々年に他の居住用財産譲渡の特例の適用を受けていないこと等)を満たすかどうかは自身で確認すること。",
    );
  }
  if (siteAreaExceeded) {
    notes.push(
      `旧居宅の敷地面積が${MAX_PRORATED_SITE_AREA_SQM}㎡を超えるため、超過部分に対応する譲渡損失額は対象外(按分割合: ${siteAreaProrationRatio.times(100).toFixed(1)}%)。`,
    );
  }

  return {
    transferLossJpy,
    ownershipPeriodEligible,
    floorAreaEligible,
    siteAreaExceeded,
    siteAreaProrationRatio,
    eligible,
    eligibleLossJpy,
    notes,
  };
}

export interface HomeReplacementLossCarryforwardEntry {
  /** 譲渡損失が発生した年(暦年) */
  originYear: number;
  /** 計算対象年の年初時点で残っている繰越控除可能な譲渡損失額 */
  remainingAmountJpy: Decimal.Value;
}

export interface HomeReplacementLossCarryforwardUsage {
  originYear: number;
  usedAmountJpy: Decimal;
}

export interface HomeReplacementLossCarryforwardExpiry {
  originYear: number;
  expiredAmountJpy: Decimal;
}

export interface HomeReplacementLossCarryforwardBalance {
  originYear: number;
  remainingAmountJpy: Decimal;
}

export interface HomeReplacementLossCarryforwardResult {
  currentYear: number;
  /** その年の総所得金額等(繰越控除・当年分の損益通算を差し引く前) */
  totalIncomeJpy: Decimal;
  /** 当年新たに発生した損益通算対象の譲渡損失額(calculateHomeReplacementLossのeligibleLossJpy) */
  currentYearEligibleLossJpy: Decimal;
  /** その年の合計所得金額が3,000万円を超え、前年以前からの繰越控除を適用できない年かどうか
   * (当年発生分の損益通算には適用されない) */
  carryforwardIncomeLimitExceeded: boolean;
  /** その年の12月31日時点で買換資産に係る償還期間10年以上の住宅借入金等を有しないため、
   * 前年以前からの繰越控除を適用できない年かどうか(当年発生分の損益通算には適用されない) */
  carryforwardMortgageRequirementUnmet: boolean;
  /** 上記いずれかの理由で前年以前からの繰越控除を適用できない年かどうか */
  carryforwardBlocked: boolean;
  /** 前年以前からの繰越控除の使用内訳(発生年の古い順に使用) */
  usedCarryforwardByOriginYear: HomeReplacementLossCarryforwardUsage[];
  /** 前年以前からの繰越控除の使用合計額 */
  totalCarryforwardUsedJpy: Decimal;
  /** 当年発生分の譲渡損失額のうち、繰越控除使用後の残り所得枠から当年の所得に適用できた金額 */
  currentYearLossUsedJpy: Decimal;
  /** 実際にその年の総所得金額等から控除された合計額(繰越控除使用額+当年発生分適用額) */
  totalDeductionAppliedJpy: Decimal;
  /** 損益通算・繰越控除後の総所得金額等(0未満にはならない) */
  taxableIncomeAfterCarryforwardJpy: Decimal;
  /** 控除期限(発生年から3年)を過ぎて当年は使用できなかった繰越譲渡損失 */
  expiredByOriginYear: HomeReplacementLossCarryforwardExpiry[];
  /** 当年発生分の譲渡損失額のうち総所得金額等から控除しきれず、翌年以後に新たに繰り越す金額 */
  newLossJpy: Decimal;
  /** 翌年に繰り越す残高(発生年ごと。当年の新規繰越損失を含む) */
  carryforwardToNextYear: HomeReplacementLossCarryforwardBalance[];
}

/**
 * 当年発生分の損益通算対象額(calculateHomeReplacementLossのeligibleLossJpy。無ければ0)・
 * 総所得金額等・当年12月31日時点の買換資産の住宅ローン(10年以上)の有無と、年初時点で
 * 残っている発生年ごとの繰越譲渡損失残高から、損益通算及び繰越控除の適用結果を計算する。
 * DBに依存しない純粋関数。
 *
 * homeSaleLossCarryforward.tsのcalculateHomeSaleLossCarryforwardと同様、複数年分の
 * 繰越譲渡損失が残っている場合は発生年が古いものから優先して総所得金額等に充当する。
 * 本特例は繰越控除の適用年について合計所得金額3,000万円以下の要件に加え、買換資産の
 * 住宅ローン(10年以上)を有することの要件があるため、いずれかを満たさない年は前年
 * 以前からの繰越控除を一切使用できない(当年発生分の損益通算には所得制限・住宅ローン
 * 要件が無いため、currentYearEligibleLossJpyの適用には影響しない)。
 */
export function calculateHomeReplacementLossCarryforward(
  currentYear: number,
  currentYearEligibleLossJpy: Decimal.Value,
  totalIncomeJpy: Decimal.Value,
  currentYearNewHomeMortgageExists: boolean,
  entries: HomeReplacementLossCarryforwardEntry[],
): HomeReplacementLossCarryforwardResult {
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
  const carryforwardMortgageRequirementUnmet = !currentYearNewHomeMortgageExists;
  const carryforwardBlocked =
    carryforwardIncomeLimitExceeded || carryforwardMortgageRequirementUnmet;

  const sorted = entries
    .map((e) => ({
      originYear: e.originYear,
      remainingAmountJpy: new Decimal(e.remainingAmountJpy),
    }))
    .filter((e) => e.remainingAmountJpy.greaterThan(0))
    .sort((a, b) => a.originYear - b.originYear);

  const expiredByOriginYear: HomeReplacementLossCarryforwardExpiry[] = [];
  const usable: HomeReplacementLossCarryforwardBalance[] = [];

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

  let availableForCarryforward = carryforwardBlocked ? new Decimal(0) : totalIncome;
  const usedCarryforwardByOriginYear: HomeReplacementLossCarryforwardUsage[] = [];
  const carryforwardToNextYear: HomeReplacementLossCarryforwardBalance[] = [];

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

  // 損益通算(当年発生分)には所得制限・住宅ローン要件が無いため、繰越控除の使用額を
  // 差し引いた残り所得枠全体を当年発生分に充てられる。
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
    carryforwardMortgageRequirementUnmet,
    carryforwardBlocked,
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
