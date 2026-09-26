import { Decimal } from "decimal.js";
import { RECONSTRUCTION_SURTAX_RATE } from "./incomeTax";

/**
 * 寄附金控除(所得税法78条・地方税法37条の2等)の実額試算。
 *
 * `furusatoNozei.ts`の`estimateFurusatoNozeiLimit`が「自己負担2,000円のままに
 * なる年間寄附上限額」の目安を求めるのに対し、こちらは実際に支払った(または
 * 支払う予定の)寄附金額を入力して、所得税・住民税それぞれの控除額そのものを
 * 試算する。
 *
 * 計算式:
 *  - 所得税の寄附金控除額
 *      = min(寄附金の合計額, 総所得金額等 × 40%) − 2,000円(下限0円)
 *  - 住民税の基本控除額(道府県民税4%+市区町村民税6%の合計)
 *      = (min(寄附金の合計額, 総所得金額等 × 30%) − 2,000円) × 10%(下限0円)
 *  - 住民税の特例控除額(ふるさと納税=都道府県・市区町村への寄附分のみ)
 *      = (ふるさと納税額 − 2,000円) × (90% − 所得税の限界税率 × (1 + 復興特別所得税率))
 *    ただし住民税所得割額の20%が上限(`furusatoNozei.ts`の上限額試算と同じ式)。
 *
 * 簡略化している点:
 *  - 2,000円の足切りは寄附金の合計額に対して1回のみ適用する前提であり、
 *    ふるさと納税以外の寄附金控除対象(認定NPO法人等への寄附)が混在する場合の
 *    厳密な按分(本来は所得税と住民税で対象範囲が異なりうる)は行わない。
 *  - ワンストップ特例制度は考慮しない(確定申告での寄附金控除の適用を前提とする)。
 *  - 住宅ローン控除等、他の税額控除との兼ね合い(所得税額から控除しきれない
 *    場合に実際の恩恵が目減りすること)は考慮しない(`furusatoNozei.ts`と共通)。
 *
 * **エンジェル税制(特定新規株式を取得した場合の課税の特例。措置法37条の13の3、
 * 国税庁タックスアンサーNo.1544「エンジェル税制の概要等」。実務上「優遇措置A」とも
 * 呼ばれる):** 特定新規中小会社(中小企業等経営強化法6条の特定新規中小企業者に
 * 該当する設立1年未満の株式会社、または設立5年未満の一定の中小企業者等)が発行する
 * 株式(特定新規株式)を払込みにより取得した場合、その年中の取得価額の合計額
 * (800万円を限度。令和2年分以前は1,000万円だったが本ツールは現行の800万円のみに
 * 対応)を、他の寄附金と合算した上で寄附金控除の対象にできる。この特例は所得税のみの
 * 特例であり、住民税の寄附金控除(基本控除・特例控除)には加算しない(東京都
 * 「エンジェル税制のご案内」等、複数の公的機関・専門家解説で確認)。`angelTaxInvestmentJpy`
 * を指定すると、800万円の上限適用後の金額を所得税の寄附金控除の計算にのみ加算する。
 *
 * **対象外とした範囲(今後の課題):** 特定新規株式と同一銘柄について、この寄附金控除方式の
 * 代わりに、その年の株式等に係る譲渡所得等の金額から取得価額を控除する方式(措置法37条の13・
 * 37条の13の2。実務上「優遇措置B」。特定中小会社株式・設立特定株式が対象で、20億円超の
 * 適用額の調整計算や複数銘柄のプール計算を要する)は、寄附金控除方式と異なる所得区分
 * (譲渡所得等)への計算ロジックの追加が必要なため対象外とする。同一銘柄では両方式を
 * 重複適用できない(いずれか一方を選択)。また、この特例の適用を受けた特定新規株式を
 * 翌年以後に譲渡する場合、その株式の取得価額から適用を受けた金額を控除する調整計算
 * (措置法37条の13の3第2項)が必要になるが、本ツールは単年度の試算のためこの調整は
 * 対象外とし、翌年以後の一般株式等の譲渡所得計算(機能54等)にその株式を入力する際は
 * ユーザー自身が取得価額を調整すること。
 *
 * **沖縄振興特別措置法の指定会社に係る1,000万円特例(機能124):** 国税庁タックスアンサー
 * No.1544の注記により、沖縄振興特別措置法57条の2第1項に規定する指定会社で平成26年4月1日
 * から令和3年3月31日までの間に指定を受けたものが発行する株式を取得した場合、上限額は
 * 800万円ではなく1,000万円になる。指定会社に該当するかどうか・指定を受けた時期が上記
 * 期間内かどうかは、他の特別控除の適用要件(`specialDeductionEligible`等)と同様に
 * ユーザー自身の確認事項とし(`isOkinawaDesignatedCompanyStock`)、本ツールでは判定しない。
 */

