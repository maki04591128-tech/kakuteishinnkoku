import { Decimal } from "decimal.js";

/**
 * ブロックチェーンゲームの報酬として取得したゲーム内通貨(トークン)に係る
 * 雑所得の金額を試算する。国税庁「NFTに関する税務上の取扱いについて(FAQ)」
 * (令和5年1月13日、課税総括課情報等第1号)の問8「ブロックチェーンゲームの
 * 報酬としてゲーム内通貨を取得した場合」に基づく。機能125(NFT一次流通の雑所得)
 * が「今後の課題」として明記していた対象外項目のうち、優先度が高いとしていたもの。
 *
 * FAQ問8は次の2つの評価方法を認めている。
 *
 * 【原則法】(valuationMethod: "PRINCIPLE")
 *   ゲーム内通貨(トークン)を取得する都度、その取得時における価額(時価)に
 *   相当する金額を収入計上する。取得の都度の時価評価を行うため、取得の
 *   記録(数量・単価)をそのまま合算すればよい。
 *     雑所得の金額 = Σ(取得数量 × 取得時の1トークンあたりの時価)
 *
 * 【簡便法】(valuationMethod: "SIMPLIFIED")
 *   ゲーム内通貨(トークン)の取得や使用が頻繁で取得の都度の評価が煩雑な場合、
 *   年末に一括で評価する方法が認められている。
 *     ゲーム内通貨ベースの所得金額
 *       = その年の12/31保有するゲーム内通貨の総額 - その年の1/1保有するゲーム内通貨の総額
 *         - その年に購入したゲーム内通貨の総額
 *     雑所得の金額 = ゲーム内通貨ベースの所得金額 × 年末の暗号資産への換算レート
 *
 * ゲーム内通貨(トークン)が暗号資産と交換できないなどの理由で時価の算定が
 * 困難な場合には、簡便法の雑所得の金額は0円として差し支えない。ただし、年の中途で
 * 暗号資産に交換したゲーム内通貨(トークン)がある場合には、その交換により取得した
 * 暗号資産の価額を雑所得の金額に加算する(交換時点で時価が確定するため)。この
 * 取扱いは簡便法固有のもので、原則法では取得時点で既に収入計上済みのため
 * 別途の加算は不要(交換により取得した暗号資産の取得価額は、交換時点の時価が
 * そのまま引き継がれる。以後の暗号資産としての損益計算は`src/lib/crypto/`を使うこと)。
 *
 * 上記とは別に、ゲーム内通貨(トークン)がゲーム内でしか使用できない(ゲーム内の
 * 資産以外の資産と交換できない)場合には、そもそも所得税の課税対象とならない
 * (FAQ問8本文)。この場合、トークンの種類ごとにisGameOnlyTokenをtrueにすることで
 * 対象外として扱う(評価方法によらず常に雑所得の金額は0円になる)。
 */

export type BlockchainGameValuationMethod = "PRINCIPLE" | "SIMPLIFIED";

export interface BlockchainGamePrincipleReceipt {
  /** 取得したゲーム内通貨(トークン)の数量 */
  quantity: Decimal.Value;
  /** 取得時における1トークンあたりの時価(円換算) */
  unitPriceJpy: Decimal.Value;
}

