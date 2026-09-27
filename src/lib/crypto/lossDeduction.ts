import { Decimal } from "decimal.js";

/**
 * 暗号資産(仮想通貨)が盗難・詐欺等により消失した場合の所得税の取扱いを試算する。
 *
 * NFTが消失した場合の雑損控除・必要経費の試算(機能128。`nftLossDeduction.ts`)は
 * 国税庁「NFTに関する税務上の取扱いについて(FAQ)」問5という専用の一次情報に
 * 基づいていたが、暗号資産そのものの盗難・詐欺による消失については、暗号資産の
 * 主要な一次情報である国税庁「暗号資産等に関する税務上の取扱いについて(FAQ)」
 * (令和7年12月改訂版)の目次を確認したところ専用の設問が無く、一般規定である
 * 所得税法72条(雑損控除)・51条4項(資産損失の必要経費算入)そのものと、
 * 令和4年4月19日の参議院財政金融委員会における国税庁次長答弁(暗号資産が詐欺に
 * よりだまし取られた場合の取扱いについての答弁)が一次情報になる。
 *
 * e-Gov法令検索で条文本文を確認したところ、次の条文構造だった。
 *
 *  - 所得税法72条1項(雑損控除): 対象となる損失の原因を「災害又は盗難若しくは
 *    横領」に限定しており、詐欺・恐喝はここに含まれない(答弁でも「雑損控除に
 *    つきましては、災害又は盗難若しくは横領により生じた損失を対象としております
 *    ので、この詐欺というのはそこには入っていない」旨が明言されている)。
 *  - 所得税法51条4項(資産損失の必要経費算入): 「雑所得を生ずべき業務の用に
 *    供され又はこれらの所得の基因となる資産」の損失の金額を、保険金等で補填
 *    される部分・資産の譲渡により生じたもの・第72条1項(雑損控除)に規定する
 *    もの(=盗難・横領・災害によるもの)を除き、その年分の雑所得の金額(この
 *    規定を適用しないで計算した金額)を限度として必要経費に算入できる。同項は
 *    第1項と異なり損失の原因を「その他の事由」等で限定しておらず、盗難・横領・
 *    災害以外の原因(詐欺・恐喝等)による損失も除外されていないため、暗号資産の
 *    売却等により雑所得を得ている場合、その暗号資産が詐欺により消失した損失は
 *    72条1項の対象外である一方、51条4項により雑所得の必要経費に算入できる
 *    (国税庁次長答弁も同旨)。
 *
 * NFTの場合(機能128)と同様、次の2区分は雑損控除・必要経費算入いずれの対象にも
 * ならない。
 *  - 生活に通常必要でない資産(所得税法施行令178条。競走馬・主として趣味/娯楽/
 *    保養目的で所有する動産等)に該当する場合(72条1項・51条4項のいずれも
 *    62条1項に規定する資産を対象から除外している)。ただし暗号資産は同条が
 *    想定する動産(競走馬・貴金属・美術品等)とは性質が異なり、通常の投資目的で
 *    保有する暗号資産がこの区分に該当することは想定しにくい(NFTのように趣味/
 *    収集目的の色彩が強い場合とは異なる)。
 *  - 消失の原因が客観的に証明できない場合(盗難であれば被害届の受理、詐欺であれば
 *    刑事告訴・民事訴訟の記録等の裏付けが無いもの)。単に秘密鍵を紛失した(第三者の
 *    関与が確認できない)場合等、原因が盗難・横領・詐欺・恐喝のいずれにも
 *    特定できないケースは、本ツールでは判定せず対象外として扱う(今後の課題)。
 *
 * 事業用資産等(棚卸資産又は業務の用に供される資産)に該当する場合は、原因を
 * 問わず所得税法51条1項・2項により事業所得等の必要経費に算入する(NFTの場合の
 * 機能128と同じ整理)。
 *
 * 必要経費算入額(51条4項)は「その年分の雑所得の金額(この規定を適用しないで
 * 計算した金額)を限度」とする条文上の制約があるため、`otherMiscellaneousIncomeJpy`
 * (この損失を計算に入れる前の、暗号資産の雑所得を含むその年分の雑所得の金額の
 * 合計額)を渡すとその金額で頭打ちにする(未指定の場合は頭打ちをせず、案内のみ
 * 行う簡略化)。
 */

export type CryptoLossCause = "THEFT_OR_EMBEZZLEMENT" | "FRAUD_OR_EXTORTION" | "OTHER";

export type CryptoLossTreatment =
  | "MISCELLANEOUS_LOSS_DEDUCTION"
  | "NECESSARY_EXPENSE"
  | "NOT_DEDUCTIBLE";