export interface DonationDeductionInput {
  /** 寄附金控除の対象となる寄附金の合計額(ふるさと納税分を含む) */
  totalDonationJpy: Decimal.Value;
  /** 上記のうち、住民税の特例控除(ふるさと納税)の対象となる額。totalDonationJpy以下。 */
  furusatoNozeiDonationJpy: Decimal.Value;
  /** その年の総所得金額等(寄附金控除の上限判定に使う) */
  totalIncomeJpy: Decimal.Value;
  /** 住民税所得割額(特例控除の上限20%判定用の概算値。`/tax-estimate`の試算結果等を入力する) */
  residentTaxIncomeLeviedJpy: Decimal.Value;
  /** 所得税の限界税率(0〜0.45。課税総所得金額に対応する速算表の税率) */
  marginalIncomeTaxRate: Decimal.Value;
  /**
   * エンジェル税制(特定新規株式を取得した場合の課税の特例。措置法37条の13の3)の
   * 対象となる、その年中に特定新規株式の払込みにより取得した金額の合計額。
   * 800万円(沖縄振興特別措置法の指定会社の株式なら1,000万円。`isOkinawaDesignatedCompanyStock`
   * 参照)を限度に寄附金控除(所得税のみ)の対象額に加算する。省略時は0。
   */
  angelTaxInvestmentJpy?: Decimal.Value;
  /**
   * `angelTaxInvestmentJpy`が沖縄振興特別措置法57条の2第1項に規定する指定会社
   * (経済金融活性化特別地区内で平成26年4月1日から令和3年3月31日までの間に指定を
   * 受けたもの)が発行する株式である場合はtrue。上限額が800万円ではなく1,000万円になる
   * (国税庁タックスアンサーNo.1544の注記)。省略時はfalse(通常の800万円が上限)。
   */
  isOkinawaDesignatedCompanyStock?: boolean;
}

export interface DonationDeductionResult {
  totalDonationJpy: Decimal;
  furusatoNozeiDonationJpy: Decimal;
  totalIncomeJpy: Decimal;
  residentTaxIncomeLeviedJpy: Decimal;
  marginalIncomeTaxRate: Decimal;
  /**
   * エンジェル税制(措置法37条の13の3)により寄附金控除の対象に加算した金額
   * (800万円、沖縄振興特別措置法の指定会社の株式なら1,000万円の上限適用後)。
   * 住民税の控除計算には加算しない。
   */
  angelTaxDeemedDonationJpy: Decimal;
  /** 所得税の寄附金控除額(所得控除) */
  incomeTaxDeductionJpy: Decimal;
  /** 住民税の基本控除額 */
  residentTaxBasicDeductionJpy: Decimal;
  /** 住民税の特例控除額(ふるさと納税分。上限20%適用後) */
  residentTaxSpecialDeductionJpy: Decimal;
  /** 特例控除額の上限(住民税所得割額の20%) */
  residentTaxSpecialDeductionLimitJpy: Decimal;
  /** 住民税控除額の合計(基本控除+特例控除) */
  residentTaxTotalDeductionJpy: Decimal;
  notes: string[];
}

