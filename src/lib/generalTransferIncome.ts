import { Decimal } from "decimal.js";

/**
 * 総合課税の譲渡所得(土地、建物及び株式等以外の資産を譲渡したときの譲渡所得。
 * 所得税法33条、国税庁タックスアンサーNo.1460「譲渡所得(土地、建物及び株式等以外の
 * 資産を譲渡したとき)」・No.3105「譲渡所得の対象となる資産と課税方法」・
 * No.3152「譲渡所得の計算のしかた(総合課税)」)を試算する。
 *
 * 自動車、ゴルフ会員権、貴金属・宝石・書画骨とう(1個又は1組の価額が30万円を超えるもの)、
 * 金地金、特許権等の資産を譲渡した場合の所得が対象。土地・建物等(措置法31条・32条、
 * 分離課税)、株式等(措置法37条の10等、分離課税)、生活用動産(家具・衣服等の生活に
 * 通常必要な動産。所得税法9条1項9号・所得税法施行令25条により非課税)はいずれも対象外
 * (所得区分・非課税判定はユーザー自身の確認事項)。
 *
 * 所有期間が譲渡日時点(実際の保有期間)で5年以下の資産の譲渡益を短期譲渡所得、
 * 5年を超える資産の譲渡益を長期譲渡所得という(所得税法33条3項1号・2号)。土地・建物等の
 * 分離課税(措置法31条・32条)と異なり「譲渡した年の1月1日時点」ではなく実際の所有期間で
 * 判定する点に注意。
 *
 * 計算式(所得税法33条3項・4項、国税庁タックスアンサーNo.3152):
 *   短期の残額 = Σ(短期資産の譲渡価額 - 取得費 - 譲渡費用)
 *   長期の残額 = Σ(長期資産の譲渡価額 - 取得費 - 譲渡費用)
 *   特別控除額(最高50万円) = 短期の残額と長期の残額の合計額(0円が下限)と50万円の
 *     いずれか少ない方。短期の残額から優先して差し引く。
 *   総所得金額に算入する額 = (短期の残額 - 短期分の特別控除額)
 *     + (長期の残額 - 長期分の特別控除額) × 1/2 (所得税法22条2項2号)
 *
 * 短期・長期それぞれの区分内では、複数資産の譲渡益・譲渡損を合算してよい
 * (同条3項の「その残額の合計額」)。ただし、区分内で合算した結果が譲渡損失(マイナス)に
 * なった場合、その損失をもう一方の区分の譲渡益や他の所得と通算できるかどうかは
 * 所得税基本通達33-5等の込み入った取扱いによるため、本ツールでは自動計算せず、
 * その区分の残額を0円として扱う(参考情報として損失額は別途返す)。実際に損益通算・
 * 繰越控除まで行いたい場合は国税庁や税理士に確認すること。
 */

export interface GeneralTransferItem {
  /** 資産の内容(自動車、ゴルフ会員権、貴金属等。任意の説明ラベル) */
  description: string;
  /** 譲渡価額(売却額) */
  transferPriceJpy: Decimal.Value;
  /** 取得費(取得価額・設備費・改良費等の合計) */
  acquisitionCostJpy: Decimal.Value;
  /** 譲渡費用(仲介手数料等、譲渡のために直接要した費用) */
  transferExpensesJpy: Decimal.Value;
  /** 所有期間(年)。譲渡日時点の実際の所有期間で、5年以下なら短期、5年超なら長期 */
  ownershipYears: number;
}

export interface GeneralTransferIncomeInput {
  items: GeneralTransferItem[];
}

export interface GeneralTransferIncomeResult {
  /** 短期譲渡所得の残額の合計(譲渡価額-取得費-譲渡費用の合計。0円が下限) */
  shortTermGainJpy: Decimal;
  /** 長期譲渡所得の残額の合計(同上。0円が下限) */
  longTermGainJpy: Decimal;
  /** 短期区分で合算した結果が譲渡損失だった場合のその金額(参考情報。0円以上) */
  shortTermLossJpy: Decimal;
  /** 長期区分で合算した結果が譲渡損失だった場合のその金額(参考情報。0円以上) */
  longTermLossJpy: Decimal;
  /** 特別控除額のうち短期分に充当した額(優先充当) */
  specialDeductionShortTermJpy: Decimal;
  /** 特別控除額のうち長期分に充当した額 */
  specialDeductionLongTermJpy: Decimal;
  /** 特別控除額の合計(最高50万円) */
  specialDeductionTotalJpy: Decimal;
  /** 短期譲渡所得の金額(特別控除後。全額が総所得金額に算入される) */
  shortTermIncomeJpy: Decimal;
  /** 長期譲渡所得の金額(特別控除後。2分の1にする前) */
  longTermIncomeJpy: Decimal;
  /** 総所得金額に算入する額(短期譲渡所得の金額 + 長期譲渡所得の金額×1/2) */
  taxableAmountJpy: Decimal;
  notes: string[];
}

// 特別控除額の上限(所得税法33条4項)
const SPECIAL_DEDUCTION_MAX_JPY = 500_000;

function requireNonNegative(value: Decimal, label: string): void {
  if (value.isNegative()) {
    throw new Error(`${label}は0以上である必要があります`);
  }
}

