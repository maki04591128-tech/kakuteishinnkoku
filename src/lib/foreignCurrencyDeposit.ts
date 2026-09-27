import { Decimal } from "decimal.js";

/**
 * 外貨預金の為替差損益に係る雑所得(総合課税)を試算する。
 *
 * 居住者が外貨建取引を行った場合、その円換算額はその取引を行った時における
 * 外国為替の売買相場(原則としてTTM(仲値)、継続適用を条件にTTB/TTSも可)により
 * 換算する(所得税法57条の3第1項)。外貨預金を円に払い戻した場合や、外貨預金を
 * 元手に他の資産を購入した場合には、預入時の円換算額と払出時の円換算額との差額
 * (為替差損益)が実現した所得として、その他の雑所得(総合課税)に算入される
 * (国税庁質疑応答事例「預け入れていた外貨建預貯金を払い出して貸付用の建物を
 * 購入した場合の為替差損益の取扱い」)。
 *
 * 一方、同一の外国通貨のまま他の金融機関の預金口座へ預け替える(元本部分をそのまま
 * 同一通貨で預け入れ直す)場合は、外貨の保有状態に実質的な変化が無く、所得税法57条の
 * 3第1項でいう外貨建取引そのものに該当しないため、為替差損益を認識する必要がない
 * (所得税法施行令167条の6第2項、国税庁質疑応答事例「外貨建預貯金の預入及び払出に
 * 係る為替差損益の取扱い」)。本ツールでは、このような同一通貨での預け替えは
 * そもそも払出(WITHDRAWAL)として入力しないことを前提とする(下記notes参照)。
 *
 * 複数回にわたって外貨を取得している場合の1単位あたりの取得価額(平均レート)は、
 * 譲渡所得の基因となる有価証券の取得費等に関する所得税法施行令118条1項の規定に
 * 準じて、その年の期首残高と年間の預入(取得)分を合算した総平均法に準ずる方法で
 * 計算する(前掲質疑応答事例で、複数回に分けて取得した外貨を使って資産を購入した
 * 場合の為替差損益の計算方法として明示されている)。暗号資産の総平均法
 * (`src/lib/crypto/calculator.ts`)と同様、通貨ごとに年間の預入・払出の順序に
 * よらず年間合計のみで平均レートが決まる。
 *
 * なお、外貨預金の利息そのものは為替差損益とは別の利子所得であり(国内の金融機関の
 * 預金であれば通常は源泉分離課税で申告不要、海外の金融機関の預金であれば総合課税の
 * 利子所得として別途申告が必要になり得る)、本ツールの対象は預入元本部分の為替差損益
 * のみで、利息額そのものは対象外(ユーザー自身の確認事項)。
 */

export type ForeignCurrencyDepositEventType = "DEPOSIT" | "WITHDRAWAL";

export interface ForeignCurrencyDepositEvent {
  type: ForeignCurrencyDepositEventType;
  /** 外貨建ての数量(その通貨単位。例: USD建てなら米ドル数量) */
  amount: Decimal.Value;
  /**
   * 円換算レート(その外貨1単位あたりの円換算額)。DEPOSITは預入(取得)時のレート、
   * WITHDRAWALは払出(円への交換、又は他の資産の購入等への充当)時のレート。
   */
  exchangeRateJpy: Decimal.Value;
}

export interface ForeignCurrencyOpeningBalance {
  /** 前年末時点の保有数量(その通貨単位) */
  amount: Decimal.Value;
  /** 前年末時点の取得価額の合計(単価ではなく円換算総額) */
  costBasisJpy: Decimal.Value;
}

export interface ForeignCurrencyDepositCurrencyResult {
  currency: string;
  openingAmount: Decimal;
  openingCostJpy: Decimal;
  depositedAmount: Decimal;
  depositedCostJpy: Decimal;
  /** その年の平均取得レート(1単位あたりの円換算額) */
  averageRateJpy: Decimal;
  withdrawnAmount: Decimal;
  /** 払出(円換算)の合計額 */
  proceedsJpy: Decimal;
  /** 払出数量に対応する取得原価(=平均レート×払出数量) */
  costOfWithdrawnJpy: Decimal;
  /** 雑所得に算入する為替差損益(proceedsJpy - costOfWithdrawnJpy) */
  realizedGainJpy: Decimal;
  closingAmount: Decimal;
  closingCostJpy: Decimal;
}

export interface ForeignCurrencyDepositPortfolioResult {
  byCurrency: ForeignCurrencyDepositCurrencyResult[];
  /** 全通貨合計の雑所得金額(為替差損益) */
  totalRealizedGainJpy: Decimal;
  notes: string[];
}

function toDecimal(value: Decimal.Value): Decimal {
  return new Decimal(value);
}

function requireNonNegative(value: Decimal, label: string, currency: string): void {
  if (value.isNegative()) {
    throw new Error(`${label}は0以上である必要があります (currency=${currency})`);
  }
}

/**
 * 単一通貨の1年分の預入・払出から為替差損益を計算する(総平均法に準ずる方法)。
 * events の順序は結果に影響しない(年間合計のみで平均レートが決まるため)。
 */
