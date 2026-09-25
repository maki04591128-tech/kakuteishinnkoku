import { Decimal } from "decimal.js";

/**
 * 土地・建物の譲渡における「取得費が分からないとき」の概算取得費の特例
 * (国税庁タックスアンサーNo.3258「取得費が分からないとき」)。
 *
 * 先祖伝来の土地など取得費が全く不明な場合だけでなく、実際の取得費が
 * 分かっている場合でも、その金額が譲渡価額の5%相当額を下回るときは、
 * 譲渡価額の5%相当額を取得費とすることを選択できる(常に納税者に有利な
 * 方向にしか働かない、片方向の特例)。租税特別措置法31条の4(昭和28年
 * 12月31日以前から引き続き所有していた資産の長期譲渡所得に係る概算取得費
 * 控除)を法的根拠としつつ、国税庁は全ての土地・建物の譲渡に共通する実務上の
 * 取扱いとしてこの5%概算取得費を案内している。
 *
 * `homeSaleTaxSimulation.ts`(居住用財産(マイホーム)を譲渡した場合の税額
 * 試算。機能94)・`vacantHouseSaleTaxSimulation.ts`(被相続人の居住用財産
 * (空き家)を譲渡した場合の3,000万円特別控除の試算。機能95)の両モジュールが
 * それぞれ「取得費が不明な場合の概算取得費(譲渡価額の5%。措置法31条の4)は
 * 自動算出しない」と明記していたギャップに対応する共通モジュール。
 *
 * **本モジュールが対象としない範囲(今後の課題):**
 *  - 特定居住用財産の譲渡損失の損益通算及び繰越控除(措置法41条の5の2。
 *    `homeSaleLossCarryforward.ts`)・居住用財産の買換え等の場合の譲渡損失の
 *    損益通算及び繰越控除(措置法41条の5。`homeReplacementLossCarryforward.ts`)は
 *    いずれも譲渡損失の発生を前提とする特例で、取得費をより高い金額(概算取得費)に
 *    差し替えることは損失額を圧縮する方向にしか働かない(納税者に不利)ため、
 *    この2モジュールへの適用は対象外のまま据え置く。
 *  - 総合課税の譲渡所得(`generalTransferIncome.ts`。機能100)・上場株式等/
 *    一般株式等の譲渡所得(`investment/calculator.ts`)は、いずれも本特例の
 *    対象(土地・建物)ではないため対象外。
 */

export const ESTIMATED_ACQUISITION_COST_RATE = 0.05;

function requireNonNegative(value: Decimal, label: string): void {
  if (value.isNegative()) {
    throw new Error(`${label}は0以上である必要があります`);
  }
}

/** 譲渡価額の5%相当額(概算取得費)を計算する。 */
export function calculateEstimatedAcquisitionCostJpy(
  transferPriceJpy: Decimal.Value,
): Decimal {
  const transferPrice = new Decimal(transferPriceJpy);
  requireNonNegative(transferPrice, "譲渡価額");
  return transferPrice.times(ESTIMATED_ACQUISITION_COST_RATE);
}

export interface ResolveAcquisitionCostInput {
  /** 実際の取得費(不明な場合は0円を入力する想定) */
  actualAcquisitionCostJpy: Decimal.Value;
  /** 譲渡価額 */
  transferPriceJpy: Decimal.Value;
  /** 概算取得費の特例(譲渡価額の5%相当額)の適用を希望するか(ユーザー自身の選択) */
  useEstimated: boolean;
}

export interface ResolveAcquisitionCostResult {
  /** 実際に採用する取得費(概算取得費を希望した場合は実額と5%相当額の高い方) */
  acquisitionCostJpy: Decimal;
  /** 概算取得費(譲渡価額の5%相当額。希望の有無に関わらず参考表示用に常に計算する) */
  estimatedAcquisitionCostJpy: Decimal;
  /** 概算取得費のほうが実額以上で、実際に概算取得費が採用されたか */
  estimatedApplied: boolean;
  notes: string[];
}

/**
 * 実際の取得費(入力額)と概算取得費(譲渡価額の5%相当額)のうち、ユーザーが
 * 概算取得費の特例を希望した場合はいずれか高い方を採用する(この特例は常に
 * 納税者に有利な方向にしか働かない片方向の特例のため、希望した場合は自動的に
 * 有利な方を選ぶ)。希望しない場合は入力された実際の取得費をそのまま採用する。
 */
export function resolveAcquisitionCostJpy(
  input: ResolveAcquisitionCostInput,
): ResolveAcquisitionCostResult {
  const actual = new Decimal(input.actualAcquisitionCostJpy);
  requireNonNegative(actual, "取得費");
  const estimated = calculateEstimatedAcquisitionCostJpy(input.transferPriceJpy);

  if (!input.useEstimated) {
    return {
      acquisitionCostJpy: actual,
      estimatedAcquisitionCostJpy: estimated,
      estimatedApplied: false,
      notes: [],
    };
  }

  const estimatedApplied = estimated.greaterThan(actual);
  const acquisitionCostJpy = Decimal.max(actual, estimated);
  const notes: string[] = [
    estimatedApplied
      ? `概算取得費の特例(取得費が分からないとき。国税庁タックスアンサーNo.3258)により、譲渡価額の5%相当額(${estimated.toFixed(0)}円)を取得費として採用した(入力された実際の取得費${actual.toFixed(0)}円を上回るため)。`
      : `概算取得費の特例の適用を希望する入力だったが、実際の取得費(${actual.toFixed(0)}円)が譲渡価額の5%相当額(${estimated.toFixed(0)}円)以上のため、実際の取得費をそのまま採用した。`,
  ];

  return {
    acquisitionCostJpy,
    estimatedAcquisitionCostJpy: estimated,
    estimatedApplied,
    notes,
  };
}
