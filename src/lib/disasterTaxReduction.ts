import { Decimal } from "decimal.js";

/**
 * 災害減免法(正式名称: 災害被害者に対する租税の減免、徴収猶予等に関する法律)2条による
 * 所得税の軽減免除を試算する(国税庁タックスアンサーNo.1902「災害減免法による所得税の
 * 軽減免除」)。
 *
 * 災害により住宅や家財に損害を受けた場合、雑損控除(`casualtyLossDeduction.ts`参照)に
 * 代えてこの制度を選択適用できる(両方を同時には受けられず、有利な方を選ぶ)。適用には
 * 損害金額(保険金等により補填される金額を除く)が住宅又は家財の価額の2分の1以上で
 * あることが必要で、その年の合計所得金額に応じて次の割合で所得税額そのものを軽減・
 * 免除する。
 *
 *   合計所得金額           軽減又は免除される所得税の額
 *    500万円以下            所得税額の全額
 *    500万円超750万円以下   所得税額の2分の1
 *    750万円超1,000万円以下 所得税額の4分の1
 *    1,000万円超            適用なし(雑損控除のみ選択可)
 *
 * 雑損控除が総所得金額等から控除額を差し引いた上で通常の累進税率により税額計算する
 * のに対し、この制度は通常どおり計算した所得税額そのものを一定割合軽減・免除する点で
 * 仕組みが異なるため、それぞれの試算結果(雑損控除適用後の税額とこの制度の軽減後税額)を
 * 比較して有利な方をユーザー自身が選ぶ前提とする(自動比較はしない)。
 *
 * 対象は災害による損失のみで、雑損控除と異なり盗難・横領による損失は対象外。事業用資産等、
 * 生活に通常必要でない資産による損害も対象外。
 *
 * 軽減前の所得税額(`nationalTaxBeforeReductionJpy`)には復興特別所得税を含む前提とする。
 * 復興特別所得税額は基準所得税額(軽減後の所得税額)の2.1%として算出されるため、
 * 軽減前の所得税額+復興特別所得税額の合計に同じ軽減割合を掛けても、所得税額単独を
 * 軽減してから復興特別所得税を計算し直した場合と同じ結果になる。
 *
 * 住民税(所得割)にはこの災害減免法に相当する国の一律の軽減制度が無く、地方税法323条等に
 * 基づく市区町村ごとの条例による個別の減免制度に委ねられているため、この試算では
 * 所得税分のみを対象とする(住民税分の減免の有無・内容は居住する自治体へ確認が必要)。
 */

export interface DisasterTaxReductionInput {
  /** その年の合計所得金額(雑損控除適用前) */
  totalIncomeJpy: Decimal.Value;
  /** 住宅又は家財の価額(時価) */
  propertyValueJpy: Decimal.Value;
  /** 損害金額(保険金等により補填される金額を除いた実質負担額) */
  damageAmountJpy: Decimal.Value;
  /** 軽減前の所得税額(復興特別所得税を含む。通常どおり計算した所得税額) */
  nationalTaxBeforeReductionJpy: Decimal.Value;
}

export type DisasterTaxReductionRate = "FULL" | "HALF" | "QUARTER" | "NONE";

export interface DisasterTaxReductionResult {
  /** 損害金額が住宅又は家財の価額の2分の1以上か(この制度の適用要件) */
  meetsDamageThreshold: boolean;
  /** 合計所得金額の区分に応じた軽減割合区分(適用要件を満たさない場合もNONE) */
  reductionRate: DisasterTaxReductionRate;
  /** 軽減又は免除される所得税額(復興特別所得税を含む) */
  reductionAmountJpy: Decimal;
  /** 軽減後の所得税額(復興特別所得税を含む) */
  reducedNationalTaxJpy: Decimal;
  notes: string[];
}

const FULL_REDUCTION_INCOME_CEILING_JPY = new Decimal(5_000_000);
const HALF_REDUCTION_INCOME_CEILING_JPY = new Decimal(7_500_000);
const QUARTER_REDUCTION_INCOME_CEILING_JPY = new Decimal(10_000_000);

