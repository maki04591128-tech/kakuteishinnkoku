import { Decimal } from "decimal.js";

/**
 * 暗号資産の取得価額が分からない場合の概算取得費(収入金額の5%相当額)を試算する。
 *
 * 国税庁「暗号資産等に関する税務上の取扱いについて(FAQ)」問2-7「暗号資産の取得価額や
 * 売却価額が分からない場合」(令和2年12月更新)に基づく。取引履歴を残していないため
 * 暗号資産の取得価額や売却価額が分からない場合、まず①国内の暗号資産交換業者が交付する
 * 「年間取引報告書」の(再)交付を依頼する、②それ以外(国外の交換業者・個人間取引)の
 * 場合は購入・売却時に使った銀行口座の入出金記録や交換業者の公表する取引相場等から
 * 確認する、という2つの方法が案内されているが、それでもなお取得価額が確認できない
 * 場合、売却した暗号資産の取得価額は売却価額(収入金額)の5%相当額とすることが
 * 認められる(所基通達48の2-4)。土地・建物の譲渡における「取得費が分からないとき」の
 * 概算取得費の特例(措置法31条の4。`src/lib/realEstate/estimatedAcquisitionCost.ts`。
 * 機能102参照)と同種の実務上の取扱いだが、次の2点が異なる。
 *  - 土地・建物の特例は実際の取得費が判明していてもそれが5%相当額を下回るときは
 *    5%相当額を選択できる(常に納税者に有利な方向にしか働かない片方向の特例)のに
 *    対し、この暗号資産の5%相当額はFAQ本文上、あくまで取得価額が確認できない場合の
 *    代替手段として案内されており、実額が判明している場合にまで有利な方を選択できる
 *    とは明記されていない。そのため本モジュールでは、実際の取得価額(既知額)が入力
 *    された取引はその実額をそのまま採用し、未入力(不明)の取引に限り5%相当額を
 *    採用する(「いずれか高い方」を自動選択する土地・建物の実装とは異なる)。
 *  - 土地・建物の特例は既存の譲渡所得計算(取得費の合計額)に組み込む形で実装したが、
 *    暗号資産の損益計算(`src/lib/crypto/calculator.ts`。機能1)は総平均法/移動平均法の
 *    いずれも年初来の取得履歴を前提とするプール計算のため、取得履歴を丸ごと欠く取引に
 *    5%相当額を部分適用する形では既存のプール計算と整合しない。取得価額が全く
 *    分からない暗号資産取引がある場合の代替的な雑所得試算として、既存の損益計算とは
 *    独立した単体の試算画面(DBへの登録機能を持たない)として実装した。
 *
 * **対象外とした範囲(今後の課題):**
 *  - 年間取引報告書に記載された数量・金額をそのまま使う通常の計算(FAQ2-8「年間取引
 *    報告書を活用した暗号資産の所得金額の計算」)は、取得価額が判明している通常の
 *    ケースであり、既存の`calculator.ts`側の対象。
 *  - 5%相当額は売却価額(収入金額)を基準とするため、暗号資産同士の交換・商品購入時の
 *    使用等、譲渡以外の事由により生じた収入金額にも同様に適用できると解されるが、
 *    本モジュールでは汎用的に「収入金額」として扱い、事由ごとの区別は行わない。
 */

export const CRYPTO_ESTIMATED_ACQUISITION_COST_RATE = 0.05;

function requireNonNegative(value: Decimal, label: string): void {
  if (value.isNegative()) {
    throw new Error(`${label}は0以上である必要があります`);
  }
}

/** 収入金額(売却価額等)の5%相当額(概算取得費)を計算する。 */
export function calculateCryptoEstimatedAcquisitionCostJpy(proceedsJpy: Decimal.Value): Decimal {
  const proceeds = new Decimal(proceedsJpy);
  requireNonNegative(proceeds, "収入金額");
  return proceeds.times(CRYPTO_ESTIMATED_ACQUISITION_COST_RATE);
}

export interface CryptoUnknownCostBasisTradeInput {
  label: string;
  /** その暗号資産取引の収入金額(売却価額・商品購入時の使用対価・交換時の譲渡対価等) */
  proceedsJpy: Decimal.Value;
  /**
   * 実際に確認できた取得費。年間取引報告書や取引履歴、購入時に使った銀行口座の
   * 出金記録等から確認できた場合はその金額を入力する。undefined(または null)の
   * ままにすると、取得価額が確認できない取引として概算取得費(収入金額の5%相当額)を
   * 採用する。
   */
  actualAcquisitionCostJpy?: Decimal.Value | null;
}

