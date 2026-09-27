import { Decimal } from "decimal.js";

/**
 * 生命保険契約等に基づく個人年金(保険料負担者=年金受取人の場合)を年金形式で
 * 受け取ったときの雑所得(公的年金等以外)の金額を試算する。
 *
 * 公的年金等(国民年金・厚生年金・企業年金等。`src/lib/publicPensionIncome.ts`で
 * 対応済み)とは異なり、生命保険会社等の個人年金保険を年金として受け取る場合は
 * 公的年金等控除の対象にならず、所得税法35条・所得税法施行令183条1項に基づく
 * 個別の必要経費計算による「公的年金等以外の雑所得」となる(国税庁タックスアンサー
 * No.1610「保険契約者(保険料の負担者)である本人が支払を受ける個人年金」)。
 *
 * 施行令183条1項の計算方法:
 * - 一号: 年金の支払開始後に分配を受ける剰余金・割戻金の額は、その年分の総収入金額に
 *   そのまま算入する(必要経費の控除対象にはならない)。
 * - 二号: その年に支払を受ける年金の額に、次の割合を乗じた金額を必要経費に算入する。
 *     割合 = 保険料又は掛金の総額(ロ) ÷ 年金の支払総額又は支払総額の見込額(イ)
 *   イは、支払開始日において支払総額が確定している年金(いわゆる確定年金)であれば
 *   その確定した支払総額、支払開始日において支払総額が確定していない年金(有期年金・
 *   終身年金)であれば施行令82条の3第2項(確定給付企業年金の額から控除する金額)の
 *   規定に準じて計算した支払総額の見込額(実務上、生命保険会社が源泉徴収事務のために
 *   算出し年金支払通知書等で通知する)。
 * - 三号: 年金のほか一時金も支払う内容の契約である場合、ロの保険料総額は、契約に
 *   係る保険料総額のうち、支払総額(見込額)が「支払総額(見込額)+一時金の額」に
 *   占める割合分に按分した金額とする。
 * - 四号: 二号・三号の割合は小数点以下2位まで算出し、3位以下を切り上げる。
 *
 * 有期年金・終身年金の支払総額の見込額そのものの算出(施行令82条の3に準じた、
 * 余命年数表等を用いる複雑な計算)は本ツールでは行わない。確定年金は契約上の
 * 確定額(年金年額×支給年数等)を、有期年金・終身年金は生命保険会社が発行する
 * 年金支払通知書等に記載された見込額を、それぞれ`totalScheduledPaymentJpy`に
 * ユーザー自身が入力する前提とする(見込額算出そのものは対象外、今後の課題)。
 *
 * 一時金として受け取る場合(施行令183条2項、一時所得)は、既存の一時所得の
 * 試算(`src/lib/occasionalIncome.ts`・`/occasional-income`)で対応済み。
 */

export interface PrivateAnnuityContract {
  /** 契約の名称等(複数契約を区別するための任意のラベル) */
  name?: string;
  /** その年に支払を受ける年金の額 */
  annualAnnuityAmountJpy: Decimal.Value;
  /** 当該生命保険契約等に係る保険料又は掛金の総額 */
  totalPremiumsPaidJpy: Decimal.Value;
  /**
   * 年金の支払総額(確定年金の場合は確定額。有期年金・終身年金等、支払開始日に
   * おいて総額が確定していない年金の場合は、施行令82条の3第2項に準じて計算した
   * 支払総額の見込額。実務上は保険会社の年金支払通知書等に記載されている)
   */
  totalScheduledPaymentJpy: Decimal.Value;
  /** 年金のほか一時金も支払う内容の契約である場合の一時金の額(無ければ0) */
  lumpSumAmountJpy?: Decimal.Value;
  /** 年金の支払開始後に分配を受けた剰余金・割戻金の額(無ければ0) */
  surplusDistributionJpy?: Decimal.Value;
}

export interface PrivateAnnuityContractResult {
  name: string;
  /** 必要経費の割合(小数点以下2位まで、3位以下切り上げ済み) */
  necessaryExpenseRatio: Decimal;
  /** 必要経費に算入する金額(年金の額×割合) */
  necessaryExpenseJpy: Decimal;
  /** この契約分の雑所得の金額(年金の額-必要経費+剰余金等の額) */
  miscIncomeJpy: Decimal;
}

export interface PrivateAnnuityIncomeResult {
  contracts: PrivateAnnuityContractResult[];
  /** 雑所得(公的年金等以外)の金額の合計 */
  totalMiscIncomeJpy: Decimal;
  notes: string[];
}

function toDecimal(value: Decimal.Value): Decimal {
  return new Decimal(value);
}

function requireNonNegative(value: Decimal, label: string): void {
  if (value.isNegative()) {
    throw new Error(`${label}は0以上である必要があります`);
  }
}

