import { Decimal } from "decimal.js";

/**
 * 相続、遺贈又は贈与(以下「相続等」)により取得した年金受給権に基づき、生命保険契約等の
 * 確定年金の支払を受ける場合の雑所得の金額(非課税部分・課税部分の振り分け)を試算する。
 *
 * 死亡保険金を年金形式で受け取る場合や、保険料負担者と年金受取人が異なる個人年金保険を
 * 相続等により承継した場合、その年金受給権は相続税・贈与税の課税対象になる(相続税法24条)。
 * この課税対象となった部分にさらに所得税を課すと二重課税になるため、最高裁平成22年7月6日
 * 判決を踏まえた平成22年度税制改正により、所得税法施行令185条2項が新設され、年金の収入
 * 金額を非課税部分と課税部分に振り分けたうえで、課税部分のみを雑所得として計算する
 * (`privateAnnuityIncome.ts`が対象とする、保険料負担者=年金受取人である通常の個人年金保険の
 * 雑所得(施行令183条)とは異なる計算方法。国税庁タックスアンサーNo.1620)。
 *
 * 本モジュールが対応する範囲(施行令185条2項1号イ。国税庁タックスアンサーNo.1620の
 * 「新相続税法対象年金」のうち確定年金、かつ相続税評価割合が100分の50を超える場合):
 *
 * 1. 相続税評価割合 = 相続税評価額 ÷ 年金の支払総額(確定年金なので確定額)
 * 2. 課税割合: 相続税評価割合に応じて次の速算表により決定する(相続税評価割合が
 *    100分の50以下の場合は別の複雑な算式(施行令185条2項1号ロ、特定期間年数を用いる)
 *    によるため、国税庁タックスアンサーNo.1620も「税務署にお問合せください」と案内して
 *    おり、本ツールでは対象外(今後の課題)とする)。
 *
 *      相続税評価割合           課税割合
 *      50%超   55%以下          45%
 *      55%超   60%以下          40%
 *      60%超   65%以下          35%
 *      65%超   70%以下          30%
 *      70%超   75%以下          25%
 *      75%超   80%以下          20%
 *      80%超   83%以下          17%
 *      83%超   86%以下          14%
 *      86%超   89%以下          11%
 *      89%超   92%以下           8%
 *      92%超   95%以下           5%
 *      95%超   98%以下           2%
 *      98%超                     0%
 *
 * 3. 課税単位数 = 残存期間年数 ×(残存期間年数-1)÷ 2
 *    (残存期間年数は、その年金の支払を受ける居住者に係る支払開始日(その居住者が最初に
 *    年金の支払を受ける日)における残りの支払年数。生命保険会社が発行する年金支払通知書
 *    等に記載されている)
 * 4. 課税部分(支払総額のうち課税対象となる総額) = 支払総額 × 課税割合
 * 5. 一課税単位当たりの金額 = 課税部分 ÷ 課税単位数
 * 6. 経過年数 = 支払年数(支払開始日の年を1年目とする)- 1(端数切り捨て)
 * 7. その年分の課税部分の年金収入額(支払年金対応額) = 一課税単位当たりの金額 × 経過年数。
 *    ただし、この金額がその年に支払を受ける年金の額以上になる場合は、一課税単位当たりの
 *    金額の整数倍の金額のうち年金の額に満たない最も多い金額とする(施行令185条2項1号
 *    6号)。年金支給初年(経過年数0)は必ず全額非課税になる。
 * 8. 非課税部分の金額 = その年に支払を受ける年金の額 - 課税部分の年金収入額
 * 9. 必要経費に算入する金額 = 課税部分の年金収入額 ×(保険料又は掛金の総額 ÷ 支払総額)
 *    (施行令185条2項後段が準用する同条1項8号。割合は小数点以下2位まで算出し3位以下を
 *    切り上げる(同項11号)。`privateAnnuityIncome.ts`の必要経費割合と同じ端数処理)
 * 10. 雑所得の金額 = 課税部分の年金収入額 - 必要経費に算入する金額
 *
 * **対象外とした範囲(今後の課題):**
 * - 旧相続税法対象年金(年金受給権につき、平成22年度税制改正前の相続税法24条の評価方法の
 *   適用があるもの。施行令185条1項)。残存期間年数の長さに応じてさらに複雑な算式(40%・
 *   30%の乗率や特定単位数等)になり、かつ平成22年度税制改正から既に15年以上が経過して
 *   おり現存する契約は限られると考えられるため対象外とした。
 * - 相続税評価割合が100分の50以下の確定年金(施行令185条2項1号ロ)。国税庁タックスアンサー
 *   No.1620も具体的な計算方法を示さず「税務署にお問合せください」と案内している。
 * - 終身年金・有期年金・保証期間付終身(有期)年金(施行令185条2項2号〜5号)。余命年数表に
 *   基づく支払総額見込額・余命期間年数の算出が前提になり、`privateAnnuityIncome.ts`が
 *   既に対象外としている支払総額見込額の算出と同様の理由で対象外とした。
 * - 年金の支払開始後に分配を受けた剰余金・割戻金の加算(施行令185条2項7号)、年金のほか
 *   一時金も支払う契約の場合の保険料按分(同条1項10号の準用)。
 * - 当初年金受取人(支払開始日に最初にその年金の支払を受けていた者)が現在の年金受取人と
 *   異なる場合(二次相続等)の必要経費の特例計算(施行令185条2項後段が準用する同条1項9号)。
 *   本ツールは当初年金受取人=現在の年金受取人である一次相続のケースのみを対象とする。
 * - 年の途中で年金の支払が開始・終了した場合の月割計算。
 */

