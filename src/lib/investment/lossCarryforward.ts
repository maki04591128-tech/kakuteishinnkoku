import { Decimal } from "decimal.js";

/**
 * 上場株式等の譲渡損失の繰越控除(3年間)。
 *
 * 確定申告(所得税法第37条の12の2)により繰越控除の適用を受けた場合、
 * その譲渡損失は発生した年分の翌年以後3年間、上場株式等に係る譲渡所得等
 * (および申告分離課税を選択した配当所得)から控除できる。複数年分の
 * 繰越損失が残っている場合、期限切れが近い(発生年が古い)ものから
 * 優先して控除するのが実務上一般的なため、本モジュールもその順序で適用する。
 *
 * 暗号資産の損益(雑所得)は他の所得と損益通算・繰越ができないため、
 * このモジュールの対象は上場株式等(投資)の譲渡損益のみ。
 */

const CARRYFORWARD_YEARS = 3;

export interface LossCarryforwardEntry {
  /** 損失が発生した年(暦年) */
  originYear: number;
  /** 計算対象年の年初時点で残っている繰越控除可能な損失額 */
  remainingAmountJpy: Decimal.Value;
}

export interface LossCarryforwardUsage {
  originYear: number;
  usedAmountJpy: Decimal;
}

export interface LossCarryforwardExpiry {
  originYear: number;
  expiredAmountJpy: Decimal;
}

export interface LossCarryforwardBalance {
  originYear: number;
  remainingAmountJpy: Decimal;
}

export interface LossCarryforwardResult {
  currentYear: number;
  /** 繰越控除を適用する前の、当年の課税口座分譲渡損益(損失の場合は負値) */
  grossRealizedGainJpy: Decimal;
  /** 繰越控除の使用内訳(発生年の古い順に使用) */
  usedByOriginYear: LossCarryforwardUsage[];
  /** 繰越控除の使用合計額 */
  totalUsedJpy: Decimal;
  /** 繰越控除後の課税対象譲渡所得(0未満にはならない) */
  taxableGainJpy: Decimal;
  /** 当年新たに発生した譲渡損失(翌年以後の繰越控除の対象になる) */
  newLossJpy: Decimal;
  /** 控除期限(発生年から3年)を過ぎて当年は使用できなかった損失 */
  expiredByOriginYear: LossCarryforwardExpiry[];
  /** 翌年に繰り越す残高(発生年ごと。当年の新規損失を含む) */
  carryforwardToNextYear: LossCarryforwardBalance[];
}

/**
 * 当年の譲渡損益と、年初時点で残っている発生年ごとの繰越損失残高から、
 * 繰越控除の適用結果を計算する。DBに依存しない純粋関数。
 */
export function calculateLossCarryforward(
  currentYear: number,
  grossRealizedGainJpy: Decimal.Value,
  entries: LossCarryforwardEntry[],
): LossCarryforwardResult {
  const gross = new Decimal(grossRealizedGainJpy);

  const sorted = entries
    .map((e) => ({
      originYear: e.originYear,
      remainingAmountJpy: new Decimal(e.remainingAmountJpy),
    }))
    .filter((e) => e.remainingAmountJpy.greaterThan(0))
    .sort((a, b) => a.originYear - b.originYear);

  const expiredByOriginYear: LossCarryforwardExpiry[] = [];
  const usable: LossCarryforwardBalance[] = [];

  for (const e of sorted) {
    // originYear の損失は originYear+1 〜 originYear+3 の3年間のみ控除に使える
    if (currentYear > e.originYear + CARRYFORWARD_YEARS) {
      expiredByOriginYear.push({
        originYear: e.originYear,
        expiredAmountJpy: e.remainingAmountJpy,
      });
    } else {
      usable.push(e);
    }
  }

  let available = gross.greaterThan(0) ? gross : new Decimal(0);
  const usedByOriginYear: LossCarryforwardUsage[] = [];
  const carryforwardToNextYear: LossCarryforwardBalance[] = [];

  for (const e of usable) {
    if (available.isZero()) {
      carryforwardToNextYear.push(e);
      continue;
    }
    const used = Decimal.min(available, e.remainingAmountJpy);
    if (used.greaterThan(0)) {
      usedByOriginYear.push({ originYear: e.originYear, usedAmountJpy: used });
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

  const totalUsedJpy = usedByOriginYear.reduce(
    (sum, u) => sum.plus(u.usedAmountJpy),
    new Decimal(0),
  );
  const taxableGainJpy = gross.greaterThan(0)
    ? gross.minus(totalUsedJpy)
    : new Decimal(0);
  const newLossJpy = gross.isNegative() ? gross.abs() : new Decimal(0);

  if (newLossJpy.greaterThan(0)) {
    carryforwardToNextYear.push({
      originYear: currentYear,
      remainingAmountJpy: newLossJpy,
    });
  }

  return {
    currentYear,
    grossRealizedGainJpy: gross,
    usedByOriginYear,
    totalUsedJpy,
    taxableGainJpy,
    newLossJpy,
    expiredByOriginYear,
    carryforwardToNextYear: carryforwardToNextYear.sort(
      (a, b) => a.originYear - b.originYear,
    ),
  };
}
