import { Decimal } from "decimal.js";

/**
 * 旧NISA(令和5年(2023年)までに投資した一般NISA・つみたてNISA)の非課税期間終了時、
 * 課税口座(特定口座・一般口座)へ払い出される際の取得価額の付け替えを試算する。
 *
 * 令和6年(2024年)からの新NISA制度では非課税保有期間が無期限化されたが、令和5年
 * までの旧NISA(一般NISA・つみたてNISA)で投資した分はそのまま旧制度の非課税期間
 * (一般NISAは5年間、つみたてNISAは20年間。いずれも投資した年を1年目として計算)が
 * 適用され続ける。また、新NISA制度創設に伴い旧NISAから新NISAへのロールオーバー
 * (非課税期間終了時に翌年分の非課税投資枠を使って新たな非課税期間に持ち込む制度)は
 * 令和5年分をもって廃止されたため、非課税期間終了までに売却しなかった場合、翌年
 * 最初の営業日に課税口座へ自動的に払い出される(特定口座を開設していない場合は
 * 一般口座)。
 *
 * 払い出し時の取得価額は「新たに買い付けたもの」とみなして付け替えられ、非課税期間
 * 最終年の最終営業日(通常12月30日。12月30日が休業日の場合はその直前の営業日)の
 * 終値(投資信託は基準価額)がそのまま新しい取得価額になる(措置法37条の14第7項
 * (一般NISA)・第16項(つみたてNISA。累積投資勘定)。各証券会社のNISA解説ページ
 * (楽天証券・SBI証券・大和証券等)も同様に説明している)。実際に購入した価額
 * (originalCostBasisJpy)がいくらだったかに関わらず、払い出し後の課税口座では
 * この付け替え後の価額が新たな取得費として将来の譲渡所得計算に使われる。
 *
 * これにより生じる典型的な「落とし穴」は次の2つ:
 *  - 非課税期間中に値上がりしていた場合: 実際の購入価額から払い出し時点までの
 *    値上がり益は非課税のまま確定する(得)。
 *  - 非課税期間中に値下がりしていた場合: 実際の購入価額から払い出し時点までの
 *    値下がり損は非課税期間中の損失として切り捨てられ、他の譲渡益との損益通算や
 *    繰越控除の対象にできない(損)。さらに、払い出し後に価格が回復して実際の
 *    購入価額まで戻ったとしても、付け替え後の(低い)取得価額を基準に計算すると
 *    課税対象の譲渡益が生じてしまう(実質的には損益ゼロでも課税される)。
 *
 * この試算画面は、`untaxedGainJpy`(付け替えによって非課税のまま確定する
 * 含み益、またはマイナスの場合は切り捨てられる含み損)を銘柄ごとに算出し、
 * 付け替え後の新しい取得価額(`newCostBasisJpy`)を示すことで、この落とし穴を
 * 可視化する。`newCostBasisJpy`は、翌年分以後の課税口座での譲渡所得計算のため、
 * `/import`の期首残高(前年繰越残高。機能0参照)への登録値としてそのまま
 * 使うことを想定している。
 *
 * 制約(今後の課題):
 *  - 非課税期間最終年の最終営業日の終値は本ツールが自動取得せず、ユーザー自身の
 *    入力に委ねる(本ツールは市場データを保持しないため)。
 *  - 一般NISAの投資可能期間は平成26年(2014年)〜令和5年(2023年)、つみたてNISAの
 *    投資可能期間は平成30年(2018年)〜令和5年(2023年)だが、入力された投資年が
 *    この範囲外でも計算自体は行い、`isAcquisitionYearInExpectedRange`で
 *    範囲外である旨を示すのみとする(厳密なエラーにはしない)。
 *  - 非課税期間終了前に売却した場合の非課税譲渡益(通常のNISA売却)は対象外
 *    (この試算は非課税期間終了まで売却しなかった場合のみを扱う)。
 *  - ジュニアNISAは非課税期間・払出し時の取扱いが異なる別制度のため対象外。
 */

export type OldNisaType = "GENERAL_OLD" | "TSUMITATE_OLD";

const HOLDING_PERIOD_YEARS: Record<OldNisaType, number> = {
  GENERAL_OLD: 5,
  TSUMITATE_OLD: 20,
};

const ACQUISITION_YEAR_RANGE: Record<OldNisaType, { min: number; max: number }> = {
  GENERAL_OLD: { min: 2014, max: 2023 },
  TSUMITATE_OLD: { min: 2018, max: 2023 },
};

export interface OldNisaHoldingInput {
  symbol: string;
  nisaType: OldNisaType;
  /** 旧NISA口座で買い付けた年(西暦) */
  acquiredYear: number;
  /** 買付数量 */
  quantity: Decimal.Value;
  /** 買付時の取得費の合計額(付け替え前。実際に払った金額) */
  originalCostBasisJpy: Decimal.Value;
  /** 非課税期間最終年の最終営業日時点の1単位あたり終値(基準価額) */
  expiryClosingPriceJpy: Decimal.Value;
}

export interface OldNisaHoldingResult {
  symbol: string;
  nisaType: OldNisaType;
  acquiredYear: number;
  /** 非課税期間の最終年(この年の最終営業日終値で取得価額が付け替えられる) */
  expiryYear: number;
  /** 課税口座へ払い出される年(expiryYear + 1) */
  transferYear: number;
  quantity: Decimal;
  originalCostBasisJpy: Decimal;
  expiryClosingPriceJpy: Decimal;
  /** 付け替え後の新しい取得価額(quantity × expiryClosingPriceJpy) */
  newCostBasisJpy: Decimal;
  /** 非課税期間中に非課税のまま確定する含み益(マイナスの場合は切り捨てられる含み損) */
  untaxedGainJpy: Decimal;
  /** 投資年が旧NISAの制度上の投資可能期間内かどうか(範囲外でも計算は行う) */
  isAcquisitionYearInExpectedRange: boolean;
}