export interface InheritedAnnuityContract {
  /** 契約の名称等(複数契約を区別するための任意のラベル) */
  name?: string;
  /** その年に支払を受ける年金の額 */
  annualAnnuityAmountJpy: Decimal.Value;
  /** 年金受給権を相続等により取得した時点の相続税評価額 */
  inheritanceTaxValuationJpy: Decimal.Value;
  /** 確定年金の支払総額 */
  totalScheduledPaymentJpy: Decimal.Value;
  /** 当該生命保険契約等に係る保険料又は掛金の総額 */
  totalPremiumsPaidJpy: Decimal.Value;
  /** 支払開始日における残存期間年数(整数) */
  remainingYearsAtAcquisition: number;
  /** 支払年数(支払開始日の年を1年目とする整数) */
  paymentYearNumber: number;
}

export interface InheritedAnnuityContractResult {
  name: string;
  /** 相続税評価割合(相続税評価額÷支払総額) */
  inheritanceTaxValuationRatio: Decimal;
  /** 課税割合(速算表による) */
  taxableRatio: Decimal;
  /** 経過年数 */
  elapsedYears: number;
  /** 課税単位数 */
  taxableUnits: Decimal;
  /** 一課税単位当たりの金額 */
  taxableUnitAmountJpy: Decimal;
  /** その年分の課税部分の年金収入額(支払年金対応額) */
  taxablePortionJpy: Decimal;
  /** その年分の非課税部分の金額 */
  nonTaxablePortionJpy: Decimal;
  /** 必要経費の割合(小数点以下2位まで、3位以下切り上げ済み) */
  necessaryExpenseRatio: Decimal;
  /** 必要経費に算入する金額 */
  necessaryExpenseJpy: Decimal;
  /** この契約分の雑所得の金額 */
  miscIncomeJpy: Decimal;
}

export interface InheritedAnnuityIncomeResult {
  contracts: InheritedAnnuityContractResult[];
  /** 雑所得の金額の合計 */
  totalMiscIncomeJpy: Decimal;
  notes: string[];
}

interface TaxableRatioBracket {
  minExclusive: number;
  maxInclusive: number;
  taxableRatio: number;
}

const TAXABLE_RATIO_TABLE: TaxableRatioBracket[] = [
  { minExclusive: 0.5, maxInclusive: 0.55, taxableRatio: 0.45 },
  { minExclusive: 0.55, maxInclusive: 0.6, taxableRatio: 0.4 },
  { minExclusive: 0.6, maxInclusive: 0.65, taxableRatio: 0.35 },
  { minExclusive: 0.65, maxInclusive: 0.7, taxableRatio: 0.3 },
  { minExclusive: 0.7, maxInclusive: 0.75, taxableRatio: 0.25 },
  { minExclusive: 0.75, maxInclusive: 0.8, taxableRatio: 0.2 },
  { minExclusive: 0.8, maxInclusive: 0.83, taxableRatio: 0.17 },
  { minExclusive: 0.83, maxInclusive: 0.86, taxableRatio: 0.14 },
  { minExclusive: 0.86, maxInclusive: 0.89, taxableRatio: 0.11 },
  { minExclusive: 0.89, maxInclusive: 0.92, taxableRatio: 0.08 },
  { minExclusive: 0.92, maxInclusive: 0.95, taxableRatio: 0.05 },
  { minExclusive: 0.95, maxInclusive: 0.98, taxableRatio: 0.02 },
];

