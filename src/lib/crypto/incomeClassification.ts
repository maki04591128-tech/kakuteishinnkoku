import { Decimal } from "decimal.js";

/**
 * 暗号資産取引により生じた利益がどの所得区分になるかを判定する。
 *
 * 既存の暗号資産の損益計算(`calculator.ts`)・証拠金取引(`marginCalculator.ts`)・
 * 信用取引(`creditTrading.ts`)はいずれも所得区分を「雑所得」と決め打ちして
 * 集計しているが(機能122のREADMEでも「所得区分自体は問2-2の原則どおり雑所得となる」と
 * 記載しているとおり)、実際には国税庁「暗号資産等に関する税務上の取扱いについて
 * (FAQ)」問2-2「暗号資産取引の所得区分」(令和7年12月更新)により、収入金額の
 * 多寡・帳簿書類の保存の有無によって雑所得ではなく事業所得又は雑所得(業務に係る
 * 雑所得)に区分される場合があることが明記されている。この所得区分そのものの
 * 判定がコードベース・READMEのどこにも実装されていないギャップに対応する。
 *
 * FAQ問2-2本文(令和7年12月最終改訂版)により確認した判定基準:
 *
 * 1. 暗号資産取引により生じた利益は、所得税の課税対象になり、原則として雑所得
 *    (その他雑所得)に区分される。
 * 2. ただし、その年の暗号資産取引に係る収入金額が300万円を超える場合には、
 *    次のいずれかに区分される。
 *    - 暗号資産取引に係る帳簿書類の保存がある場合: 原則として事業所得
 *      (ただし、帳簿書類の保存があっても暗号資産取引に営利性が認められない
 *      場合などには、事業所得に該当するかどうかを個別に判断する)。
 *    - 暗号資産取引に係る帳簿書類の保存がない場合: 原則として雑所得(業務に
 *      係る雑所得)。
 * 3. なお、「暗号資産取引が事業所得等の基因となる行為に付随したものである
 *    場合」、例えば、事業所得者が事業用資産として暗号資産を保有し、棚卸資産等の
 *    購入の際の決済手段として暗号資産を使用した場合は、収入金額の多寡にかかわらず
 *    事業所得に区分される。
 *
 * 関係法令等: 所得税法27条・35条・36条、所得税基本通達35-1・35-2。
 *
 * この判定は「その年の暗号資産取引に係る収入金額」の合計を対象とする点に注意する。
 * ここでいう収入金額は、暗号資産の雑所得の金額(収入金額-必要経費)ではなく、
 * 売却対価・商品購入時の使用に伴う対価・暗号資産同士の交換における譲渡対価・
 * マイニング等により取得した時点の時価等を合計した総収入金額(必要経費控除前)を
 * 指す。既存の`estimateCryptoYearlyPnl`等が銘柄ごとに計算する`proceedsJpy`
 * (譲渡による収入)・`incomeJpy`(マイニング等の受取時収入)の全銘柄合計に相当する
 * 金額を、本モジュールでは`totalRevenueJpy`としてユーザー自身が集計して入力する
 * 前提とする(既存の損益計算モジュールを自動集計する統合は行わない)。
 */

export type CryptoIncomeCategory =
  | "BUSINESS_INCOME"
  | "MISCELLANEOUS_BUSINESS"
  | "MISCELLANEOUS_OTHER"
  | "NEEDS_INDIVIDUAL_JUDGMENT";

/** 事業所得と雑所得(業務に係る雑所得)の判定基準となる収入金額の閾値(300万円)。 */
export const CRYPTO_BUSINESS_INCOME_REVENUE_THRESHOLD_JPY = new Decimal(3_000_000);

export interface CryptoIncomeCategoryInput {
  /**
   * その年の暗号資産取引に係る収入金額の合計(必要経費控除前の総収入金額。
   * 売却対価・商品購入時の使用に伴う対価・暗号資産同士の交換における譲渡対価・
   * マイニング等の受取時の時価等の合計額)。
   */
  totalRevenueJpy: Decimal.Value;
  /**
   * 暗号資産取引が、既に営んでいる事業所得等を生ずべき業務に付随した行為で
   * あるかどうか(例: 事業所得者が事業用資産として暗号資産を保有し、棚卸資産等の
   * 購入の際の決済手段として暗号資産を使用した場合)。該当する場合は収入金額の
   * 多寡にかかわらず事業所得に区分される。
   */
  isIncidentalToExistingBusiness: boolean;
  /**
   * 暗号資産取引に係る帳簿書類(取引の年月日・数量・単価・相手方等を記録した
   * 帳簿及びこれに関する書類)の保存があるかどうか。収入金額が300万円を超える
   * 場合にのみ判定に用いる。
   */
  hasBookkeeping: boolean;
  /**
   * 収入金額が300万円を超え、かつ帳簿書類の保存がある場合に限り意味を持つ、
   * 暗号資産取引に営利性が認められるかどうかのユーザー自身の確認。省略時は
   * true(営利性が認められる)として扱う。falseを指定すると、事業所得に該当
   * するかどうかは個別に判断する必要がある(FAQ問2-2の(注))として
   * NEEDS_INDIVIDUAL_JUDGMENTを返す。
   */
  profitMotiveRecognized?: boolean;
}

export interface CryptoIncomeCategoryResult {
  category: CryptoIncomeCategory;
  /** 判定結果の日本語ラベル */
  categoryLabel: string;
  totalRevenueJpy: Decimal;
  /** 判定理由の説明文 */
  reason: string;
  notes: string[];
}

