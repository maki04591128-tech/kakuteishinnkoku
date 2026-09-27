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
 * 本モジュールが対応する範囲(施行令185条2項1号。国税庁タックスアンサーNo.1620の
 * 「新相続税法対象年金」のうち確定年金):
 *
 * 1. 相続税評価割合 = 相続税評価額 ÷ 年金の支払総額(確定年金なので確定額)
 * 2. 相続税評価割合に応じた割合(国税庁「相続等に係る生命保険契約等に基づく年金の雑所得の
 *    金額の計算書(施行令185条2項又は186条2項に基づき計算する場合)」の⑦欄。以下の速算表
 *    による。50%以下の場合は一律100%(2項1号ロは「支払総額」をそのまま単位数で除すため、
 *    3項4号の「課税割合」という概念自体が定義されない。50%超の場合のみ3項4号の「課税割合」に
 *    一致する))。
 *
 *      相続税評価割合           割合
 *      50%以下                 100%
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
 * 3. 課税部分(支払総額のうち課税対象となる総額) = 支払総額 × 上記の割合
 *    (50%以下の場合は割合が常に100%のため、課税部分の総額 = 支払総額そのものになる)
 * 4. 単位数の計算(相続税評価割合が50%超か以下かで算式が異なる。施行令185条2項1号イ・ロ):
 *    - 50%超(イ): 課税単位数 = 残存期間年数 ×(残存期間年数-1)÷ 2
 *    - 50%以下(ロ): まず特定期間年数(施行令185条3項5号)を次の速算表により算出する。
 *
 *        相続税評価割合           特定期間算出割合
 *        10%以下                  20%
 *        10%超   20%以下          40%
 *        20%超   30%以下          60%
 *        30%超   40%以下          80%
 *        40%超   50%以下         100%
 *
 *      特定期間年数 = 残存期間年数 × 特定期間算出割合 - 1年(1年未満の端数は切り上げ)。
 *      総単位数 = 残存期間年数 × 特定期間年数。
 * 5. 一単位当たりの金額 = 課税部分(3) ÷ 単位数(4)
 * 6. 経過年数 = 支払年数(支払開始日の年を1年目とする)- 1(端数切り捨て)
 * 7. その年分の課税部分の年金収入額(支払年金対応額)は、相続税評価割合が50%超か以下かで
 *    算式が異なる(施行令185条2項1号イ・ロ)。
 *    - 50%超(イ): 一単位当たりの金額 × 経過年数
 *    - 50%以下(ロ): 経過年数が特定期間年数以下の間(支払を受ける日が「特定期間」内)は
 *      一単位当たりの金額 × 経過年数。経過年数が特定期間年数を超えた後(特定期間終了後)は、
 *      一単位当たりの金額 × 特定期間年数 - 1円で頭打ちになり、それ以降は経過年数が増えても
 *      一定額のまま増加しない。
 *    いずれの場合も、この金額がその年に支払を受ける年金の額以上になる場合は、一単位当たりの
 *    金額の整数倍の金額のうち年金の額に満たない最も多い金額とする(施行令185条2項1号6号)。
 *    年金支給初年(経過年数0)は必ず全額非課税になる。
 * 8. 非課税部分の金額 = その年に支払を受ける年金の額 - 課税部分の年金収入額
 * 9. 必要経費に算入する金額 = 課税部分の年金収入額 ×(保険料又は掛金の総額 ÷ 支払総額)
 *    (施行令185条2項後段が準用する同条1項8号。割合は小数点以下2位まで算出し3位以下を
 *    切り上げる(同項11号)。`privateAnnuityIncome.ts`の必要経費割合と同じ端数処理)
 * 10. 雑所得の金額 = 課税部分の年金収入額 - 必要経費に算入する金額
 *
 * 施行令185条2項は必要経費の計算について前項(1項)8号〜11号を準用しており、本モジュールは
 * このうち次の2点にも対応する(機能143。e-Govで確認した施行令185条の条文に基づく):
 * - 7号: 年金の支払開始日以後に分配を受けた剰余金又は割戻しを受けた割戻金の額は、必要経費
 *   控除の対象にはならず、そのままその年分の雑所得に係る総収入金額に加算する。
 * - 10号(1項10号。2項で準用): 当該生命保険契約等が年金のほか一時金も支払う内容のもので
 *   ある場合、8号ロの保険料総額は、保険料総額のうち支払総額(見込額)が
 *   「支払総額(見込額)+一時金の額」に占める割合分に按分した金額とする
 *   (`privateAnnuityIncome.ts`が施行令183条1項3号について実装済みの考え方と同じ按分方法)。
 *
 * 相続税評価割合が100分の50以下の確定年金(施行令185条2項1号ロ・3項5号)への対応(機能144)。
 * 国税庁タックスアンサーNo.1620は「税務署にお問合せください」と案内するのみで具体的な
 * 計算方法を示していないが、e-Govで確認した施行令185条2項1号ロ・3項5号の条文本文に加え、
 * 国税庁が公開する「相続等に係る生命保険契約等に基づく年金の雑所得の金額の計算書(施行令
 * 185条2項又は186条2項に基づき計算する場合)」(様式・記載要領。国税庁法令解釈通達
 * https://www.nta.go.jp/law/tsutatsu/kobetsu/shotoku/shinkoku/101020/01.pdf)により、
 * 条文の各要素(特定期間年数・総単位数・一単位当たりの金額・支払年金対応額)の算式・端数処理
 * (特定期間年数は1年未満切り上げ)・6号の頭打ち処理(様式別表4)を実データの記載例に基づき
 * 相互に確認できたため、今回実装した。
 *
 * **対象外とした範囲(今後の課題):**
 * - 旧相続税法対象年金(年金受給権につき、平成22年度税制改正前の相続税法24条の評価方法の
 *   適用があるもの。施行令185条1項)。残存期間年数の長さに応じてさらに複雑な算式(40%・
 *   30%の乗率や特定単位数等)になり、かつ平成22年度税制改正から既に15年以上が経過して
 *   おり現存する契約は限られると考えられるため対象外とした。
 * - 終身年金・有期年金・保証期間付終身(有期)年金(施行令185条2項2号〜5号)。別表(余命年数表)に
 *   基づく支払開始日余命年数・支払総額見込額の算出が前提になり、`privateAnnuityIncome.ts`が
 *   既に対象外としている支払総額見込額の算出と同様の理由で対象外とした。
 * - 当初年金受取人(支払開始日に最初にその年金の支払を受けていた者)が現在の年金受取人と
 *   異なる場合(二次相続等)の必要経費の特例計算(施行令185条2項が準用する同条1項9号)。
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
  /** 年金のほか一時金も支払う内容の契約である場合の一時金の額(無ければ0) */
  lumpSumAmountJpy?: Decimal.Value;
  /** 年金の支払開始日以後に分配を受けた剰余金・割戻金の額(無ければ0) */
  surplusDistributionJpy?: Decimal.Value;
}