function toDecimal(value: Decimal.Value): Decimal {
  return new Decimal(value);
}

function requireNonNegative(value: Decimal, label: string): void {
  if (value.isNegative()) {
    throw new Error(`${label}は0以上である必要があります`);
  }
}

function requireInteger(value: number, label: string, min: number): void {
  if (!Number.isInteger(value) || value < min) {
    throw new Error(`${label}は${min}以上の整数である必要があります`);
  }
}

function lookupTaxableRatio(inheritanceTaxValuationRatio: Decimal): Decimal {
  if (inheritanceTaxValuationRatio.lessThanOrEqualTo(0.5)) {
    throw new Error(
      "相続税評価割合が100分の50以下の場合の計算方法は本ツールでは未対応です(国税庁タックスアンサーNo.1620にもとづき税務署にご確認ください)",
    );
  }
  if (inheritanceTaxValuationRatio.greaterThan(0.98)) {
    return new Decimal(0);
  }
  const bracket = TAXABLE_RATIO_TABLE.find(
    (b) =>
      inheritanceTaxValuationRatio.greaterThan(b.minExclusive) &&
      inheritanceTaxValuationRatio.lessThanOrEqualTo(b.maxInclusive),
  );
  if (!bracket) {
    // 0.5 < 割合 <= 0.98 は上の速算表で網羅されているため到達しない
    throw new Error("相続税評価割合に対応する課税割合が見つかりませんでした");
  }
  return new Decimal(bracket.taxableRatio);
}

/**
 * 施行令185条2項1号6号: 一課税単位当たりの金額 × 経過年数(支払年金対応額)が
 * その年に支払を受ける年金の額以上になる場合は、一課税単位当たりの金額の整数倍の
 * 金額のうち年金の額に満たない最も多い金額とする。
 */
function capTaxablePortion(
  taxableUnitAmountJpy: Decimal,
  elapsedYears: number,
  annualAnnuityAmountJpy: Decimal,
): Decimal {
  const raw = taxableUnitAmountJpy.times(elapsedYears);
  if (raw.lessThan(annualAnnuityAmountJpy) || taxableUnitAmountJpy.isZero()) {
    return raw;
  }
  let multiples = annualAnnuityAmountJpy.dividedBy(taxableUnitAmountJpy).floor();
  if (multiples.times(taxableUnitAmountJpy).greaterThanOrEqualTo(annualAnnuityAmountJpy)) {
    multiples = multiples.minus(1);
  }
  if (multiples.isNegative()) {
    return new Decimal(0);
  }
  return taxableUnitAmountJpy.times(multiples);
}