const INCOME_TAX_DEDUCTION_INCOME_CAP_RATE = 0.4;
const RESIDENT_TAX_BASIC_DEDUCTION_INCOME_CAP_RATE = 0.3;
const RESIDENT_TAX_BASIC_DEDUCTION_RATE = 0.1;
const RESIDENT_TAX_SPECIAL_DEDUCTION_LIMIT_RATE = 0.2;
const SELF_PAY_JPY = new Decimal(2_000);
/** エンジェル税制(措置法37条の13の3)の寄附金控除方式における年間の上限額(現行。令和2年分以前は1,000万円) */
const ANGEL_TAX_DONATION_CAP_JPY = new Decimal(8_000_000);
/**
 * 沖縄振興特別措置法57条の2第1項に規定する指定会社(平成26年4月1日〜令和3年3月31日の間に
 * 指定を受けたもの)が発行する株式の場合の上限額(国税庁タックスアンサーNo.1544の注記)。
 */
const OKINAWA_ANGEL_TAX_DONATION_CAP_JPY = new Decimal(10_000_000);

function requireNonNegative(value: Decimal, label: string): void {
  if (value.isNegative()) {
    throw new Error(`${label}は0以上である必要があります`);
  }
}

export function estimateDonationDeduction(
  input: DonationDeductionInput,
): DonationDeductionResult {
  const totalDonationJpy = new Decimal(input.totalDonationJpy);
  const furusatoNozeiDonationJpy = new Decimal(input.furusatoNozeiDonationJpy);
  const totalIncomeJpy = new Decimal(input.totalIncomeJpy);
  const residentTaxIncomeLeviedJpy = new Decimal(input.residentTaxIncomeLeviedJpy);
  const marginalIncomeTaxRate = new Decimal(input.marginalIncomeTaxRate);
  const angelTaxInvestmentJpy = new Decimal(input.angelTaxInvestmentJpy ?? 0);
  const isOkinawaDesignatedCompanyStock = input.isOkinawaDesignatedCompanyStock ?? false;

  requireNonNegative(totalDonationJpy, "寄附金の合計額");
  requireNonNegative(furusatoNozeiDonationJpy, "ふるさと納税額");
  requireNonNegative(totalIncomeJpy, "総所得金額等");
  requireNonNegative(residentTaxIncomeLeviedJpy, "住民税所得割額");
  requireNonNegative(marginalIncomeTaxRate, "所得税の限界税率");
  requireNonNegative(angelTaxInvestmentJpy, "エンジェル税制の対象となる特定新規株式の取得価額の合計額");
  if (marginalIncomeTaxRate.greaterThan(0.45)) {
    throw new Error("所得税の限界税率は45%以下である必要があります");
  }
  if (furusatoNozeiDonationJpy.greaterThan(totalDonationJpy)) {
    throw new Error("ふるさと納税額は寄附金の合計額以下である必要があります");
  }

  const notes: string[] = [
    "所得税法78条(寄附金控除)・地方税法37条の2等に基づく概算値。ワンストップ特例制度は考慮していない(確定申告での寄附金控除の適用を前提とする)。",
    "2,000円の足切りは寄附金の合計額に対して1回のみ適用する前提であり、ふるさと納税以外の寄附金控除対象(認定NPO法人等への寄附)が混在する場合の厳密な按分は行わない。",
    "住宅ローン控除等、他の税額控除との兼ね合い(所得税額から控除しきれない場合に実際の恩恵が目減りすること)は考慮していない。",
  ];

  const angelTaxDonationCapJpy = isOkinawaDesignatedCompanyStock
    ? OKINAWA_ANGEL_TAX_DONATION_CAP_JPY
    : ANGEL_TAX_DONATION_CAP_JPY;
  const angelTaxDonationCapLabel = isOkinawaDesignatedCompanyStock ? "1,000万円" : "800万円";
  const angelTaxDeemedDonationJpy = Decimal.min(angelTaxInvestmentJpy, angelTaxDonationCapJpy);
  if (angelTaxInvestmentJpy.greaterThan(angelTaxDonationCapJpy)) {
    notes.push(
      `エンジェル税制(特定新規株式)の取得価額の合計額${angelTaxInvestmentJpy.toString()}円が上限${angelTaxDonationCapLabel}を超えるため、${angelTaxDonationCapLabel}を寄附金控除の対象額に加算した。`,
    );
  }
  if (angelTaxDeemedDonationJpy.greaterThan(0)) {
    notes.push(
      `エンジェル税制(特定新規株式を取得した場合の課税の特例。措置法37条の13の3、国税庁タックスアンサーNo.1544)により、特定新規株式の払込みによる取得価額${angelTaxDeemedDonationJpy.toString()}円(${angelTaxDonationCapLabel}上限適用後)を寄附金控除の対象額に加算した。この特例は所得税のみの特例のため、住民税の寄附金控除(基本控除・特例控除)の計算には加算していない。`,
    );
  }
  if (isOkinawaDesignatedCompanyStock) {
    notes.push(
      "沖縄振興特別措置法57条の2第1項に規定する指定会社(経済金融活性化特別地区内で平成26年4月1日から令和3年3月31日までの間に指定を受けたもの)が発行する株式として、上限額を1,000万円で計算した(国税庁タックスアンサーNo.1544の注記)。指定会社への該当・指定時期の確認はユーザー自身の責任で行うこと。",
    );
  }

  const incomeTaxDonationBaseJpy = totalDonationJpy.plus(angelTaxDeemedDonationJpy);
  const incomeTaxDeductionBaseJpy = Decimal.min(
    incomeTaxDonationBaseJpy,
    totalIncomeJpy.times(INCOME_TAX_DEDUCTION_INCOME_CAP_RATE),
  );
  const incomeTaxDeductionJpy = Decimal.max(0, incomeTaxDeductionBaseJpy.minus(SELF_PAY_JPY));

  const residentTaxBasicDeductionBaseJpy = Decimal.min(
    totalDonationJpy,
    totalIncomeJpy.times(RESIDENT_TAX_BASIC_DEDUCTION_INCOME_CAP_RATE),
  );
  const residentTaxBasicDeductionJpy = Decimal.max(
    0,
    residentTaxBasicDeductionBaseJpy.minus(SELF_PAY_JPY),
  ).times(RESIDENT_TAX_BASIC_DEDUCTION_RATE);

  const residentTaxSpecialDeductionLimitJpy = residentTaxIncomeLeviedJpy.times(
    RESIDENT_TAX_SPECIAL_DEDUCTION_LIMIT_RATE,
  );
  const rawSpecialDeductionJpy = Decimal.max(
    0,
    furusatoNozeiDonationJpy.minus(SELF_PAY_JPY),
  ).times(new Decimal(0.9).minus(marginalIncomeTaxRate.times(1 + RECONSTRUCTION_SURTAX_RATE)));
  const residentTaxSpecialDeductionJpy = Decimal.max(
    0,
    Decimal.min(rawSpecialDeductionJpy, residentTaxSpecialDeductionLimitJpy),
  );
  if (rawSpecialDeductionJpy.greaterThan(residentTaxSpecialDeductionLimitJpy)) {
    notes.push(
      "特例控除額が住民税所得割額の20%を超えるため、上限額(住民税所得割額の20%)で頭打ちになっている。この場合、実際の自己負担額は2,000円を超える(`/tax-estimate`のふるさと納税上限額試算を参照)。",
    );
  }

  const residentTaxTotalDeductionJpy = residentTaxBasicDeductionJpy.plus(
    residentTaxSpecialDeductionJpy,
  );

  return {
    totalDonationJpy,
    furusatoNozeiDonationJpy,
    totalIncomeJpy,
    residentTaxIncomeLeviedJpy,
    marginalIncomeTaxRate,
    angelTaxDeemedDonationJpy,
    incomeTaxDeductionJpy,
    residentTaxBasicDeductionJpy,
    residentTaxSpecialDeductionJpy,
    residentTaxSpecialDeductionLimitJpy,
    residentTaxTotalDeductionJpy,
    notes,
  };
}