export interface OldNisaExpiryInput {
  holdings: OldNisaHoldingInput[];
}

export interface OldNisaExpiryResult {
  holdings: OldNisaHoldingResult[];
  totalOriginalCostBasisJpy: Decimal;
  totalNewCostBasisJpy: Decimal;
  /** 非課税のまま確定する含み益の合計(マイナスの銘柄も含めた単純合計) */
  totalUntaxedGainJpy: Decimal;
  /** 切り捨てられる含み損の合計(untaxedGainJpyが負の銘柄のみを合計した絶対値。参考値) */
  totalDisallowedLossJpy: Decimal;
  notes: string[];
}

function requireNonNegative(value: Decimal, label: string): void {
  if (value.isNegative()) {
    throw new Error(`${label}は0以上である必要があります`);
  }
}

/** 旧NISAの非課税期間の最終年(投資した年を1年目として計算)を返す */
export function calculateOldNisaExpiryYear(acquiredYear: number, nisaType: OldNisaType): number {
  if (!Number.isInteger(acquiredYear)) {
    throw new Error("買付年は整数で指定してください");
  }
  return acquiredYear + HOLDING_PERIOD_YEARS[nisaType] - 1;
}

export function estimateOldNisaExpiryTransfer(input: OldNisaExpiryInput): OldNisaExpiryResult {
  const holdings: OldNisaHoldingResult[] = input.holdings.map((h) => {
    const quantity = new Decimal(h.quantity);
    const originalCostBasisJpy = new Decimal(h.originalCostBasisJpy);
    const expiryClosingPriceJpy = new Decimal(h.expiryClosingPriceJpy);

    requireNonNegative(quantity, `買付数量(${h.symbol})`);
    requireNonNegative(originalCostBasisJpy, `取得費(${h.symbol})`);
    requireNonNegative(expiryClosingPriceJpy, `非課税期間最終年の終値(${h.symbol})`);

    const expiryYear = calculateOldNisaExpiryYear(h.acquiredYear, h.nisaType);
    const transferYear = expiryYear + 1;
    const newCostBasisJpy = quantity.times(expiryClosingPriceJpy);
    const untaxedGainJpy = newCostBasisJpy.minus(originalCostBasisJpy);
    const range = ACQUISITION_YEAR_RANGE[h.nisaType];
    const isAcquisitionYearInExpectedRange =
      h.acquiredYear >= range.min && h.acquiredYear <= range.max;

    return {
      symbol: h.symbol,
      nisaType: h.nisaType,
      acquiredYear: h.acquiredYear,
      expiryYear,
      transferYear,
      quantity,
      originalCostBasisJpy,
      expiryClosingPriceJpy,
      newCostBasisJpy,
      untaxedGainJpy,
      isAcquisitionYearInExpectedRange,
    };
  });

  const totalOriginalCostBasisJpy = holdings.reduce(
    (sum, h) => sum.plus(h.originalCostBasisJpy),
    new Decimal(0),
  );
  const totalNewCostBasisJpy = holdings.reduce(
    (sum, h) => sum.plus(h.newCostBasisJpy),
    new Decimal(0),
  );
  const totalUntaxedGainJpy = holdings.reduce(
    (sum, h) => sum.plus(h.untaxedGainJpy),
    new Decimal(0),
  );
  const totalDisallowedLossJpy = holdings.reduce(
    (sum, h) => (h.untaxedGainJpy.isNegative() ? sum.plus(h.untaxedGainJpy.abs()) : sum),
    new Decimal(0),
  );

  const notes: string[] = [
    "令和6年(2024年)からの新NISAへのロールオーバー(非課税期間終了時の翌年分非課税投資枠への持ち込み)は令和5年分をもって廃止された。旧NISA(一般NISA・つみたてNISA)で非課税期間終了までに売却しなかった残高は、翌年最初の営業日に課税口座(特定口座。開設していない場合は一般口座)へ自動的に払い出される。",
    "払い出し時の取得価額は、非課税期間最終年の最終営業日(通常12月30日)の終値(投資信託は基準価額)により新たに取得したものとみなして付け替えられる(措置法37条の14第7項・第16項)。実際の買付価額(originalCostBasisJpy)がいくらだったかに関わらず、この付け替え後の価額(newCostBasisJpy)が課税口座での新しい取得費になる。",
    "非課税期間中に値下がりしていた場合(untaxedGainJpyが負)、その値下がり損は非課税期間中の損失として切り捨てられ、他の譲渡益との損益通算や繰越控除の対象にできない。払い出し後に価格が回復しても、付け替え後の(低い)取得価額を基準に課税されるため、実質的に損益ゼロでも譲渡益として課税される場合がある点に注意すること。",
    "非課税期間最終年の最終営業日の終値は本ツールが自動取得しないため、ユーザー自身が保有先の証券会社の取引履歴・基準価額情報等で確認して入力すること。",
    "この試算結果(newCostBasisJpy)は、翌年分以後の課税口座での譲渡所得計算のため、/importの「期首残高(前年繰越残高)」セクションへそのまま登録することを想定している(この試算画面自体はDBへの登録機能を持たない)。",
    "ジュニアNISAは非課税期間・払出し時の取扱いが異なる別制度のため対象外。",
  ];

  return {
    holdings,
    totalOriginalCostBasisJpy,
    totalNewCostBasisJpy,
    totalUntaxedGainJpy,
    totalDisallowedLossJpy,
    notes,
  };
}
