import { Decimal } from "decimal.js";

/**
 * 相続財産を譲渡した場合の取得費の特例(取得費加算の特例。租税特別措置法39条・
 * 措置法令25条の16、国税庁タックスアンサーNo.3267「相続財産を譲渡した場合の
 * 取得費の特例」)の試算。
 *
 * 相続又は遺贈により財産を取得した者が、相続開始のあった日の翌日からその財産に
 * 係る相続税の申告期限の翌日以後3年を経過する日までにその財産を譲渡した場合、
 * その者の相続税額のうち一定の金額を、譲渡所得の計算上の取得費に加算できる特例。
 * 通常の取得費(取得価額等)に上乗せして控除できるため、その分だけ譲渡益(譲渡所得の
 * 金額)を圧縮できる。
 *
 * 取得費に加算する相続税額の計算式(国税庁タックスアンサーNo.3267):
 *   取得費に加算する相続税額 = その者の相続税額 ×
 *     (譲渡した財産の相続税評価額 ÷ その者の相続税の課税価格
 *      〔債務控除前。取得財産の価額+相続時精算課税適用財産の価額+暦年課税分の
 *      贈与財産の価額〕)
 * ただし、この金額がその財産の譲渡による譲渡益(譲渡所得の金額)を超える場合は、
 * その譲渡益に相当する金額が上限となる(取得費加算により譲渡損失を作り出すことは
 * できない)。
 *
 * 複数の相続財産を譲渡した場合は、譲渡した財産ごとにこの算式を適用し、それぞれの
 * 上限(その財産の譲渡益)を適用したうえで合計する(国税庁「相続財産の取得費に
 * 加算される相続税の計算明細書」が財産ごとの内訳欄を持つ様式であることに基づく)。
 *
 * この特例は譲渡所得にのみ適用があり、株式等の譲渡による事業所得・雑所得(頻繁な
 * 信用取引等、事業として行う取引)には適用できない(国税庁タックスアンサーNo.3267)。
 * 本ツールが扱う上場株式等・一般株式等・投資信託の譲渡損益(機能2・機能54。措置法
 * 37条の10・37条の11の申告分離課税)はいずれも譲渡所得に区分されるため対象になる。
 *
 * **制約:**
 *  - 相続開始のあった日の翌日から相続税の申告期限の翌日以後3年を経過する日までに
 *    譲渡したかどうか(適用期限内かどうか)は、相続税の申告期限自体が「相続の開始が
 *    あったことを知った日の翌日から10か月以内」で被相続人の死亡日と必ずしも一致しない
 *    ことを踏まえ、実際の日付計算は行わずユーザー自身の確認事項とする(`withinDeadline`
 *    フラグ)。適用期限外の場合はその財産分の加算額を0円として扱う。
 *  - 本ツールは`estimateInheritedAcquisitionCostAddition`が返す加算額をDBへ登録・
 *    `/tax-estimate`や既存の株式等譲渡損益計算(`src/lib/investment/calculator.ts`)へ
 *    自動反映する機能は持たない(取得費への加算は個々の譲渡取引の取得費そのものを
 *    書き換えるものであり、`/import`で登録済みの取引データを本機能から直接更新する
 *    仕組みは無いため)。試算結果はユーザー自身が該当する譲渡取引の取得費入力欄へ
 *    加算する前提とする。
 *  - 土地・建物の譲渡所得(本ツールの対象外である不動産の分離課税)への適用は、
 *    上限額の計算式自体は同じだが本ツールのスコープ外のため試算しない。
 */

export interface InheritedTransferInput {
  /** 結果表示用の任意ラベル(未指定なら「譲渡財産N」を自動採番) */
  label?: string;
  /** 譲渡した財産の相続税評価額(相続税の申告等で用いた評価額) */
  inheritedValuationJpy: Decimal.Value;
  /** その財産の譲渡による譲渡益(譲渡収入金額-取得費・譲渡費用。譲渡損失の場合は0以下の値) */
  transferGainJpy: Decimal.Value;
  /**
   * 相続開始のあった日の翌日から、その財産に係る相続税の申告期限の翌日以後3年を
   * 経過する日までに譲渡したか(適用期限内かどうか。ユーザー自身の確認事項)
   */
  withinDeadline: boolean;
}

export interface InheritedAcquisitionCostAdditionInput {
  /** その者(相続人)の相続税額 */
  inheritanceTaxJpy: Decimal.Value;
  /**
   * その者の相続税の課税価格(債務控除前。取得財産の価額+相続時精算課税適用財産の
   * 価額+暦年課税分の贈与財産の価額)
   */
  taxableBaseJpy: Decimal.Value;
  transfers: InheritedTransferInput[];
}

