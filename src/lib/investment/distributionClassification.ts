import { Decimal } from "decimal.js";

/**
 * 追加型(オープン型)投資信託の収益分配金を「普通分配金(課税、配当所得)」と
 * 「特別分配金(元本払戻金。非課税)」に区分する。
 *
 * オープン型の証券投資信託の収益分配金のうち、収益調整金のみに係る収益として
 * 分配される部分(特別分配金)は非課税所得とされる(所得税法9条1項11号、同法
 * 施行令27条。e-Govで確認した施行令27条本文:「法第九条第一項第十一号に規定する
 * 政令で定めるものは、オープン型の証券投資信託の収益の分配のうち、当該投資信託
 * の終了又は一部の解約により支払われる金額でその元本を超える部分以外の部分…」
 * の簡略な言い換えとして、実務上は「分配落ち後基準価額が個別元本を下回る部分」を
 * 元本の払戻しとみなす)。
 *
 * 判定方法(投資信託会社・証券会社が共通して用いる実務上の計算方法。分配前個別元本を
 * P、分配落ち後基準価額をV、分配金額をDとすると):
 *
 *  - V >= P の場合: 全額が普通分配金(課税)。個別元本は変わらない。
 *  - V <  P の場合: 特別分配金(非課税) = min(D, P - V)。残りが普通分配金(課税)。
 *    分配後の個別元本 = P - 特別分配金。
 *
 * 特別分配金は元本の払戻しに過ぎないため、その分だけ個別元本(=将来売却時の取得費)が
 * 減少する。複数回にわたって分配を受ける場合、前回分配後の個別元本を次回分配時の
 * 分配前個別元本として引き継ぐ。
 *
 * 分配金額・個別元本・基準価額は投資信託の目論見書・運用報告書・分配金明細で
 * 「1万口当たり」の金額として開示されるのが通例のため、本モジュールも1万口当たりの
 * 金額を入力とし、保有口数を掛けて実際の金額に換算する。
 *
 * **対象外とした範囲(今後の課題):**
 * - 期中の追加購入・一部解約による保有口数の変動(本モジュールは一連の分配を通じて
 *   保有口数が一定であることを前提とする)。
 * - 普通分配金に対する配当控除の判定・税額計算(`dividendTaxSimulation.ts`が別途
 *   対応する。本モジュールが算出する普通分配金額をその入力として用いること)。
 * - 上場投資法人(J-REIT)の「出資等減少分配(資本の払戻し)」に伴う取得費調整
 *   (みなし配当課税(所得税法25条)を伴う点で本モジュールの非課税判定とは別制度)。
 * - 特定口座(源泉徴収あり)で自動計算・徴収される場合との整合性確認(証券会社の
 *   計算結果と本モジュールの試算結果が一致するかはユーザー自身の確認事項とする)。
 */

export interface InvestmentTrustDistributionEvent {
  /** 区別のための任意のラベル(例: 決算日) */
  label?: string;
  /** 1万口当たりの分配金額(税引前・分配落ち前) */
  distributionPer10kUnitsJpy: Decimal.Value;
  /** 1万口当たりの分配落ち後基準価額 */
  postDistributionNavPer10kUnitsJpy: Decimal.Value;
}

export interface InvestmentTrustDistributionEventResult {
  label: string;
  /** この分配における分配前個別元本(1万口当たり) */
  openingPrincipalPer10kUnitsJpy: Decimal;
  /** 1万口当たりの普通分配金額(課税、配当所得) */
  taxableDistributionPer10kUnitsJpy: Decimal;
  /** 1万口当たりの特別分配金額(元本払戻金、非課税) */
  nonTaxableDistributionPer10kUnitsJpy: Decimal;
  /** この分配後の個別元本(1万口当たり) */
  closingPrincipalPer10kUnitsJpy: Decimal;
  /** 普通分配金額(保有口数換算後の実額) */
  taxableDistributionJpy: Decimal;
  /** 特別分配金額(保有口数換算後の実額) */
  nonTaxableDistributionJpy: Decimal;
}