export function calculateForeignCurrencyDepositYear(
  currency: string,
  events: ForeignCurrencyDepositEvent[],
  opening?: ForeignCurrencyOpeningBalance,
): ForeignCurrencyDepositCurrencyResult {
  const openingAmount = opening ? toDecimal(opening.amount) : new Decimal(0);
  const openingCostJpy = opening ? toDecimal(opening.costBasisJpy) : new Decimal(0);

  if (openingAmount.isNegative() || openingCostJpy.isNegative()) {
    throw new Error(`期首残高の数量・取得価額は0以上である必要があります (currency=${currency})`);
  }

  let depositedAmount = new Decimal(0);
  let depositedCostJpy = new Decimal(0);
  let withdrawnAmount = new Decimal(0);
  let proceedsJpy = new Decimal(0);

  for (const event of events) {
    const amount = toDecimal(event.amount);
    const rate = toDecimal(event.exchangeRateJpy);

    if (amount.isNegative() || amount.isZero()) {
      throw new Error(`数量は正の値である必要があります (currency=${currency})`);
    }
    requireNonNegative(rate, "円換算レート", currency);

    if (event.type === "DEPOSIT") {
      depositedAmount = depositedAmount.plus(amount);
      depositedCostJpy = depositedCostJpy.plus(amount.times(rate));
    } else if (event.type === "WITHDRAWAL") {
      withdrawnAmount = withdrawnAmount.plus(amount);
      proceedsJpy = proceedsJpy.plus(amount.times(rate));
    } else {
      throw new Error(`未対応の取引種別です: ${event.type as string}`);
    }
  }

  const totalAmount = openingAmount.plus(depositedAmount);
  const totalCostJpy = openingCostJpy.plus(depositedCostJpy);
  const averageRateJpy = totalAmount.isZero() ? new Decimal(0) : totalCostJpy.dividedBy(totalAmount);

  if (withdrawnAmount.greaterThan(totalAmount)) {
    throw new Error(
      `期首保有数量+年間預入数量(${totalAmount.toString()})を超える数量(${withdrawnAmount.toString()})が払い出されています (currency=${currency})`,
    );
  }

  const costOfWithdrawnJpy = averageRateJpy.times(withdrawnAmount);
  const realizedGainJpy = proceedsJpy.minus(costOfWithdrawnJpy);

  const closingAmount = totalAmount.minus(withdrawnAmount);
  const closingCostJpy = averageRateJpy.times(closingAmount);

  return {
    currency,
    openingAmount,
    openingCostJpy,
    depositedAmount,
    depositedCostJpy,
    averageRateJpy,
    withdrawnAmount,
    proceedsJpy,
    costOfWithdrawnJpy,
    realizedGainJpy,
    closingAmount,
    closingCostJpy,
  };
}

/**
 * 複数通貨が混在したイベント一覧を通貨別に集計し、全体の雑所得合計を計算する。
 */
export function calculateForeignCurrencyDepositPortfolioYear(
  events: (ForeignCurrencyDepositEvent & { currency: string })[],
  openings?: Record<string, ForeignCurrencyOpeningBalance>,
): ForeignCurrencyDepositPortfolioResult {
  const eventsByCurrency = new Map<string, ForeignCurrencyDepositEvent[]>();
  for (const event of events) {
    const list = eventsByCurrency.get(event.currency) ?? [];
    list.push(event);
    eventsByCurrency.set(event.currency, list);
  }

  if (openings) {
    for (const currency of Object.keys(openings)) {
      if (!eventsByCurrency.has(currency)) {
        eventsByCurrency.set(currency, []);
      }
    }
  }

  const byCurrency = Array.from(eventsByCurrency.entries())
    .map(([currency, currencyEvents]) =>
      calculateForeignCurrencyDepositYear(currency, currencyEvents, openings?.[currency]),
    )
    .sort((a, b) => a.currency.localeCompare(b.currency));

  const totalRealizedGainJpy = byCurrency.reduce(
    (sum, result) => sum.plus(result.realizedGainJpy),
    new Decimal(0),
  );

  const notes: string[] = [
    "所得税法57条の3第1項・国税庁質疑応答事例「預け入れていた外貨建預貯金を払い出して貸付用の建物を購入した場合の為替差損益の取扱い」に基づく概算値。外貨預金を円に払い戻した場合だけでなく、外貨預金を元手に外貨建ての他の資産を購入した場合等、外貨を対価として何らかの経済的価値を取得した時点で為替差損益を所得として認識する必要がある。",
    "複数回に分けて外貨を取得している場合の平均取得レートは、所得税法施行令118条1項(譲渡所得の基因となる有価証券の取得費等)の規定に準じ、期首残高と年間の預入(取得)分を合算した総平均法に準ずる方法で計算する(暗号資産の総平均法と同じ考え方)。",
    "同一の外国通貨のまま他の金融機関の預金口座へ預け替えるだけの場合は、外貨の保有状態に実質的な変化が無く外貨建取引に該当しないため、為替差損益を認識しない(所得税法施行令167条の6第2項、国税庁質疑応答事例「外貨建預貯金の預入及び払出に係る為替差損益の取扱い」)。このような同一通貨での預け替えはWITHDRAWALとして入力しないこと(入力すると誤って為替差損益が発生した扱いになってしまう)。",
    "円換算レートは原則としてTTM(電信売買相場の仲値)を用いるが、継続適用を条件にTTS(預入時。円→外貨)・TTB(払出時。外貨→円)を用いることも認められる(所得税基本通達57の3関係)。いずれかを継続して用いること。",
    "外貨預金の利息(利子所得)は本ツールの対象外。国内の金融機関の預金であれば通常は源泉分離課税(20.315%)で確定申告不要、海外の金融機関の預金利息は総合課税の利子所得として別途申告が必要になり得るため、ユーザー自身で別途確認すること。",
    "計算結果(realizedGainJpy)は、雑所得として他の総合課税所得と合算した後の金額として`/tax-estimate`の「給与所得等の課税所得金額」へ手入力で反映すること。一時所得・総合課税の譲渡所得等と同様、所得区分そのものの計算のためDBへの登録機能は持たない単体の試算画面。",
    "各金額は円未満の端数を切り捨てずDecimalの計算結果をそのまま返す概算値。",
  ];

  return { byCurrency, totalRealizedGainJpy, notes };
}