export interface InheritedTransferResult {
  label: string;
  inheritedValuationJpy: Decimal;
  transferGainJpy: Decimal;
  withinDeadline: boolean;
  /** 上限適用前の按分計算額(相続税額×相続税評価額÷課税価格) */
  proportionalAdditionJpy: Decimal;
  /** 取得費に加算される相続税額(譲渡益による上限・適用期限を反映した後の金額) */
  additionJpy: Decimal;
  /** 按分計算額がその財産の譲渡益を上回ったため、譲渡益相当額に切り下げたかどうか */
  cappedByGain: boolean;
}

export interface InheritedAcquisitionCostAdditionResult {
  transfers: InheritedTransferResult[];
  /** すべての譲渡財産の加算額の合計 */
  totalAdditionJpy: Decimal;
  notes: string[];
}

function requireNonNegative(value: Decimal, label: string): void {
  if (value.isNegative()) {
    throw new Error(`${label}は0以上である必要があります`);
  }
}

export function estimateInheritedAcquisitionCostAddition(
  input: InheritedAcquisitionCostAdditionInput,
): InheritedAcquisitionCostAdditionResult {
  const inheritanceTaxJpy = new Decimal(input.inheritanceTaxJpy);
  const taxableBaseJpy = new Decimal(input.taxableBaseJpy);
  requireNonNegative(inheritanceTaxJpy, "相続税額");
  requireNonNegative(taxableBaseJpy, "相続税の課税価格");

  if (input.transfers.length > 0 && taxableBaseJpy.isZero()) {
    throw new Error("相続税の課税価格は0より大きい必要があります");
  }

  const transfers: InheritedTransferResult[] = input.transfers.map((transfer, index) => {
    const inheritedValuationJpy = new Decimal(transfer.inheritedValuationJpy);
    const transferGainJpy = new Decimal(transfer.transferGainJpy);
    requireNonNegative(inheritedValuationJpy, `譲渡した財産の相続税評価額(${index + 1}件目)`);
    if (inheritedValuationJpy.greaterThan(taxableBaseJpy)) {
      throw new Error(
        `譲渡した財産の相続税評価額は相続税の課税価格以下である必要があります(${index + 1}件目)`,
      );
    }

    const proportionalAdditionJpy = inheritanceTaxJpy
      .times(inheritedValuationJpy)
      .dividedBy(taxableBaseJpy);
    const gainFloorJpy = Decimal.max(transferGainJpy, 0);
    const cappedAdditionJpy = Decimal.min(proportionalAdditionJpy, gainFloorJpy);
    const additionJpy = transfer.withinDeadline ? cappedAdditionJpy : new Decimal(0);

    return {
      label: transfer.label?.trim() || `譲渡財産${index + 1}`,
      inheritedValuationJpy,
      transferGainJpy,
      withinDeadline: transfer.withinDeadline,
      proportionalAdditionJpy,
      additionJpy,
      cappedByGain: proportionalAdditionJpy.greaterThan(gainFloorJpy),
    };
  });

  const totalAdditionJpy = transfers.reduce(
    (sum, transfer) => sum.plus(transfer.additionJpy),
    new Decimal(0),
  );

  const notes: string[] = [
    "国税庁タックスアンサーNo.3267「相続財産を譲渡した場合の取得費の特例」(租税特別措置法39条)に基づく概算値。相続又は遺贈により取得した財産に相続税が課税されている場合、その相続税額のうち按分計算した金額を譲渡所得の取得費に加算できる。",
    "取得費に加算する相続税額 = その者の相続税額 × (譲渡した財産の相続税評価額 ÷ その者の相続税の課税価格〔取得財産の価額+相続時精算課税適用財産の価額+暦年課税分の贈与財産の価額〕)。この金額がその財産の譲渡益を超える場合は譲渡益相当額が上限となる。",
    "適用期限(相続開始のあった日の翌日から、その財産に係る相続税の申告期限の翌日以後3年を経過する日まで)は実際の日付計算を行わず、ユーザー自身が確認したうえで各譲渡財産の「適用期限内」チェックの要否を判断する前提とする。",
    "この特例は譲渡所得にのみ適用があり、株式等の譲渡による事業所得・雑所得には適用できない。本ツールが扱う上場株式等・一般株式等・投資信託の譲渡損益は譲渡所得に区分されるため対象になる。",
    "試算結果(additionJpy)は、該当する譲渡取引の取得費に加算する金額の参考値であり、`/import`に登録済みの取引データや`/tax-estimate`の合計税額試算への自動反映は行わない。該当する譲渡取引の取得費入力欄へ手動で加算すること。",
    "各金額は円未満の端数を切り捨てずDecimalの計算結果をそのまま返す概算値。",
  ];

  return { transfers, totalAdditionJpy, notes };
}