export interface InheritedAnnuityContractResult {
  name: string;
  /** 相続税評価割合(相続税評価額÷支払総額) */
  inheritanceTaxValuationRatio: Decimal;
  /**
   * 相続税評価割合に応じた割合(課税部分の総額=支払総額×この割合。相続税評価割合が50%以下の
   * 場合は一律100%になる。50%超の場合のみ施行令185条3項4号の「課税割合」に一致する)
   */
  taxableRatio: Decimal;
  /**
   * 特定期間年数(施行令185条3項5号。相続税評価割合が100分の50以下の場合のみ算出する。
   * 50%超の場合はundefined)
   */
  specificPeriodYears?: number;
  /** 経過年数 */
  elapsedYears: number;
  /** 単位数(50%超の場合は課税単位数、50%以下の場合は総単位数) */
  taxableUnits: Decimal;
  /** 一単位当たりの金額 */
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

interface RatioBracket {
  minExclusive: number;
  maxInclusive: number;
  ratio: number;
}

// 3項4号「課税割合」の速算表。50%超のみ定義されている(50%以下は上のlookupTaxableRatioで別途100%を返す)。
const TAXABLE_RATIO_TABLE: RatioBracket[] = [
  { minExclusive: 0.5, maxInclusive: 0.55, ratio: 0.45 },
  { minExclusive: 0.55, maxInclusive: 0.6, ratio: 0.4 },
  { minExclusive: 0.6, maxInclusive: 0.65, ratio: 0.35 },
  { minExclusive: 0.65, maxInclusive: 0.7, ratio: 0.3 },
  { minExclusive: 0.7, maxInclusive: 0.75, ratio: 0.25 },
  { minExclusive: 0.75, maxInclusive: 0.8, ratio: 0.2 },
  { minExclusive: 0.8, maxInclusive: 0.83, ratio: 0.17 },
  { minExclusive: 0.83, maxInclusive: 0.86, ratio: 0.14 },
  { minExclusive: 0.86, maxInclusive: 0.89, ratio: 0.11 },
  { minExclusive: 0.89, maxInclusive: 0.92, ratio: 0.08 },
  { minExclusive: 0.92, maxInclusive: 0.95, ratio: 0.05 },
  { minExclusive: 0.95, maxInclusive: 0.98, ratio: 0.02 },
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

/**
 * 相続税評価割合に応じた割合(施行令185条2項1号イの「課税割合」(3項4号)を50%超の場合に、
 * 50%以下の場合は一律100%(2項1号ロは支払総額をそのまま単位数で除すため課税割合という
 * 概念自体が無い)を返す。国税庁の様式「相続等に係る生命保険契約等に基づく年金の雑所得の
 * 金額の計算書」⑦欄と同じ速算表)。
 */
function lookupTaxableRatio(inheritanceTaxValuationRatio: Decimal): Decimal {
  if (inheritanceTaxValuationRatio.lessThanOrEqualTo(0.5)) {
    return new Decimal(1);
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
    throw new Error("相続税評価割合に対応する割合が見つかりませんでした");
  }
  return new Decimal(bracket.ratio);
}

/** 特定期間年数(施行令185条3項5号)の算出に用いる「特定期間算出割合」の速算表 */
function lookupSpecificPeriodRatio(inheritanceTaxValuationRatio: Decimal): Decimal {
  if (inheritanceTaxValuationRatio.lessThanOrEqualTo(0.1)) {
    return new Decimal(0.2);
  }
  if (inheritanceTaxValuationRatio.lessThanOrEqualTo(0.2)) {
    return new Decimal(0.4);
  }
  if (inheritanceTaxValuationRatio.lessThanOrEqualTo(0.3)) {
    return new Decimal(0.6);
  }
  if (inheritanceTaxValuationRatio.lessThanOrEqualTo(0.4)) {
    return new Decimal(0.8);
  }
  return new Decimal(1);
}

/**
 * 特定期間年数(施行令185条3項5号) = 残存期間年数 × 特定期間算出割合 - 1年
 * (計算結果に1年未満の端数を生じたときは切り上げる)。
 */
function computeSpecificPeriodYears(
  remainingYearsAtAcquisition: number,
  specificPeriodRatio: Decimal,
): number {
  const years = specificPeriodRatio
    .times(remainingYearsAtAcquisition)
    .minus(1)
    .ceil()
    .toNumber();
  if (years < 1) {
    throw new Error(
      "相続税評価割合が低い一方で残存期間年数が短いため、特定期間年数が1年未満になる組み合わせです" +
        "(施行令185条3項5号)。本ツールでは対応していません。",
    );
  }
  return years;
}

/**
 * 施行令185条2項6号: 一課税単位当たりの金額(又は一単位当たりの金額)の整数倍を用いて計算した
 * 支払年金対応額がその年に支払を受ける年金の額以上になる場合は、前各号の規定にかかわらず、
 * 当該整数倍の金額のうち年金の額に満たない最も多い金額とする。
 */
function capBySixGou(
  taxableUnitAmountJpy: Decimal,
  rawTaxablePortionJpy: Decimal,
  annualAnnuityAmountJpy: Decimal,
): Decimal {
  if (rawTaxablePortionJpy.lessThan(annualAnnuityAmountJpy) || taxableUnitAmountJpy.isZero()) {
    return rawTaxablePortionJpy.isNegative() ? new Decimal(0) : rawTaxablePortionJpy;
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
    const lumpSumAmountJpy = contract.lumpSumAmountJpy
      ? toDecimal(contract.lumpSumAmountJpy)
      : new Decimal(0);
    const surplusDistributionJpy = contract.surplusDistributionJpy
      ? toDecimal(contract.surplusDistributionJpy)
      : new Decimal(0);

    requireNonNegative(annualAnnuityAmountJpy, "年金の額");
    requireNonNegative(inheritanceTaxValuationJpy, "相続税評価額");
    requireNonNegative(totalPremiumsPaidJpy, "保険料又は掛金の総額");
    requireNonNegative(lumpSumAmountJpy, "一時金の額");
    requireNonNegative(surplusDistributionJpy, "剰余金・割戻金の額");
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
    const isLowValuationRatio = inheritanceTaxValuationRatio.lessThanOrEqualTo(0.5);
    const taxableRatio = lookupTaxableRatio(inheritanceTaxValuationRatio);
    const totalTaxablePortionJpy = totalScheduledPaymentJpy.times(taxableRatio);

    let taxableUnits: Decimal;
    let specificPeriodYears: number | undefined;
    if (isLowValuationRatio) {
      const specificPeriodRatio = lookupSpecificPeriodRatio(inheritanceTaxValuationRatio);
      specificPeriodYears = computeSpecificPeriodYears(
        contract.remainingYearsAtAcquisition,
        specificPeriodRatio,
      );
      taxableUnits = new Decimal(contract.remainingYearsAtAcquisition).times(specificPeriodYears);
    } else {
      taxableUnits = new Decimal(contract.remainingYearsAtAcquisition)
        .times(contract.remainingYearsAtAcquisition - 1)
        .dividedBy(2);
    }
    const taxableUnitAmountJpy = totalTaxablePortionJpy.dividedBy(taxableUnits);

    const elapsedYears = contract.paymentYearNumber - 1;
    let rawTaxablePortionJpy: Decimal;
    if (isLowValuationRatio) {
      // 2項1号ロ: 特定期間(経過年数<=特定期間年数)は経過年数に比例、特定期間終了後は
      // 「一単位当たりの金額×特定期間年数-1円」で頭打ちになり以後増加しない。
      rawTaxablePortionJpy =
        elapsedYears <= (specificPeriodYears as number)
          ? taxableUnitAmountJpy.times(elapsedYears)
          : taxableUnitAmountJpy.times(specificPeriodYears as number).minus(1);
    } else {
      // 2項1号イ: 経過年数に比例して増加し続ける
      rawTaxablePortionJpy = taxableUnitAmountJpy.times(elapsedYears);
    }
    const taxablePortionJpy = capBySixGou(
      taxableUnitAmountJpy,
      rawTaxablePortionJpy,
      annualAnnuityAmountJpy,
    );
    const nonTaxablePortionJpy = annualAnnuityAmountJpy.minus(taxablePortionJpy);

    // 1項10号(2項で準用): 一時金も支払う契約の場合、保険料総額を支払総額の按分比率で調整する
    const adjustedPremiumTotal = lumpSumAmountJpy.isZero()
      ? totalPremiumsPaidJpy
      : totalPremiumsPaidJpy
          .times(totalScheduledPaymentJpy)
          .dividedBy(totalScheduledPaymentJpy.plus(lumpSumAmountJpy));

    // 1項11号(2項で準用): 割合は小数点以下2位まで算出し、3位以下を切り上げる
    const necessaryExpenseRatio = adjustedPremiumTotal
      .dividedBy(totalScheduledPaymentJpy)
      .toDecimalPlaces(2, Decimal.ROUND_UP);
    const necessaryExpenseJpy = taxablePortionJpy.times(necessaryExpenseRatio);
    // 2項7号: 剰余金・割戻金は必要経費控除の対象外でそのまま総収入金額に加算する
    const miscIncomeJpy = taxablePortionJpy.minus(necessaryExpenseJpy).plus(surplusDistributionJpy);

    return {
      name,
      inheritanceTaxValuationRatio,
      taxableRatio,
      specificPeriodYears,
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
    "相続税評価割合に応じた割合(50%以下は一律100%、50%超は速算表による)に応じて、支払総額のうち課税部分の総額を算出する。この課税部分の総額を単位数(50%超は課税単位数=残存期間年数×(残存期間年数-1)÷2、50%以下は総単位数=残存期間年数×特定期間年数)で割った「一単位当たりの金額」に経過年数を乗じてその年分の課税部分の年金収入額を計算する。年金支給初年(経過年数0)は必ず全額非課税になる。",
    "相続税評価割合が100分の50以下の確定年金(施行令185条2項1号ロ)は、特定期間年数(施行令185条3項5号。残存期間年数×特定期間算出割合-1年、1年未満切り上げ)を境に計算方法が変わる。特定期間(経過年数が特定期間年数以下)は50%超の場合と同様に経過年数に比例して増加するが、特定期間終了後は「一単位当たりの金額×特定期間年数-1円」で頭打ちになり、それ以降は経過年数が増えても一定額のまま増加しない(機能144)。",
    "必要経費に算入する金額は、その年分の課税部分の年金収入額に「保険料又は掛金の総額÷支払総額」の割合(小数点以下2位まで算出し3位以下切り上げ)を乗じて計算する(施行令185条2項が準用する同条1項8号・11号。保険料負担者=年金受取人である通常の個人年金保険の必要経費割合(施行令183条1項、`/private-annuity-income`)と同じ端数処理)。",
    "年金のほか一時金も支払う内容の契約である場合、保険料総額のうち年金に対応する部分だけを按分して必要経費の計算に用いる(施行令185条2項が準用する同条1項10号)。",
    "年金の支払開始日以後に分配を受けた剰余金・割戻金の額は、必要経費の控除対象にはならず、そのまま総収入金額(雑所得の金額)に加算する(施行令185条2項7号)。",
    "終身年金・有期年金・保証期間付終身(有期)年金(施行令185条2項2号〜5号)、平成22年度税制改正前の相続税法24条の評価方法の適用がある「旧相続税法対象年金」(施行令185条1項)は対象外とした(今後の課題)。",
    "当初年金受取人と現在の年金受取人が異なる場合(二次相続等)の必要経費の特例計算(施行令185条2項が準用する同条1項9号)、年の途中で年金の支払が開始・終了した場合の月割計算は対象外とした(今後の課題)。",
    "この試算結果(totalMiscIncomeJpy)は、他の総合課税の雑所得と合算した後の金額として`/tax-estimate`へ手入力で反映すること。所得区分そのものの計算のためDBへの登録機能は持たない単体の試算画面。",
    "各金額は円未満の端数を切り捨てずDecimalの計算結果をそのまま返す概算値。",
  ];

  return { contracts: results, totalMiscIncomeJpy, notes };
}
