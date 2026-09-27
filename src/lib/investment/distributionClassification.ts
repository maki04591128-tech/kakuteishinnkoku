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
 * 期中の追加購入・一部解約による保有口数の変動にも対応する(機能148)。各証券会社が
 * 公表する個別元本の説明(三菱UFJモルガン・スタンレー証券「個別元本」・マネックス証券
 * 「個別元本が変わりました。なぜですか。」等)によれば、同一銘柄を追加購入した場合、
 * 個別元本は「(追加購入前の投資総額+追加購入にかかった投資額)÷追加購入後の保有口数」
 * で口数加重平均され再計算される。一方、一部解約(売却)は各社の説明のいずれにも個別元本を
 * 変動させる要因として挙げられておらず、解約されるのはあくまで一部の口数であって、残存する
 * 口数の1万口当たりの個別元本(平均取得単価)自体は変わらない(総平均法に準ずる方法による
 * 株式等の取得費計算(`calculator.ts`)と同じ考え方)。この2点に基づき、時系列順の
 * イベント列(分配・追加購入・一部解約)を処理し、追加購入時のみ個別元本を加重平均で
 * 更新し、一部解約時は保有口数のみを減らす。
 *
 * **対象外とした範囲(今後の課題):**
 * - 分配金の再投資(自動的な追加購入として扱えば計算上は対応可能だが、専用のUI導線は
 *   今回は用意していない。ユーザー自身が追加購入イベントとして入力すれば計算は可能)。
 * - 普通分配金に対する配当控除の判定・税額計算(`dividendTaxSimulation.ts`が別途
 *   対応する。本モジュールが算出する普通分配金額をその入力として用いること)。
 * - 上場投資法人(J-REIT)の「出資等減少分配(資本の払戻し)」に伴う取得費調整
 *   (みなし配当課税(所得税法25条)を伴う点で本モジュールの非課税判定とは別制度。
 *   `capitalReturnDistribution.ts`で対応。機能146参照)。
 * - 特定口座(源泉徴収あり)で自動計算・徴収される場合との整合性確認(証券会社の
 *   計算結果と本モジュールの試算結果が一致するかはユーザー自身の確認事項とする)。
 */

export interface InvestmentTrustDistributionEvent {
  /** 省略時は"DISTRIBUTION"(分配)として扱う */
  type?: "DISTRIBUTION";
  /** 区別のための任意のラベル(例: 決算日) */
  label?: string;
  /** 1万口当たりの分配金額(税引前・分配落ち前) */
  distributionPer10kUnitsJpy: Decimal.Value;
  /** 1万口当たりの分配落ち後基準価額 */
  postDistributionNavPer10kUnitsJpy: Decimal.Value;
}

/** 期中の追加購入(同一銘柄への買い増し)。個別元本を口数加重平均で更新する。 */
export interface InvestmentTrustPurchaseEvent {
  type: "PURCHASE";
  /** 区別のための任意のラベル */
  label?: string;
  /** 追加購入した口数(正の整数) */
  units: number;
  /** 追加購入時の基準価額(1万口当たり) */
  pricePer10kUnitsJpy: Decimal.Value;
}

/** 期中の一部解約(売却)。保有口数のみ減少し、1万口当たりの個別元本は変わらない。 */
export interface InvestmentTrustRedemptionEvent {
  type: "REDEMPTION";
  /** 区別のための任意のラベル */
  label?: string;
  /** 一部解約した口数(正の整数、保有口数以下) */
  units: number;
}

export type InvestmentTrustTimelineEvent =
  | InvestmentTrustDistributionEvent
  | InvestmentTrustPurchaseEvent
  | InvestmentTrustRedemptionEvent;