export interface BlockchainGameTokenItem {
  /** ゲーム名・トークン名等(任意の説明ラベル) */
  description: string;
  /**
   * ゲーム内でしか使用できない(ゲーム内の資産以外の資産と交換できない)場合はtrue。
   * この場合、そもそも所得税の課税対象とならない(FAQ問8本文)ため雑所得の金額は0円。
   */
  isGameOnlyToken: boolean;
  /**
   * 収入計上の方法。PRINCIPLE(原則法。取得の都度時価評価)が原則だが、取得・使用が
   * 頻繁で都度の評価が煩雑な場合はSIMPLIFIED(簡便法。年末一括評価)を選択できる。
   */
  valuationMethod: BlockchainGameValuationMethod;
  /** PRINCIPLE専用。その年中に取得したゲーム内通貨(トークン)の一覧(取得の都度の記録)。 */
  principleReceipts: BlockchainGamePrincipleReceipt[];
  /** SIMPLIFIED専用。その年の1月1日に所有するゲーム内通貨(トークン)の総額(トークン単位の数量) */
  openingBalance: Decimal.Value;
  /** SIMPLIFIED専用。その年の12月31日に所有するゲーム内通貨(トークン)の総額(トークン単位の数量) */
  closingBalance: Decimal.Value;
  /** SIMPLIFIED専用。その年に購入したゲーム内通貨(トークン)の総額(トークン単位の数量) */
  purchasedAmount: Decimal.Value;
  /**
   * SIMPLIFIED専用。年末時点でこのトークンの時価(暗号資産への換算レート)を
   * 算定できる場合はtrue。falseの場合(暗号資産と直接交換できない等、時価の
   * 算定が困難な場合)、年末一括評価分の雑所得の金額は0円として扱う(FAQ問8【簡便法】)。
   */
  hasYearEndMarketValue: boolean;
  /**
   * SIMPLIFIED専用。1トークンあたりの年末の暗号資産への換算レート(円換算後)。
   * hasYearEndMarketValueがfalseの場合は無視される。
   */
  yearEndRateJpy: Decimal.Value;
  /**
   * SIMPLIFIED専用。年の中途で、暗号資産と交換できる他のトークンに交換したゲーム内
   * 通貨がある場合、その交換により取得した暗号資産(又は他のトークン)の時価
   * (円換算額)の合計。hasYearEndMarketValueがfalseの場合でも、年末一括評価とは
   * 別に加算される(FAQ問8【簡便法】の(注)および末尾の※)。
   */
  midYearCryptoExchangeValueJpy: Decimal.Value;
}

export interface BlockchainGameIncomeInput {
  items: BlockchainGameTokenItem[];
}

export interface BlockchainGameTokenResult {
  description: string;
  /** 所得税の課税対象になるか(ゲーム内でしか使用できないトークンはfalse) */
  taxable: boolean;
  valuationMethod: BlockchainGameValuationMethod;
  /** 参考情報: PRINCIPLEは取得数量の合計、SIMPLIFIEDはゲーム内通貨ベースの所得金額(トークン単位。円換算前) */
  tokenBasedIncomeAmount: Decimal;
  /** 原則法(取得の都度の時価評価)による雑所得の金額(円)。SIMPLIFIEDの場合は0円。 */
  principleIncomeJpy: Decimal;
  /** 簡便法の年末一括評価による雑所得の金額(円)。PRINCIPLEの場合は0円。 */
  yearEndValuationIncomeJpy: Decimal;
  /** 簡便法で年中に暗号資産等に交換した分の雑所得の金額(円)。PRINCIPLEの場合は0円。 */
  midYearExchangeIncomeJpy: Decimal;
  /** このトークンに係る雑所得の金額の合計(円) */
  miscIncomeJpy: Decimal;
}

export interface BlockchainGameIncomeResult {
  items: BlockchainGameTokenResult[];
  /** 雑所得の金額の合計(円)。赤字になる場合もそのまま返す。 */
  totalMiscIncomeJpy: Decimal;
  notes: string[];
}

function requireNonNegative(value: Decimal, label: string): void {
  if (value.isNegative()) {
    throw new Error(`${label}は0以上である必要があります`);
  }
}