export interface CryptoLossInput {
  /** 消失した暗号資産の取得価額(総平均法・移動平均法による取得費) */
  acquisitionCostJpy: Decimal.Value;
  /**
   * 消失時点の時価。不明な場合は入力不要(未入力またはnullの場合は取得価額を
   * 時価とみなす)。
   */
  fairValueAtLossJpy?: Decimal.Value | null;
  /**
   * 事業用資産等(棚卸資産又は業務の用に供される資産)に該当するか。該当する
   * 場合は原因を問わず所得税法51条1項・2項により必要経費算入の対象となる。
   */
  isBusinessAsset: boolean;
  /**
   * 事業用資産等に該当する場合の帳簿価額。未入力またはnullの場合は取得価額を
   * そのまま帳簿価額とみなす。
   */
  bookValueJpy?: Decimal.Value | null;
  /**
   * 生活に通常必要でない資産(所得税法施行令178条)に該当するか。通常の投資
   * 目的の暗号資産では該当しないことが多いが、念のため入力できるようにした。
   * 事業用資産等に該当する場合はこの判定は用いない(必要経費算入が優先する)。
   */
  isPersonalUseAsset: boolean;
  /**
   * 消失の原因区分。
   *  - THEFT_OR_EMBEZZLEMENT: 盗難・横領(取引所や自己のウォレットからの
   *    不正な送出等)。所得税法72条1項により雑損控除の対象。
   *  - FRAUD_OR_EXTORTION: 詐欺・恐喝(いわゆる投資詐欺等でだまし取られた場合)。
   *    72条1項の対象外だが、51条4項により雑所得の必要経費算入の対象。
   *  - OTHER: 原因が客観的に特定できない場合、または上記いずれにも該当しない
   *    場合(単なる秘密鍵の紛失等)。雑損控除・必要経費算入のいずれの対象にも
   *    ならない(今後の課題)。
   */
  lossCause: CryptoLossCause;
  /**
   * 必要経費算入額(FRAUD_OR_EXTORTIONの場合)の頭打ちに使う、この損失を計算に
   * 入れる前のその年分の雑所得の金額の合計額(所得税法51条4項)。未指定の場合は
   * 頭打ちをせず案内のみ行う。
   */
  otherMiscellaneousIncomeJpy?: Decimal.Value | null;
}

export interface CryptoLossResult {
  /** この試算が適用したと判定した取扱い */
  treatment: CryptoLossTreatment;
  /**
   * 雑損控除の損失額として`/casualty-loss-deduction`の損害金額に入力する金額
   * (treatmentがMISCELLANEOUS_LOSS_DEDUCTIONの場合のみ非null)。
   */
  casualtyLossAmountJpy: Decimal | null;
  /**
   * 事業所得又は雑所得の必要経費に算入する金額(treatmentがNECESSARY_EXPENSEの
   * 場合のみ非null。otherMiscellaneousIncomeJpyを指定した場合はその金額で
   * 頭打ちした後の金額)。
   */
  necessaryExpenseJpy: Decimal | null;
  notes: string[];
}

function requireNonNegative(value: Decimal, label: string): void {
  if (value.isNegative()) {
    throw new Error(`${label}は0以上である必要があります`);
  }
}