export function estimatePrivateAnnuityIncome(
  contracts: PrivateAnnuityContract[],
): PrivateAnnuityIncomeResult {
  const results: PrivateAnnuityContractResult[] = contracts.map((contract, index) => {
    const name = contract.name?.trim() || `契約${index + 1}`;
    const annualAnnuityAmountJpy = toDecimal(contract.annualAnnuityAmountJpy);
    const totalPremiumsPaidJpy = toDecimal(contract.totalPremiumsPaidJpy);
    const totalScheduledPaymentJpy = toDecimal(contract.totalScheduledPaymentJpy);
    const lumpSumAmountJpy = contract.lumpSumAmountJpy
      ? toDecimal(contract.lumpSumAmountJpy)
      : new Decimal(0);
    const surplusDistributionJpy = contract.surplusDistributionJpy
      ? toDecimal(contract.surplusDistributionJpy)
      : new Decimal(0);

    requireNonNegative(annualAnnuityAmountJpy, "年金の額");
    requireNonNegative(totalPremiumsPaidJpy, "保険料又は掛金の総額");
    requireNonNegative(lumpSumAmountJpy, "一時金の額");
    requireNonNegative(surplusDistributionJpy, "剰余金・割戻金の額");
    if (totalScheduledPaymentJpy.lessThanOrEqualTo(0)) {
      throw new Error("年金の支払総額(又は見込額)は正の値である必要があります");
    }

    // 三号: 一時金も支払う契約の場合、保険料総額を支払総額の按分比率で調整する
    const adjustedPremiumTotal = lumpSumAmountJpy.isZero()
      ? totalPremiumsPaidJpy
      : totalPremiumsPaidJpy
          .times(totalScheduledPaymentJpy)
          .dividedBy(totalScheduledPaymentJpy.plus(lumpSumAmountJpy));

    // 四号: 割合は小数点以下2位まで算出し、3位以下を切り上げる
    const necessaryExpenseRatio = adjustedPremiumTotal
      .dividedBy(totalScheduledPaymentJpy)
      .toDecimalPlaces(2, Decimal.ROUND_UP);

    const necessaryExpenseJpy = annualAnnuityAmountJpy.times(necessaryExpenseRatio);
    const miscIncomeJpy = annualAnnuityAmountJpy
      .minus(necessaryExpenseJpy)
      .plus(surplusDistributionJpy);

    return {
      name,
      necessaryExpenseRatio,
      necessaryExpenseJpy,
      miscIncomeJpy,
    };
  });

  const totalMiscIncomeJpy = results.reduce(
    (sum, r) => sum.plus(r.miscIncomeJpy),
    new Decimal(0),
  );

  const notes: string[] = [
    "保険料負担者と年金受取人が同一人である個人年金保険を年金形式で受け取る場合、公的年金等控除の対象にならず、所得税法35条・所得税法施行令183条1項に基づく「公的年金等以外の雑所得」になる(国税庁タックスアンサーNo.1610)。",
    "必要経費に算入する金額は、その年に支払を受けた年金の額に「保険料又は掛金の総額÷年金の支払総額(又はその見込額)」の割合(小数点以下2位まで算出し3位以下切り上げ。施行令183条1項4号)を乗じて計算する。",
    "支払総額は、支払開始日において総額が確定している確定年金であればその確定額、有期年金・終身年金等総額が確定していない年金であれば施行令82条の3第2項に準じて計算した見込額(実務上は生命保険会社が年金支払通知書等で通知する金額)を用いる。この見込額自体の算出(余命年数表等を用いた計算)は本ツールでは行わないため、有期年金・終身年金の場合は通知書記載の見込額をそのまま入力すること。",
    "年金のほか一時金も支払う内容の契約(一時金と年金を選択・併給できる契約等)の場合、保険料総額のうち年金に対応する部分だけを按分して必要経費の計算に用いる(施行令183条1項3号)。",
    "年金の支払開始後に分配を受けた剰余金・割戻金の額は、必要経費の控除対象にはならず、そのまま総収入金額(雑所得の金額)に加算する(施行令183条1項1号)。",
    "この試算結果(totalMiscIncomeJpy)は、他の総合課税の雑所得と合算した後の金額として`/tax-estimate`へ手入力で反映すること。一時所得・総合課税の譲渡所得等と同様、所得区分そのものの計算のためDBへの登録機能は持たない単体の試算画面。",
    "生命保険の満期返戻金・解約返戻金等を一時金として受け取る場合の一時所得は、既存の`/occasional-income`で試算すること(施行令183条2項)。",
    "相続等により取得した年金受給権(死亡保険金等を年金形式で受け取る契約)に係る雑所得は、相続税の課税対象となった部分について所得税を非課税とする二重課税排除の調整(最高裁平成22年7月6日判決・国税庁タックスアンサーNo.1620)が別途必要になるため対象外とした(今後の課題)。保険料負担者と年金受取人が異なる契約(贈与税・相続税が別途関係する)も対象外。",
    "各金額は円未満の端数を切り捨てずDecimalの計算結果をそのまま返す概算値。",
  ];

  return { contracts: results, totalMiscIncomeJpy, notes };
}