export function estimateBlockchainGameIncome(
  input: BlockchainGameIncomeInput,
): BlockchainGameIncomeResult {
  let totalMiscIncomeJpy = new Decimal(0);

  const items: BlockchainGameTokenResult[] = input.items.map((item) => {
    const taxable = !item.isGameOnlyToken;

    if (item.valuationMethod === "PRINCIPLE") {
      let totalQuantity = new Decimal(0);
      let principleIncomeJpy = new Decimal(0);

      for (const receipt of item.principleReceipts) {
        const quantity = new Decimal(receipt.quantity);
        const unitPriceJpy = new Decimal(receipt.unitPriceJpy);
        requireNonNegative(quantity, "取得数量");
        requireNonNegative(unitPriceJpy, "取得時の時価");
        totalQuantity = totalQuantity.plus(quantity);
        principleIncomeJpy = principleIncomeJpy.plus(quantity.times(unitPriceJpy));
      }

      const miscIncomeJpy = taxable ? principleIncomeJpy : new Decimal(0);
      totalMiscIncomeJpy = totalMiscIncomeJpy.plus(miscIncomeJpy);

      return {
        description: item.description,
        taxable,
        valuationMethod: item.valuationMethod,
        tokenBasedIncomeAmount: totalQuantity,
        principleIncomeJpy: miscIncomeJpy,
        yearEndValuationIncomeJpy: new Decimal(0),
        midYearExchangeIncomeJpy: new Decimal(0),
        miscIncomeJpy,
      };
    }

    const openingBalance = new Decimal(item.openingBalance);
    const closingBalance = new Decimal(item.closingBalance);
    const purchasedAmount = new Decimal(item.purchasedAmount);
    const yearEndRateJpy = new Decimal(item.yearEndRateJpy);
    const midYearCryptoExchangeValueJpy = new Decimal(item.midYearCryptoExchangeValueJpy);

    requireNonNegative(openingBalance, "年始のゲーム内通貨保有数量");
    requireNonNegative(closingBalance, "年末のゲーム内通貨保有数量");
    requireNonNegative(purchasedAmount, "年中に購入したゲーム内通貨の数量");
    requireNonNegative(yearEndRateJpy, "年末の暗号資産への換算レート");
    requireNonNegative(midYearCryptoExchangeValueJpy, "年中に暗号資産等に交換した価額");

    const tokenBasedIncomeAmount = closingBalance.minus(openingBalance).minus(purchasedAmount);

    const yearEndValuationIncomeJpy =
      taxable && item.hasYearEndMarketValue
        ? tokenBasedIncomeAmount.times(yearEndRateJpy)
        : new Decimal(0);

    const midYearExchangeIncomeJpy = taxable
      ? midYearCryptoExchangeValueJpy
      : new Decimal(0);

    const miscIncomeJpy = yearEndValuationIncomeJpy.plus(midYearExchangeIncomeJpy);
    totalMiscIncomeJpy = totalMiscIncomeJpy.plus(miscIncomeJpy);

    return {
      description: item.description,
      taxable,
      valuationMethod: item.valuationMethod,
      tokenBasedIncomeAmount,
      principleIncomeJpy: new Decimal(0),
      yearEndValuationIncomeJpy,
      midYearExchangeIncomeJpy,
      miscIncomeJpy,
    };
  });

  const notes: string[] = [
    "国税庁「NFTに関する税務上の取扱いについて(FAQ)」(令和5年1月13日)問8「ブロックチェーンゲームの報酬としてゲーム内通貨を取得した場合」に基づく概算値。原則(PRINCIPLE。取得の都度その時価を収入計上)、又は取得・使用が頻繁な場合にFAQが認める簡便法(SIMPLIFIED。年末に一括評価)のいずれかをトークンごとに選択できる。",
    "原則法の算式: Σ(取得数量×取得時の1トークンあたりの時価)。取得記録(principleReceipts)を積み上げるだけでよく、簡便法のような年末一括評価や年中の暗号資産交換分の別途加算は不要(取得時点で既に収入計上済みのため)。",
    "簡便法の算式: (年末保有数量-年始保有数量-年中購入数量)×年末の暗号資産への換算レート。ゲーム内通貨の取得や使用が頻繁で取引の都度の評価が煩雑なため、年末一括評価が認められている。",
    "ゲーム内通貨(トークン)が、ゲーム内でしか使用できない場合(ゲーム内の資産以外の資産と交換できない場合)には、そもそも所得税の課税対象とならない(FAQ問8本文)。この場合はisGameOnlyTokenをtrueにすること(評価方法によらず雑所得の金額は常に0円になる)。",
    "簡便法でゲーム内通貨が暗号資産と直接交換できないなどの理由で年末時点の時価の算定が困難な場合には、年末一括評価分の雑所得の金額を0円として差し支えない(hasYearEndMarketValueをfalseにする)。ただし、年の中途で暗号資産と交換できる他のトークンに交換した分がある場合には、その交換時点で取得した価額を別途雑所得の金額に加算する(midYearCryptoExchangeValueJpy。交換した時点で時価が確定するため、年末の時価算定の可否にかかわらず課税対象になる)。",
    "雑所得の金額が赤字(マイナス)の場合、他の所得区分との損益通算はできない(雑所得内の通算のみ可能)。本ツールはこの制限を強制せず、赤字の場合もそのままtotalMiscIncomeJpyとして返すため、実際の申告にあたっては暗号資産等の他の雑所得と合算してから0円を下限に扱う必要がある。",
    "ゲーム内通貨の取得価額(必要経費相当額)を個別に集計する構造とは異なり、いずれの方法も収入側から直接雑所得の金額を算出するため、本ツールでは必要経費を独立した入力欄として設けていない。",
    "各金額は円未満の端数を切り捨てずDecimalの計算結果をそのまま返す概算値。NFT一次流通の雑所得(機能125、/nft-creator-income)・暗号資産の損益計算(/import)とは独立した単体の試算画面のため、特定の年分の取引データには依存しない。",
  ];

  return { items, totalMiscIncomeJpy, notes };
}