export interface InvestmentTrustDistributionEventResult {
  label: string;
  /** この分配時点の保有口数 */
  holdingUnits: number;
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
  /** 最終的な保有口数(期中の追加購入・一部解約を反映した後の値) */
  closingHoldingUnits: number;
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
 * 期首保有口数を起点に、時系列順のイベント列(分配・追加購入・一部解約)を古い順に
 * 処理し、分配ごとに普通分配金・特別分配金へ区分する。個別元本は分配のたびに
 * 特別分配金相当額だけ減少し、追加購入のたびに口数加重平均で更新され、いずれも
 * 次のイベントへ引き継がれる。一部解約は保有口数のみを減少させ、1万口当たりの
 * 個別元本は変わらない。
 */
export function classifyInvestmentTrustDistributions(
  openingPrincipalPer10kUnitsJpy: Decimal.Value,
  holdingUnits: number,
  events: InvestmentTrustTimelineEvent[],
): InvestmentTrustDistributionResult {
  requirePositiveInteger(holdingUnits, "保有口数");
  let principal = toDecimal(openingPrincipalPer10kUnitsJpy);
  requireNonNegative(principal, "分配前個別元本");
  let units = new Decimal(holdingUnits);

  const results: InvestmentTrustDistributionEventResult[] = [];

  events.forEach((event) => {
    if (event.type === "PURCHASE") {
      requirePositiveInteger(event.units, "追加購入口数");
      const price = toDecimal(event.pricePer10kUnitsJpy);
      requireNonNegative(price, "追加購入時の基準価額");

      const purchaseUnits = new Decimal(event.units);
      const priorInvestment = principal.times(units).dividedBy(10_000);
      const additionalInvestment = price.times(purchaseUnits).dividedBy(10_000);
      const newUnits = units.plus(purchaseUnits);

      principal = priorInvestment.plus(additionalInvestment).times(10_000).dividedBy(newUnits);
      units = newUnits;
      return;
    }

    if (event.type === "REDEMPTION") {
      requirePositiveInteger(event.units, "一部解約口数");
      const redemptionUnits = new Decimal(event.units);
      if (redemptionUnits.greaterThan(units)) {
        throw new Error("一部解約口数は保有口数を超えることはできません");
      }
      units = units.minus(redemptionUnits);
      return;
    }

    const label = event.label?.trim() || `分配${results.length + 1}`;
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
    const unitScale = units.dividedBy(10_000);

    results.push({
      label,
      holdingUnits: units.toNumber(),
      openingPrincipalPer10kUnitsJpy: openingPrincipalPer10kUnits,
      taxableDistributionPer10kUnitsJpy: taxablePer10kUnits,
      nonTaxableDistributionPer10kUnitsJpy: nonTaxablePer10kUnits,
      closingPrincipalPer10kUnitsJpy: closingPrincipalPer10kUnits,
      taxableDistributionJpy: taxablePer10kUnits.times(unitScale),
      nonTaxableDistributionJpy: nonTaxablePer10kUnits.times(unitScale),
    });
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
    "期中に追加購入(買い増し)を行った場合、個別元本は「(追加購入前の投資総額+追加購入にかかった投資額)÷追加購入後の保有口数」で口数加重平均され再計算される。一部解約(売却)は保有口数のみを減らし、1万口当たりの個別元本は変わらない。",
    "普通分配金額は配当所得として、課税方式(総合課税・申告分離課税・申告不要)の選択によりさらに税額が異なる(`/dividend-simulation`)。本画面で求めた普通分配金額をその入力として用いること。",
    "分配金額・個別元本・基準価額はいずれも目論見書・運用報告書・分配金明細に記載される「1万口当たり」の金額を入力する。",
    "特定口座(源泉徴収あり)で証券会社が自動計算・徴収している場合、本ツールの試算結果と一致するかはユーザー自身で確認すること。上場投資法人(J-REIT)の出資等減少分配(資本の払戻し)は別制度のため対象外。",
    "所得区分そのものの計算のためDBへの登録機能は持たない単体の試算画面。",
  ];

  return {
    events: results,
    totalTaxableDistributionJpy,
    totalNonTaxableDistributionJpy,
    closingPrincipalPer10kUnitsJpy: principal,
    closingHoldingUnits: units.toNumber(),
    notes,
  };
}