export function estimateGeneralTransferIncome(
  input: GeneralTransferIncomeInput,
): GeneralTransferIncomeResult {
  let shortTermNetJpy = new Decimal(0);
  let longTermNetJpy = new Decimal(0);

  for (const item of input.items) {
    const transferPriceJpy = new Decimal(item.transferPriceJpy);
    const acquisitionCostJpy = new Decimal(item.acquisitionCostJpy);
    const transferExpensesJpy = new Decimal(item.transferExpensesJpy);

    requireNonNegative(transferPriceJpy, "譲渡価額");
    requireNonNegative(acquisitionCostJpy, "取得費");
    requireNonNegative(transferExpensesJpy, "譲渡費用");
    if (!Number.isInteger(item.ownershipYears) || item.ownershipYears < 0) {
      throw new Error("所有期間(年)は0以上の整数である必要があります");
    }

    const netJpy = transferPriceJpy.minus(acquisitionCostJpy).minus(transferExpensesJpy);
    if (item.ownershipYears > 5) {
      longTermNetJpy = longTermNetJpy.plus(netJpy);
    } else {
      shortTermNetJpy = shortTermNetJpy.plus(netJpy);
    }
  }

  const shortTermGainJpy = Decimal.max(shortTermNetJpy, 0);
  const longTermGainJpy = Decimal.max(longTermNetJpy, 0);
  const shortTermLossJpy = Decimal.max(shortTermNetJpy.negated(), 0);
  const longTermLossJpy = Decimal.max(longTermNetJpy.negated(), 0);

  const totalGainJpy = shortTermGainJpy.plus(longTermGainJpy);
  const specialDeductionTotalJpy = Decimal.min(totalGainJpy, SPECIAL_DEDUCTION_MAX_JPY);
  // 短期の残額から優先して特別控除を充当する(国税庁タックスアンサーNo.3152)
  const specialDeductionShortTermJpy = Decimal.min(shortTermGainJpy, specialDeductionTotalJpy);
  const specialDeductionLongTermJpy = specialDeductionTotalJpy.minus(specialDeductionShortTermJpy);

  const shortTermIncomeJpy = shortTermGainJpy.minus(specialDeductionShortTermJpy);
  const longTermIncomeJpy = longTermGainJpy.minus(specialDeductionLongTermJpy);
  const taxableAmountJpy = shortTermIncomeJpy.plus(longTermIncomeJpy.dividedBy(2));

  const notes: string[] = [
    "国税庁タックスアンサーNo.1460「譲渡所得(土地、建物及び株式等以外の資産を譲渡したとき)」・No.3105「譲渡所得の対象となる資産と課税方法」・No.3152「譲渡所得の計算のしかた(総合課税)」に基づく概算値。自動車、ゴルフ会員権、貴金属・宝石・書画骨とう(1個又は1組の価額が30万円を超えるもの)、金地金、特許権等が対象。",
    "土地・建物等(措置法31条・32条により分離課税)、上場株式等・一般株式等(措置法37条の10等により分離課税)は対象外(それぞれ別画面で試算すること)。家具・衣服等の生活に通常必要な動産の譲渡による所得は所得税法9条1項9号・所得税法施行令25条により非課税のため、そもそも本ツールへの入力対象外(該当資産かどうかの判定はユーザー自身が行うこと)。",
    "所有期間は譲渡した日時点の実際の所有期間(取得日から譲渡日まで)で判定する。土地・建物等の分離課税(措置法31条・32条)のような「譲渡した年の1月1日時点」での判定ではない点に注意(所得税法33条3項1号・2号)。",
    "特別控除額(最高50万円)は短期・長期の譲渡益の合計額に対して1回のみで、短期の譲渡益から優先して差し引く(国税庁タックスアンサーNo.3152)。短期・長期それぞれの区分内では複数資産の譲渡益・譲渡損失を合算してよいが、区分内の合算結果が譲渡損失になった場合、その損失をもう一方の区分や他の所得と損益通算できるかどうかの判定は本ツールでは行わない(その区分の残額を0円として扱う。参考情報としてshortTermLossJpy/longTermLossJpyを返す)。",
    "長期譲渡所得の金額はその2分の1のみを総所得金額に算入する(所得税法22条2項2号)。短期譲渡所得の金額は全額を算入する。",
    "この試算結果(taxableAmountJpy)は、他の総合課税所得と合算した後の金額として/tax-estimateの「給与所得等の課税所得金額」へ手入力で反映すること。他の所得控除試算画面と異なりDBへの登録機能は持たない(一時所得・公的年金等に係る雑所得と同様、所得控除ではなく所得区分そのものの計算のため)。",
    "取得費が不明な場合の概算取得費(譲渡価額の5%相当額。土地・建物の譲渡でよく使われる措置)の要否判定は行わない。取得費にはユーザー自身が算出した金額を入力すること。",
    "各金額は円未満の端数を切り捨てずDecimalの計算結果をそのまま返す概算値。",
  ];

  return {
    shortTermGainJpy,
    longTermGainJpy,
    shortTermLossJpy,
    longTermLossJpy,
    specialDeductionShortTermJpy,
    specialDeductionLongTermJpy,
    specialDeductionTotalJpy,
    shortTermIncomeJpy,
    longTermIncomeJpy,
    taxableAmountJpy,
    notes,
  };
}
