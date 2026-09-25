import { Decimal } from "decimal.js";

/**
 * 一時所得の金額(所得税法34条、国税庁タックスアンサーNo.1490「一時所得」)を
 * 試算する。
 *
 * 一時所得は「営利を目的とする継続的行為から生じた所得以外の所得で、労務その他の
 * 役務又は資産の譲渡の対価としての性質を有しないもの」で、生命保険の満期返戻金・
 * 解約返戻金、懸賞金・賞金、競馬等の払戻金、法人からの贈与等が該当する
 * (国税庁タックスアンサーNo.1490の具体例)。
 *
 * 計算式は次のとおり:
 *   一時所得の金額 = 総収入金額 - その収入を得るために支出した金額 - 特別控除額(最高50万円)
 * 特別控除額は「総収入金額-支出した金額」と50万円のいずれか少ない方(赤字にはならない)。
 *
 * さらに、総所得金額に算入する額はこの一時所得の金額の2分の1(所得税法22条2項2号)。
 * 中央区の公式ページ(「一時所得」)で、住民税の所得割の計算でも同じ総収入金額-支出した
 * 金額-特別控除額の計算式と2分の1課税が適用されることを確認しており、この試算では
 * 所得税・住民税とも同一の算式を用いる。
 */

export interface OccasionalIncomeInput {
  /** 一時所得の総収入金額(生命保険の満期返戻金・懸賞金等の合計) */
  totalRevenueJpy: Decimal.Value;
  /** その収入を得るために直接要した支出額(生命保険料の払込総額等) */
  expensesJpy: Decimal.Value;
}

export interface OccasionalIncomeResult {
  /** 特別控除額(「総収入金額-支出した金額」と50万円のいずれか少ない方) */
  specialDeductionJpy: Decimal;
  /** 一時所得の金額(総収入金額-支出した金額-特別控除額。0円が下限) */
  occasionalIncomeJpy: Decimal;
  /** 総所得金額に算入する額(一時所得の金額の2分の1) */
  taxableAmountJpy: Decimal;
  notes: string[];
}

// 特別控除額の上限(所得税法34条3項)
const SPECIAL_DEDUCTION_MAX_JPY = 500_000;

function requireNonNegative(value: Decimal, label: string): void {
  if (value.isNegative()) {
    throw new Error(`${label}は0以上である必要があります`);
  }
}

export function estimateOccasionalIncome(input: OccasionalIncomeInput): OccasionalIncomeResult {
  const totalRevenueJpy = new Decimal(input.totalRevenueJpy);
  const expensesJpy = new Decimal(input.expensesJpy);

  requireNonNegative(totalRevenueJpy, "一時所得の総収入金額");
  requireNonNegative(expensesJpy, "支出した金額");
  if (expensesJpy.greaterThan(totalRevenueJpy)) {
    throw new Error("支出した金額は総収入金額以下である必要があります");
  }

  const netRevenueJpy = totalRevenueJpy.minus(expensesJpy);
  const specialDeductionJpy = Decimal.min(netRevenueJpy, SPECIAL_DEDUCTION_MAX_JPY);
  const occasionalIncomeJpy = Decimal.max(netRevenueJpy.minus(specialDeductionJpy), 0);
  const taxableAmountJpy = occasionalIncomeJpy.dividedBy(2);

  const notes: string[] = [
    "国税庁タックスアンサーNo.1490「一時所得」に基づく概算値。生命保険の満期返戻金・解約返戻金、懸賞金・賞金、競馬等の払戻金、法人からの贈与等が一時所得に該当する(営利を目的とする継続的行為から生じたものを除く)。",
    "「支出した金額」は、その収入を生じた行為をするため、または、その収入を生じた原因の発生に伴い直接要した金額に限られる(生命保険の満期返戻金であれば払い込んだ保険料の総額等)。単に収入を得る前提として支出した金額(例: 懸賞に応募するための交通費)は含まれない。",
    "一時所得の金額をそのまま総所得金額に算入するのではなく、その2分の1に相当する金額を給与所得等の他の所得と合計して総所得金額を求める(所得税法22条2項2号)。中央区の公式ページで、住民税の所得割の計算でも同じ2分の1課税が適用されることを確認した。",
    "この試算結果(taxableAmountJpy)は、他の総合課税所得と合算した後の金額として`/tax-estimate`の「給与所得等の課税所得金額」へ手入力で反映すること。一時所得は雑所得や給与所得と異なり損益通算の対象にならない点、同一年中に複数の一時所得がある場合は総収入金額・支出額を合算してから特別控除額50万円を1回だけ差し引く点に注意。",
    "各金額は円未満の端数を切り捨てずDecimalの計算結果をそのまま返す概算値。",
  ];

  return { specialDeductionJpy, occasionalIncomeJpy, taxableAmountJpy, notes };
}