function requireNonNegative(value: Decimal, label: string): void {
  if (value.isNegative()) {
    throw new Error(`${label}は0以上である必要があります`);
  }
}

function reductionRateFor(totalIncomeJpy: Decimal): DisasterTaxReductionRate {
  if (totalIncomeJpy.lessThanOrEqualTo(FULL_REDUCTION_INCOME_CEILING_JPY)) return "FULL";
  if (totalIncomeJpy.lessThanOrEqualTo(HALF_REDUCTION_INCOME_CEILING_JPY)) return "HALF";
  if (totalIncomeJpy.lessThanOrEqualTo(QUARTER_REDUCTION_INCOME_CEILING_JPY)) return "QUARTER";
  return "NONE";
}

function rateDecimalFor(rate: DisasterTaxReductionRate): Decimal {
  switch (rate) {
    case "FULL":
      return new Decimal(1);
    case "HALF":
      return new Decimal("0.5");
    case "QUARTER":
      return new Decimal("0.25");
    case "NONE":
      return new Decimal(0);
  }
}

export function estimateDisasterTaxReduction(
  input: DisasterTaxReductionInput,
): DisasterTaxReductionResult {
  const totalIncomeJpy = new Decimal(input.totalIncomeJpy);
  const propertyValueJpy = new Decimal(input.propertyValueJpy);
  const damageAmountJpy = new Decimal(input.damageAmountJpy);
  const nationalTaxBeforeReductionJpy = new Decimal(input.nationalTaxBeforeReductionJpy);

  requireNonNegative(totalIncomeJpy, "合計所得金額");
  requireNonNegative(propertyValueJpy, "住宅又は家財の価額");
  requireNonNegative(damageAmountJpy, "損害金額");
  requireNonNegative(nationalTaxBeforeReductionJpy, "軽減前の所得税額");
  if (propertyValueJpy.isZero()) {
    throw new Error("住宅又は家財の価額は0より大きい必要があります");
  }

  const notes: string[] = [
    "国税庁タックスアンサーNo.1902「災害減免法による所得税の軽減免除」の計算式による概算値。",
    "雑損控除とはいずれか有利な方を選択適用する関係にあり、両方を同時に受けることはできない。雑損控除(`/casualty-loss-deduction`)の試算結果とこの制度の軽減後所得税額を比較して有利な方を選ぶこと。",
    "対象は災害による損失のみで、雑損控除と異なり盗難・横領による損失は対象外。事業用資産等、生活に通常必要でない資産による損害も対象外。",
    "住民税(所得割)にはこの災害減免法に相当する国の一律の軽減制度が無く、市区町村ごとの条例による個別の減免制度に委ねられているため、この試算では所得税分のみを対象とする(住民税分は居住する自治体へ確認が必要)。",
  ];

  const meetsDamageThreshold = damageAmountJpy.greaterThanOrEqualTo(
    propertyValueJpy.times("0.5"),
  );

  if (!meetsDamageThreshold) {
    return {
      meetsDamageThreshold,
      reductionRate: "NONE",
      reductionAmountJpy: new Decimal(0),
      reducedNationalTaxJpy: nationalTaxBeforeReductionJpy,
      notes: [
        "損害金額が住宅又は家財の価額の2分の1に満たないため、災害減免法による軽減免除の適用要件を満たさない(雑損控除のみ選択できる)。",
        ...notes,
      ],
    };
  }

  const reductionRate = reductionRateFor(totalIncomeJpy);
  const reductionAmountJpy = nationalTaxBeforeReductionJpy.times(rateDecimalFor(reductionRate));
  const reducedNationalTaxJpy = nationalTaxBeforeReductionJpy.minus(reductionAmountJpy);

  if (reductionRate === "NONE") {
    notes.unshift(
      "合計所得金額が1,000万円を超えるため、住宅家財への被害要件を満たしていてもこの制度の軽減割合の適用は無い(雑損控除のみ選択できる)。",
    );
  }

  return {
    meetsDamageThreshold,
    reductionRate,
    reductionAmountJpy,
    reducedNationalTaxJpy,
    notes,
  };
}