export interface CryptoUnknownCostBasisTradeResult {
  label: string;
  proceedsJpy: Decimal;
  /** 実際の取得費(不明な取引の場合はnull) */
  actualAcquisitionCostJpy: Decimal | null;
  /** 参考値として常に計算する、収入金額の5%相当額 */
  estimatedAcquisitionCostJpy: Decimal;
  /** 実際に採用する取得費(実額が入力されていればその実額、無ければ概算取得費) */
  acquisitionCostJpy: Decimal;
  /** 概算取得費(5%相当額)を採用したかどうか */
  estimatedApplied: boolean;
  miscellaneousIncomeJpy: Decimal;
}

export interface CryptoUnknownCostBasisInput {
  trades: CryptoUnknownCostBasisTradeInput[];
}

export interface CryptoUnknownCostBasisResult {
  trades: CryptoUnknownCostBasisTradeResult[];
  totalProceedsJpy: Decimal;
  totalAcquisitionCostJpy: Decimal;
  totalMiscellaneousIncomeJpy: Decimal;
  notes: string[];
}

export function estimateCryptoIncomeWithUnknownCostBasis(
  input: CryptoUnknownCostBasisInput,
): CryptoUnknownCostBasisResult {
  const trades: CryptoUnknownCostBasisTradeResult[] = input.trades.map((t) => {
    const proceedsJpy = new Decimal(t.proceedsJpy);
    requireNonNegative(proceedsJpy, `収入金額(${t.label})`);

    const estimatedAcquisitionCostJpy = calculateCryptoEstimatedAcquisitionCostJpy(proceedsJpy);
    const hasActual = t.actualAcquisitionCostJpy !== undefined && t.actualAcquisitionCostJpy !== null;
    const actualAcquisitionCostJpy = hasActual ? new Decimal(t.actualAcquisitionCostJpy!) : null;
    if (actualAcquisitionCostJpy !== null) {
      requireNonNegative(actualAcquisitionCostJpy, `取得費(${t.label})`);
    }

    const estimatedApplied = actualAcquisitionCostJpy === null;
    const acquisitionCostJpy = actualAcquisitionCostJpy ?? estimatedAcquisitionCostJpy;
    const miscellaneousIncomeJpy = proceedsJpy.minus(acquisitionCostJpy);

    return {
      label: t.label,
      proceedsJpy,
      actualAcquisitionCostJpy,
      estimatedAcquisitionCostJpy,
      acquisitionCostJpy,
      estimatedApplied,
      miscellaneousIncomeJpy,
    };
  });

  const totalProceedsJpy = trades.reduce((sum, t) => sum.plus(t.proceedsJpy), new Decimal(0));
  const totalAcquisitionCostJpy = trades.reduce(
    (sum, t) => sum.plus(t.acquisitionCostJpy),
    new Decimal(0),
  );
  const totalMiscellaneousIncomeJpy = trades.reduce(
    (sum, t) => sum.plus(t.miscellaneousIncomeJpy),
    new Decimal(0),
  );

  const notes: string[] = [
    "取引履歴を残しておらず暗号資産の取得価額が分からない場合、まず国内の暗号資産交換業者に「年間取引報告書」の(再)交付を依頼するか、国外の交換業者・個人間取引の場合は購入・売却時に使った銀行口座の入出金記録や交換業者の公表する取引相場等から確認すること(国税庁FAQ問2-7)。それでもなお確認できない場合に限り、この5%相当額の概算取得費を使うこと。",
    "実際の取得価額が判明している取引は、その実額をそのまま入力すること。この5%の概算取得費は取得価額が確認できない場合の代替手段であり、実額が判明していながらより有利だからという理由で選択できる特例ではない。",
    "確定申告書を提出した後に正しい取得価額が判明した場合は、修正申告又は更正の請求により訂正すること(国税庁FAQ問2-7注)。",
    "この試算結果は、既存の暗号資産の損益計算(総平均法/移動平均法によるプール計算。/importの暗号資産の取引フォーム)とは別の、取得価額が全く分からない取引のみを対象にした単体の試算であり、DBへの登録機能は持たない。",
  ];

  return {
    trades,
    totalProceedsJpy,
    totalAcquisitionCostJpy,
    totalMiscellaneousIncomeJpy,
    notes,
  };
}
