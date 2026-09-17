import { Decimal } from "decimal.js";

/**
 * 雑損失の繰越控除(3年間・所得税法71条)。
 *
 * 雑損控除額(src/lib/casualtyLossDeduction.ts の estimateCasualtyLossDeduction)は
 * その年の総所得金額等を上限とせず算出されるため、控除額が総所得金額等を上回る場合、
 * 超過額は「雑損失の金額」としてその年は控除しきれない。この超過額は発生した年分の
 * 翌年以後3年間、総所得金額等から控除できる(雑損失の繰越控除)。
 *
 * 複数年分の繰越雑損失が残っている場合、上場株式等の譲渡損失の繰越控除
 * (src/lib/investment/lossCarryforward.ts)と同様、期限切れが近い(発生年が古い)
 * ものから優先して総所得金額等に充当し、なお残った所得の枠を当年新たに発生した
 * 雑損控除額(currentYearDeductionJpy)に充てる。当年分の雑損控除額のうち、
 * この所得の枠に収まらなかった分が翌年以後への新規繰越になる。この「古い繰越を
 * 優先し当年発生分は最後に充てる」順序は、期限が先に来る繰越分を使い切れないまま
 * 失効させるリスクを避けるための実装上の判断であり、条文上その順序が明記されている
 * わけではない点に留意する。
 *
 * 所得税・住民税とも同一の算式(地方税法上も国税と同じ計算方法)のため、
 * この試算では控除額・繰越残高とも税目を分けず単一のプールとして扱う。
 */

const CARRYFORWARD_YEARS = 3;

export interface CasualtyLossCarryforwardEntry {
  /** 雑損失が発生した年(暦年) */
  originYear: number;
  /** 計算対象年の年初時点で残っている繰越控除可能な雑損失額 */
  remainingAmountJpy: Decimal.Value;
}

export interface CasualtyLossCarryforwardUsage {
  originYear: number;
  usedAmountJpy: Decimal;
}

export interface CasualtyLossCarryforwardExpiry {
  originYear: number;
  expiredAmountJpy: Decimal;
}

export interface CasualtyLossCarryforwardBalance {
  originYear: number;
  remainingAmountJpy: Decimal;
}

export interface CasualtyLossCarryforwardResult {
  currentYear: number;
  /** その年の総所得金額等(繰越控除・当年分の雑損控除を差し引く前) */
  totalIncomeJpy: Decimal;
  /** 当年単独で算出した雑損控除額(総所得金額等による上限をかける前の金額) */
  currentYearDeductionJpy: Decimal;
  /** 前年以前からの繰越控除の使用内訳(発生年の古い順に使用) */
  usedCarryforwardByOriginYear: CasualtyLossCarryforwardUsage[];
  /** 前年以前からの繰越控除の使用合計額 */
  totalCarryforwardUsedJpy: Decimal;
  /** 当年分の雑損控除額のうち、繰越控除使用後の残り枠から当年の所得に適用できた金額 */
  currentYearDeductionUsedJpy: Decimal;
  /** 実際にその年の総所得金額等から控除された合計額(繰越控除使用額+当年分適用額)。
   * `IncomeDeduction`(CASUALTY_LOSS区分)へ登録する額はこの値を使う。 */
  totalDeductionAppliedJpy: Decimal;
  /** 繰越控除後の総所得金額等(0未満にはならない) */
  taxableIncomeAfterCarryforwardJpy: Decimal;
  /** 控除期限(発生年から3年)を過ぎて当年は使用できなかった繰越雑損失 */
  expiredByOriginYear: CasualtyLossCarryforwardExpiry[];
  /** 当年分の雑損控除額のうち総所得金額等から控除しきれず、翌年以後に新たに繰り越す金額 */
  newLossJpy: Decimal;
  /** 翌年に繰り越す残高(発生年ごと。当年の新規繰越損失を含む) */
  carryforwardToNextYear: CasualtyLossCarryforwardBalance[];
}

/**
 * 当年の雑損控除額(上限適用前)・総所得金額等と、年初時点で残っている発生年ごとの
 * 繰越雑損失残高から、繰越控除の適用結果を計算する。DBに依存しない純粋関数。
 */
export function calculateCasualtyLossCarryforward(
  currentYear: number,
  currentYearDeductionJpy: Decimal.Value,
  totalIncomeJpy: Decimal.Value,
  entries: CasualtyLossCarryforwardEntry[],
): CasualtyLossCarryforwardResult {
  const deduction = new Decimal(currentYearDeductionJpy);
  const totalIncome = new Decimal(totalIncomeJpy);

  if (deduction.isNegative()) {
    throw new Error("雑損控除額は0以上である必要があります");
  }
  if (totalIncome.isNegative()) {
    throw new Error("総所得金額等は0以上である必要があります");
  }

  const sorted = entries
    .map((e) => ({
      originYear: e.originYear,
      remainingAmountJpy: new Decimal(e.remainingAmountJpy),
    }))
    .filter((e) => e.remainingAmountJpy.greaterThan(0))
    .sort((a, b) => a.originYear - b.originYear);

  const expiredByOriginYear: CasualtyLossCarryforwardExpiry[] = [];
  const usable: CasualtyLossCarryforwardBalance[] = [];

  for (const e of sorted) {
    // originYear の雑損失は originYear+1 〜 originYear+3 の3年間のみ控除に使える
    if (currentYear > e.originYear + CARRYFORWARD_YEARS) {
      expiredByOriginYear.push({
        originYear: e.originYear,
        expiredAmountJpy: e.remainingAmountJpy,
      });
    } else {
      usable.push(e);
    }
  }

  let available = totalIncome;
  const usedCarryforwardByOriginYear: CasualtyLossCarryforwardUsage[] = [];
  const carryforwardToNextYear: CasualtyLossCarryforwardBalance[] = [];

  for (const e of usable) {
    if (available.isZero()) {
      carryforwardToNextYear.push(e);
      continue;
    }
    const used = Decimal.min(available, e.remainingAmountJpy);
    if (used.greaterThan(0)) {
      usedCarryforwardByOriginYear.push({ originYear: e.originYear, usedAmountJpy: used });
    }
    available = available.minus(used);
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

  const currentYearDeductionUsedJpy = Decimal.min(available, deduction);
  const newLossJpy = deduction.minus(currentYearDeductionUsedJpy);
  const totalDeductionAppliedJpy = totalCarryforwardUsedJpy.plus(currentYearDeductionUsedJpy);
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
    currentYearDeductionJpy: deduction,
    usedCarryforwardByOriginYear,
    totalCarryforwardUsedJpy,
    currentYearDeductionUsedJpy,
    totalDeductionAppliedJpy,
    taxableIncomeAfterCarryforwardJpy,
    expiredByOriginYear,
    newLossJpy,
    carryforwardToNextYear: carryforwardToNextYear.sort(
      (a, b) => a.originYear - b.originYear,
    ),
  };
}