const CATEGORY_LABELS: Record<CryptoIncomeCategory, string> = {
  BUSINESS_INCOME: "事業所得",
  MISCELLANEOUS_BUSINESS: "雑所得(業務に係る雑所得)",
  MISCELLANEOUS_OTHER: "雑所得(その他雑所得)",
  NEEDS_INDIVIDUAL_JUDGMENT:
    "事業所得に該当するかどうかは個別判断(暫定的には雑所得(業務に係る雑所得)相当)",
};

function requireNonNegative(value: Decimal, label: string): void {
  if (value.isNegative()) {
    throw new Error(`${label}は0以上である必要があります`);
  }
}

export function determineCryptoIncomeCategory(
  input: CryptoIncomeCategoryInput,
): CryptoIncomeCategoryResult {
  const totalRevenueJpy = new Decimal(input.totalRevenueJpy);
  requireNonNegative(totalRevenueJpy, "暗号資産取引に係る収入金額");

  const notes: string[] = [
    "国税庁「暗号資産等に関する税務上の取扱いについて(FAQ)」問2-2「暗号資産取引の所得区分」(令和7年12月更新)・所得税法27条・35条・36条・所得税基本通達35-1・35-2に基づく判定。",
    "ここでいう収入金額は雑所得の金額(収入金額-必要経費)ではなく、売却対価・商品購入時の使用に伴う対価・暗号資産同士の交換における譲渡対価・マイニング等の受取時の時価等を合計した必要経費控除前の総収入金額であり、複数の取引所・ウォレットにまたがる暗号資産取引全体を合計した金額を入力すること。",
  ];
  const scopeNote =
    "事業所得又は雑所得(業務に係る雑所得)に区分される場合の所得金額の計算(帳簿に基づく実額計算・青色申告特別控除の適用・純損失又は雑所得の損失の繰越控除の可否・開業届出書等の提出手続)そのものは本ツールでは行わない(今後の課題)。既存の暗号資産の雑所得(その他雑所得)としての損益計算(`calculator.ts`等)は、この判定で雑所得(その他雑所得)に区分される場合の参考値としてそのまま利用できる。";

  if (input.isIncidentalToExistingBusiness) {
    notes.push(
      "暗号資産取引が既存の事業所得等を生ずべき業務に付随した行為(例: 事業用資産として保有する暗号資産を棚卸資産等の購入の決済手段として使用した場合)であるため、収入金額が300万円以下でも事業所得に区分される。",
      scopeNote,
    );
    return {
      category: "BUSINESS_INCOME",
      categoryLabel: CATEGORY_LABELS.BUSINESS_INCOME,
      totalRevenueJpy,
      reason:
        "暗号資産取引が事業所得等の基因となる行為に付随したものであるため、収入金額の多寡にかかわらず事業所得に区分される(FAQ問2-2なお書き)。",
      notes,
    };
  }

  if (totalRevenueJpy.lessThanOrEqualTo(CRYPTO_BUSINESS_INCOME_REVENUE_THRESHOLD_JPY)) {
    return {
      category: "MISCELLANEOUS_OTHER",
      categoryLabel: CATEGORY_LABELS.MISCELLANEOUS_OTHER,
      totalRevenueJpy,
      reason: `その年の暗号資産取引に係る収入金額(${totalRevenueJpy.toString()}円)が300万円以下のため、原則どおり雑所得(その他雑所得)に区分される。`,
      notes,
    };
  }

  // 収入金額が300万円を超える場合
  if (!input.hasBookkeeping) {
    notes.push(
      "収入金額が300万円を超えるものの暗号資産取引に係る帳簿書類の保存が無いため、雑所得(業務に係る雑所得)に区分される。",
      scopeNote,
    );
    return {
      category: "MISCELLANEOUS_BUSINESS",
      categoryLabel: CATEGORY_LABELS.MISCELLANEOUS_BUSINESS,
      totalRevenueJpy,
      reason:
        "収入金額が300万円を超えるものの、暗号資産取引に係る帳簿書類の保存が無いため、雑所得(業務に係る雑所得)に区分される。",
      notes,
    };
  }

  if (input.profitMotiveRecognized === false) {
    notes.push(
      "収入金額が300万円を超え帳簿書類の保存もあるが、暗号資産取引に営利性が認められない場合に該当するとユーザー自身が判断したため、事業所得に該当するかどうかは個別に判断する必要がある(FAQ問2-2の(注))。本ツールではこの判定を機械的に行わない。",
      scopeNote,
    );
    return {
      category: "NEEDS_INDIVIDUAL_JUDGMENT",
      categoryLabel: CATEGORY_LABELS.NEEDS_INDIVIDUAL_JUDGMENT,
      totalRevenueJpy,
      reason:
        "収入金額が300万円を超え帳簿書類の保存もあるが、営利性が認められない場合に該当するため、事業所得に区分されるかどうかは個別に判断する必要がある(FAQ問2-2の(注))。",
      notes,
    };
  }

  notes.push(
    "収入金額が300万円を超え、暗号資産取引に係る帳簿書類の保存もあるため、原則として事業所得に区分される。",
    scopeNote,
  );
  return {
    category: "BUSINESS_INCOME",
    categoryLabel: CATEGORY_LABELS.BUSINESS_INCOME,
    totalRevenueJpy,
    reason:
      "収入金額が300万円を超え、帳簿書類の保存もあるため、原則として事業所得に区分される(FAQ問2-2)。",
    notes,
  };
}