export function estimateCryptoLossDeduction(input: CryptoLossInput): CryptoLossResult {
  const acquisitionCostJpy = new Decimal(input.acquisitionCostJpy);
  requireNonNegative(acquisitionCostJpy, "取得価額");

  const fairValueAtLossJpy =
    input.fairValueAtLossJpy === undefined || input.fairValueAtLossJpy === null
      ? null
      : new Decimal(input.fairValueAtLossJpy);
  if (fairValueAtLossJpy !== null) {
    requireNonNegative(fairValueAtLossJpy, "消失時点の時価");
  }

  const bookValueJpy =
    input.bookValueJpy === undefined || input.bookValueJpy === null
      ? null
      : new Decimal(input.bookValueJpy);
  if (bookValueJpy !== null) {
    requireNonNegative(bookValueJpy, "帳簿価額");
  }

  const otherMiscellaneousIncomeJpy =
    input.otherMiscellaneousIncomeJpy === undefined ||
    input.otherMiscellaneousIncomeJpy === null
      ? null
      : new Decimal(input.otherMiscellaneousIncomeJpy);
  if (otherMiscellaneousIncomeJpy !== null) {
    requireNonNegative(otherMiscellaneousIncomeJpy, "この損失計算前の雑所得の金額");
  }

  const notes: string[] = [
    "所得税法72条1項(雑損控除)・51条4項(資産損失の必要経費算入)、令和4年4月19日の参議院財政金融委員会における国税庁次長答弁に基づく概算値(暗号資産の盗難・詐欺による損失を直接対象とした国税庁FAQの設問は無い)。",
    "生活に通常必要でない資産(所得税法施行令178条)や事業用資産等(棚卸資産又は業務の用に供される資産)に該当するかどうかは自身で確認すること。",
    "盗難・横領は被害届の受理証明書等、詐欺・恐喝は告訴状の受理・判決等、消失の原因を客観的に証明できる資料を保管しておくこと。",
  ];

  if (input.isBusinessAsset) {
    const necessaryExpenseJpy = bookValueJpy ?? acquisitionCostJpy;
    notes.push(
      "事業用資産等に該当するため、原因を問わずこの損失は事業所得又は雑所得の金額の計算上、必要経費に算入する(所得税法51条1項・2項。必要経費算入額はその暗号資産の帳簿価額。未入力の場合は取得価額をそのまま帳簿価額とみなした)。",
    );
    return {
      treatment: "NECESSARY_EXPENSE",
      casualtyLossAmountJpy: null,
      necessaryExpenseJpy,
      notes,
    };
  }

  if (input.isPersonalUseAsset) {
    notes.push(
      "生活に通常必要でない資産に該当するため、雑損控除・必要経費算入のいずれの対象にもならない(所得税法72条1項・51条4項はいずれも生活に通常必要でない資産(所得税法施行令178条)を対象から除外している)。通常の投資目的の暗号資産がこの区分に該当することは想定しにくいため、この判定を選んだ理由を自身で確認すること。",
    );
    return {
      treatment: "NOT_DEDUCTIBLE",
      casualtyLossAmountJpy: null,
      necessaryExpenseJpy: null,
      notes,
    };
  }

  if (input.lossCause === "THEFT_OR_EMBEZZLEMENT") {
    const casualtyLossAmountJpy = fairValueAtLossJpy ?? acquisitionCostJpy;
    notes.push(
      "盗難・横領による消失は所得税法72条1項の雑損控除の対象となる。損失の額は消失時点の時価(不明な場合は取得価額)とし、この金額を/casualty-loss-deductionの損害金額に入力すること(控除額そのものの計算(総所得金額等による足切り等)は同画面で行う)。",
    );
    return {
      treatment: "MISCELLANEOUS_LOSS_DEDUCTION",
      casualtyLossAmountJpy,
      necessaryExpenseJpy: null,
      notes,
    };
  }

  if (input.lossCause === "FRAUD_OR_EXTORTION") {
    const rawNecessaryExpenseJpy = bookValueJpy ?? acquisitionCostJpy;
    const necessaryExpenseJpy =
      otherMiscellaneousIncomeJpy !== null
        ? Decimal.min(rawNecessaryExpenseJpy, otherMiscellaneousIncomeJpy)
        : rawNecessaryExpenseJpy;
    notes.push(
      "詐欺・恐喝による消失は所得税法72条1項の雑損控除の対象外だが(令和4年4月19日参議院財政金融委員会における国税庁次長答弁)、暗号資産が雑所得の基因となる資産に該当する場合、同法51条4項によりその年分の雑所得の金額を限度として必要経費に算入できる。",
    );
    if (otherMiscellaneousIncomeJpy !== null && rawNecessaryExpenseJpy.greaterThan(necessaryExpenseJpy)) {
      notes.push(
        `必要経費算入額は取得価額(${rawNecessaryExpenseJpy.toString()}円)ではなく、頭打ちとなるこの損失計算前の雑所得の金額(${otherMiscellaneousIncomeJpy.toString()}円)とした。`,
      );
    } else if (otherMiscellaneousIncomeJpy === null) {
      notes.push(
        "必要経費算入額はその年分の雑所得の金額(この損失を計算に入れる前の金額)を限度とする条文上の制約があるが、その年分の雑所得の金額を指定していないため頭打ちの計算はしていない。他の雑所得と合算した金額がこの必要経費算入額を下回らないか確認すること。",
      );
    }
    return {
      treatment: "NECESSARY_EXPENSE",
      casualtyLossAmountJpy: null,
      necessaryExpenseJpy,
      notes,
    };
  }

  notes.push(
    "消失の原因が盗難・横領・詐欺・恐喝のいずれにも特定できない場合(単なる秘密鍵の紛失等)は、本ツールでは雑損控除・必要経費算入のいずれの対象にもならないものとして扱う(今後の課題)。",
  );
  return {
    treatment: "NOT_DEDUCTIBLE",
    casualtyLossAmountJpy: null,
    necessaryExpenseJpy: null,
    notes,
  };
}