export function estimateInheritedAnnuityIncome(
  contracts: InheritedAnnuityContract[],
): InheritedAnnuityIncomeResult {
  const results: InheritedAnnuityContractResult[] = contracts.map((contract, index) => {
    const name = contract.name?.trim() || `契約${index + 1}`;
    const annualAnnuityAmountJpy = toDecimal(contract.annualAnnuityAmountJpy);
    const inheritanceTaxValuationJpy = toDecimal(contract.inheritanceTaxValuationJpy);
    const totalScheduledPaymentJpy = toDecimal(contract.totalScheduledPaymentJpy);
    const totalPremiumsPaidJpy = toDecimal(contract.totalPremiumsPaidJpy);

    requireNonNegative(annualAnnuityAmountJpy, "年金の額");
    requireNonNegative(inheritanceTaxValuationJpy, "相続税評価額");
    requireNonNegative(totalPremiumsPaidJpy, "保険料又は掛金の総額");
    if (totalScheduledPaymentJpy.lessThanOrEqualTo(0)) {
      throw new Error("確定年金の支払総額は正の値である必要があります");
    }
    requireInteger(contract.remainingYearsAtAcquisition, "残存期間年数", 2);
    requireInteger(contract.paymentYearNumber, "支払年数", 1);
    if (contract.paymentYearNumber > contract.remainingYearsAtAcquisition) {
      throw new Error(
        "支払年数が残存期間年数を超えています(見込みを超えて支払が続く場合の扱いは対象外です)",
      );
    }

    const inheritanceTaxValuationRatio = inheritanceTaxValuationJpy.dividedBy(
      totalScheduledPaymentJpy,
    );
    const taxableRatio = lookupTaxableRatio(inheritanceTaxValuationRatio);

    const taxableUnits = new Decimal(contract.remainingYearsAtAcquisition)
      .times(contract.remainingYearsAtAcquisition - 1)
      .dividedBy(2);
    const totalTaxablePortionJpy = totalScheduledPaymentJpy.times(taxableRatio);
    const taxableUnitAmountJpy = totalTaxablePortionJpy.dividedBy(taxableUnits);

    const elapsedYears = contract.paymentYearNumber - 1;
    const taxablePortionJpy = capTaxablePortion(
      taxableUnitAmountJpy,
      elapsedYears,
      annualAnnuityAmountJpy,
    );
    const nonTaxablePortionJpy = annualAnnuityAmountJpy.minus(taxablePortionJpy);

    const necessaryExpenseRatio = totalPremiumsPaidJpy
      .dividedBy(totalScheduledPaymentJpy)
      .toDecimalPlaces(2, Decimal.ROUND_UP);
    const necessaryExpenseJpy = taxablePortionJpy.times(necessaryExpenseRatio);
    const miscIncomeJpy = taxablePortionJpy.minus(necessaryExpenseJpy);

    return {
      name,
      inheritanceTaxValuationRatio,
      taxableRatio,
      elapsedYears,
      taxableUnits,
      taxableUnitAmountJpy,
      taxablePortionJpy,
      nonTaxablePortionJpy,
      necessaryExpenseRatio,
      necessaryExpenseJpy,
      miscIncomeJpy,
    };
  });

  const totalMiscIncomeJpy = results.reduce((sum, r) => sum.plus(r.miscIncomeJpy), new Decimal(0));

  const notes: string[] = [
    "死亡保険金を年金形式で受給している場合等、保険契約等に係る保険料の負担者でない方が相続等により取得した年金受給権に基づき確定年金の支払を受ける場合、その年金受給権は相続税・贈与税の課税対象になっているため、二重課税を避けるべく年金の収入金額を非課税部分と課税部分に振り分けて雑所得を計算する(所得税法35条・所得税法施行令185条2項、最高裁平成22年7月6日判決、国税庁タックスアンサーNo.1620)。",
    "相続税評価割合(相続税評価額÷支払総額)に応じた課税割合の速算表により、支払総額のうち課税部分の総額を算出し、これを課税単位数(残存期間年数×(残存期間年数-1)÷2)で割った「一課税単位当たりの金額」に経過年数を乗じてその年分の課税部分の年金収入額を計算する。年金支給初年(経過年数0)は必ず全額非課税になり、2年目以降は課税部分が階段状に増加する。",
    "必要経費に算入する金額は、その年分の課税部分の年金収入額に「保険料又は掛金の総額÷支払総額」の割合(小数点以下2位まで算出し3位以下切り上げ)を乗じて計算する(施行令185条2項が準用する同条1項8号・11号。保険料負担者=年金受取人である通常の個人年金保険の必要経費割合(施行令183条1項、`/private-annuity-income`)と同じ端数処理)。",
    "相続税評価割合が100分の50以下の確定年金の計算方法(施行令185条2項1号ロ)は対象外とした。国税庁タックスアンサーNo.1620も「税務署にお問合せください」と案内している。",
    "終身年金・有期年金・保証期間付終身(有期)年金(施行令185条2項2号〜5号)、平成22年度税制改正前の相続税法24条の評価方法の適用がある「旧相続税法対象年金」(施行令185条1項)は対象外とした(今後の課題)。",
    "年金の支払開始後に分配を受けた剰余金・割戻金の加算、年金のほか一時金も支払う契約の場合の保険料按分、当初年金受取人と現在の年金受取人が異なる場合(二次相続等)の必要経費の特例計算は対象外とした(今後の課題)。",
    "この試算結果(totalMiscIncomeJpy)は、他の総合課税の雑所得と合算した後の金額として`/tax-estimate`へ手入力で反映すること。所得区分そのものの計算のためDBへの登録機能は持たない単体の試算画面。",
    "各金額は円未満の端数を切り捨てずDecimalの計算結果をそのまま返す概算値。",
  ];

  return { contracts: results, totalMiscIncomeJpy, notes };
}
