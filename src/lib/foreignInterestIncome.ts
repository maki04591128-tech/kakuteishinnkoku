import { Decimal } from "decimal.js";

/**
 * 海外の金融機関に預け入れた預金等から生じる利子所得(総合課税)を試算する。
 *
 * 国内の金融機関の預貯金の利子は、租税特別措置法3条1項により「国内において
 * 支払を受けるべき」利子等として一律15.315%(所得税)+5%(住民税)の源泉分離課税
 * (源泉徴収のみで課税関係が終了し、確定申告の対象外)となる。しかし、海外の
 * 金融機関に預け入れた預金の利子は、日本国内の支払者(源泉徴収義務者)を経由せず
 * 海外で直接支払われるため、この「国内において支払を受けるべき」という要件を
 * 満たさず、措置法3条1項の源泉分離課税の対象外となる(国税庁タックスアンサー
 * No.1310「利息を受け取ったとき(利子所得)」も、源泉分離課税の対象外となる例外を
 * 挙げているが、いずれも国内の支払者を前提とした規定であることに変わりはない)。
 *
 * 源泉分離課税の対象外である以上、利子所得の原則的な取扱いである総合課税
 * (所得税法21条・89条。他の給与所得等と合算し超過累進税率を適用)に戻り、
 * 確定申告が必要になる(国内の金融機関を通さず海外の金融機関へ直接預け入れた
 * 預金の利子は、日本の金融機関を経由しないため源泉徴収自体が行われないことも
 * 確定申告が必要になる理由の一つ)。
 *
 * 利子所得の金額は、暗号資産の雑所得等と異なり必要経費の控除が一切認められず、
 * 収入金額(円換算後)がそのまま所得金額になる(所得税法23条2項)。円換算は、
 * その利子を受け取った時における外国為替の売買相場(原則TTM(仲値)、継続適用を
 * 条件にTTB/TTSも可。所得税法57条の3第1項、所得税基本通達57の3関係)による。
 * 複数回受け取る利息は、それぞれ受取時点のレートで換算して単純に合計すればよく、
 * `src/lib/foreignCurrencyDeposit.ts`(預入元本の為替差損益)のような複数回取得時の
 * 平均レート計算は不要(利息はその都度新たに生じる収入であり、為替差損益のように
 * 既存の保有元本と合算した取得費を管理する必要が無いため)。
 */

export interface ForeignInterestReceipt {
  /** 通貨コード(例: USD) */
  currency: string;
  /** 受け取った利息の外貨額 */
  amountForeignCurrency: Decimal.Value;
  /** 受取時点の円換算レート(その外貨1単位あたりの円換算額。原則TTM) */
  exchangeRateJpy: Decimal.Value;
  /** 現地で源泉徴収された外国所得税額(円換算。無い場合は0) */
  foreignTaxWithheldJpy?: Decimal.Value;
}

export interface ForeignInterestIncomeCurrencyResult {
  currency: string;
  receiptCount: number;
  totalAmountForeignCurrency: Decimal;
  interestIncomeJpy: Decimal;
  foreignTaxWithheldJpy: Decimal;
}

export interface ForeignInterestIncomeResult {
  byCurrency: ForeignInterestIncomeCurrencyResult[];
  /** 利子所得の金額の合計(必要経費の控除なし。総合課税の対象) */
  totalInterestIncomeJpy: Decimal;
  /** 外国税額控除の対象になり得る外国所得税額の合計 */
  totalForeignTaxWithheldJpy: Decimal;
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

export function estimateForeignInterestIncome(
  receipts: ForeignInterestReceipt[],
): ForeignInterestIncomeResult {
  const byCurrency = new Map<string, ForeignInterestIncomeCurrencyResult>();

  for (const receipt of receipts) {
    const currency = receipt.currency.trim();
    if (!currency) {
      throw new Error("通貨は必須です");
    }
    const amount = toDecimal(receipt.amountForeignCurrency);
    const rate = toDecimal(receipt.exchangeRateJpy);
    const foreignTaxWithheldJpy = receipt.foreignTaxWithheldJpy
      ? toDecimal(receipt.foreignTaxWithheldJpy)
      : new Decimal(0);

    if (amount.isNegative() || amount.isZero()) {
      throw new Error(`受取利息額は正の値である必要があります (currency=${currency})`);
    }
    requireNonNegative(rate, "円換算レート");
    requireNonNegative(foreignTaxWithheldJpy, "外国所得税額");

    const existing = byCurrency.get(currency);
    const interestIncomeJpy = amount.times(rate);
    if (existing) {
      existing.receiptCount += 1;
      existing.totalAmountForeignCurrency = existing.totalAmountForeignCurrency.plus(amount);
      existing.interestIncomeJpy = existing.interestIncomeJpy.plus(interestIncomeJpy);
      existing.foreignTaxWithheldJpy = existing.foreignTaxWithheldJpy.plus(foreignTaxWithheldJpy);
    } else {
      byCurrency.set(currency, {
        currency,
        receiptCount: 1,
        totalAmountForeignCurrency: amount,
        interestIncomeJpy,
        foreignTaxWithheldJpy,
      });
    }
  }

  const results = Array.from(byCurrency.values()).sort((a, b) =>
    a.currency.localeCompare(b.currency),
  );

  const totalInterestIncomeJpy = results.reduce(
    (sum, r) => sum.plus(r.interestIncomeJpy),
    new Decimal(0),
  );
  const totalForeignTaxWithheldJpy = results.reduce(
    (sum, r) => sum.plus(r.foreignTaxWithheldJpy),
    new Decimal(0),
  );

  const notes: string[] = [
    "国内の金融機関の預金利子は租税特別措置法3条1項により源泉分離課税(源泉徴収のみで課税関係が終了し確定申告不要)だが、この規定は「国内において支払を受けるべき」利子等に限られるため、海外の金融機関へ直接預け入れた預金の利子は対象外となり、原則である総合課税(所得税法21条・89条)に戻る。",
    "利子所得の金額は、必要経費の控除が一切認められず(所得税法23条2項)、円換算後の収入金額そのものが所得金額になる。",
    "円換算レートは、その利息を受け取った時における外国為替の売買相場(原則TTM(仲値)、継続適用を条件にTTB/TTSも可。所得税法57条の3第1項)を用いる。複数回受け取る利息はそれぞれ受取時点のレートで換算してから合計する(為替差損益のような平均取得レートの計算は不要)。",
    "現地で源泉徴収された外国所得税額がある場合、二重課税を調整する外国税額控除の対象になり得る(所得税法95条)。控除額の試算は`/foreign-tax-credit`で行うこと(国外所得金額・外国所得税額はいずれも手入力で反映する。同ページの自動集計値は国外源泉の配当等・株式等の譲渡益のみが対象で、利子所得は含まれないため上書きが必要)。",
    "給与所得者で、給与所得以外の所得(この利子所得を含む)の合計が年間20万円以下の場合は確定申告不要となる制度があるが、医療費控除等の理由で別途確定申告する場合はこの利子所得も含めて申告する必要がある。",
    "この試算結果(totalInterestIncomeJpy)は、他の総合課税所得と合算した後の金額として`/tax-estimate`の「給与所得等の課税所得金額」へ手入力で反映すること。一時所得・総合課税の譲渡所得・外貨預金の為替差損益と同様、所得区分そのものの計算のためDBへの登録機能は持たない単体の試算画面。",
    "各金額は円未満の端数を切り捨てずDecimalの計算結果をそのまま返す概算値。",
  ];

  return {
    byCurrency: results,
    totalInterestIncomeJpy,
    totalForeignTaxWithheldJpy,
    notes,
  };
}