export interface InvestmentTrustDistributionResult {
  events: InvestmentTrustDistributionEventResult[];
  /** 普通分配金額(配当所得)の合計(実額) */
  totalTaxableDistributionJpy: Decimal;
  /** 特別分配金額(元本払戻金・非課税)の合計(実額) */
  totalNonTaxableDistributionJpy: Decimal;
  /** 最終的な個別元本(1万口当たり。次回以降の分配・売却時の取得費計算に使用) */
  closingPrincipalPer10kUnitsJpy: Decimal;
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

function requirePositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label}は正の整数である必要があります`);
  }
}

/**
 * 保有口数を一定として、一連の分配(決算)を古い順に処理し、分配ごとに普通分配金・
 * 特別分配金へ区分する。個別元本は分配のたびに特別分配金相当額だけ減少し、次の
 * 分配へ引き継がれる。
 */
export function classifyInvestmentTrustDistributions(
  openingPrincipalPer10kUnitsJpy: Decimal.Value,
  holdingUnits: number,
  events: InvestmentTrustDistributionEvent[],
): InvestmentTrustDistributionResult {
  requirePositiveInteger(holdingUnits, "保有口数");
  let principal = toDecimal(openingPrincipalPer10kUnitsJpy);
  requireNonNegative(principal, "分配前個別元本");

  const unitScale = new Decimal(holdingUnits).dividedBy(10_000);

  const results: InvestmentTrustDistributionEventResult[] = events.map((event, index) => {
    const label = event.label?.trim() || `分配${index + 1}`;
    const distribution = toDecimal(event.distributionPer10kUnitsJpy);
    const postNav = toDecimal(event.postDistributionNavPer10kUnitsJpy);
    requireNonNegative(distribution, "分配金額");
    requireNonNegative(postNav, "分配落ち後基準価額");

    const openingPrincipalPer10kUnits = principal;
    const principalShortfall = openingPrincipalPer10kUnits.minus(postNav);
    const nonTaxablePer10kUnits = principalShortfall.isPositive()
      ? Decimal.min(distribution, principalShortfall)
      : new Decimal(0);
    const taxablePer10kUnits = distribution.minus(nonTaxablePer10kUnits);
    const closingPrincipalPer10kUnits = openingPrincipalPer10kUnits.minus(nonTaxablePer10kUnits);

    principal = closingPrincipalPer10kUnits;

    return {
      label,
      openingPrincipalPer10kUnitsJpy: openingPrincipalPer10kUnits,
      taxableDistributionPer10kUnitsJpy: taxablePer10kUnits,
      nonTaxableDistributionPer10kUnitsJpy: nonTaxablePer10kUnits,
      closingPrincipalPer10kUnitsJpy: closingPrincipalPer10kUnits,
      taxableDistributionJpy: taxablePer10kUnits.times(unitScale),
      nonTaxableDistributionJpy: nonTaxablePer10kUnits.times(unitScale),
    };
  });

  const totalTaxableDistributionJpy = results.reduce(
    (sum, r) => sum.plus(r.taxableDistributionJpy),
    new Decimal(0),
  );
  const totalNonTaxableDistributionJpy = results.reduce(
    (sum, r) => sum.plus(r.nonTaxableDistributionJpy),
    new Decimal(0),
  );

  const notes: string[] = [
    "追加型(オープン型)投資信託の収益分配金は、分配落ち後基準価額が分配前個別元本を下回る場合、その差額(分配金額を上限とする)が元本の払戻しとみなされ非課税になる(特別分配金・元本払戻金。所得税法9条1項11号・同法施行令27条)。残りが課税対象の普通分配金(配当所得)になる。",
    "特別分配金の額だけ個別元本が減少し、次回以降の分配・将来の売却時の取得費計算に引き継がれる。",
    "普通分配金額は配当所得として、課税方式(総合課税・申告分離課税・申告不要)の選択によりさらに税額が異なる(`/dividend-simulation`)。本画面で求めた普通分配金額をその入力として用いること。",
    "分配金額・個別元本・基準価額はいずれも目論見書・運用報告書・分配金明細に記載される「1万口当たり」の金額を入力する。保有口数を掛けて実額に換算する(期中の追加購入・一部解約による保有口数の変動は対象外)。",
    "特定口座(源泉徴収あり)で証券会社が自動計算・徴収している場合、本ツールの試算結果と一致するかはユーザー自身で確認すること。上場投資法人(J-REIT)の出資等減少分配(資本の払戻し)は別制度のため対象外。",
    "所得区分そのものの計算のためDBへの登録機能は持たない単体の試算画面。",
  ];

  return {
    events: results,
    totalTaxableDistributionJpy,
    totalNonTaxableDistributionJpy,
    closingPrincipalPer10kUnitsJpy: principal,
    notes,
  };
}
