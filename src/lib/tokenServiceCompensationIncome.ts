import { Decimal } from "decimal.js";

/**
 * 役務提供の対価として取引先が発行するトークンを取得した場合の所得を試算する。
 * 国税庁「NFTに関する税務上の取扱いについて(FAQ)」(令和5年1月13日、課税総括課
 * 情報等第1号)の問6「役務提供の対価として取引先が発行するトークンを取得した場合」
 * に基づく。機能125(NFT一次流通の雑所得)・機能126(ブロックチェーンゲームの報酬)
 * が「今後の課題」として明記していた問6・問7のうち、既存の計算モジュールに直接
 * 当てはまらない問6から対応した(問7「商品の購入の際に購入先が発行するトークンを
 * 無償で取得した場合」は、経済的利益が一時所得に区分され、既存の一時所得の試算
 * (`occasionalIncome.ts`・`/occasional-income`)の総収入金額にそのまま合算できる
 * ため、新たな計算モジュールは不要と判断した。トークンの時価(算定困難な場合は0円。
 * FAQ問7注)を`/occasional-income`の総収入金額に加算して試算すること)。
 *
 * FAQ問6により、役務提供の対価として取引先の法人が発行するトークンを取得した場合の
 * 所得区分は、契約の類型によって異なる。
 *   - 請負契約その他これに類する契約の場合: 事業所得又は雑所得
 *     (本ツールはNFT一次流通(機能125)と同じ方針で雑所得として試算する)
 *   - 雇用契約その他これに類する契約の場合: 給与所得
 *
 * 役務提供の対価の額は、そのトークンの時価となる。ただし、そのトークンが暗号資産
 * などの財産的価値を有する資産と交換できないなどの理由により時価の算定が困難な
 * 場合には、契約などによって定められた役務提供の対価の額を、そのトークンの時価と
 * 取り扱って差し支えない(FAQ問6の注)。
 *
 * 雇用契約の場合の給与所得金額の計算(給与所得控除の適用)は、既存の
 * `employmentIncome.ts`・`/employment-income`の対象であり、このトークンの対価額は
 * 通常の給与収入額とは別に支払われる追加分のため、本ツールでは合算後の給与所得
 * ではなく「追加すべき給与収入額」までを返す(`/employment-income`側の給与収入
 * 金額にこの金額を合算して入力すること)。
 */

export type TokenServiceContractType = "CONTRACT" | "EMPLOYMENT";

export interface TokenServiceCompensationItem {
  /** 取引先名・役務提供の内容等(任意の説明ラベル) */
  description: string;
  /**
   * 契約の類型。CONTRACT(請負契約その他これに類する契約)は事業所得又は雑所得、
   * EMPLOYMENT(雇用契約その他これに類する契約)は給与所得に区分される(FAQ問6)。
   */
  contractType: TokenServiceContractType;
  /** そのトークンの時価(円換算額)。時価の算定が可能な場合はこちらを対価の額とする。 */
  tokenFairValueJpy: Decimal.Value;
  /**
   * トークンが暗号資産などの財産的価値を有する資産と交換できないなどの理由により
   * 時価の算定が困難な場合はtrue。この場合、tokenFairValueJpyではなく
   * contractualServiceValueJpy(契約などによって定められた役務提供の対価の額)を
   * 対価の額として扱う(FAQ問6の注)。
   */
  fairValueDifficultToDetermine: boolean;
  /** 契約などによって定められた役務提供の対価の額(時価算定困難な場合のみ使用)。 */
  contractualServiceValueJpy: Decimal.Value;
  /**
   * 必要経費。CONTRACT(事業所得又は雑所得)の場合のみ意味を持つ。EMPLOYMENT
   * (給与所得)の場合は個別の必要経費算入ではなく給与所得控除が適用されるため、
   * この欄は無視する(常に0として扱う)。
   */
  necessaryExpensesJpy: Decimal.Value;
}

export interface TokenServiceCompensationInput {
  items: TokenServiceCompensationItem[];
}

export interface TokenServiceCompensationItemResult {
  description: string;
  contractType: TokenServiceContractType;
  /** 対価の額として採用した金額(時価、または時価算定困難な場合は契約対価の額) */
  compensationValueJpy: Decimal;
}

export interface TokenServiceCompensationResult {
  items: TokenServiceCompensationItemResult[];
  /** 請負契約等(CONTRACT)分の収入(対価の額)の合計 */
  businessOrMiscRevenueJpy: Decimal;
  /** 請負契約等(CONTRACT)分の必要経費の合計 */
  businessOrMiscExpensesJpy: Decimal;
  /**
   * 事業所得又は雑所得の金額(請負契約等分の収入-必要経費)。本ツールは
   * NFT一次流通(機能125)と同じ方針で雑所得として試算する。赤字の場合もそのまま返す。
   */
  businessOrMiscIncomeJpy: Decimal;
  /**
   * 雇用契約等(EMPLOYMENT)分の対価の額の合計(給与所得控除前)。給与所得金額の
   * 計算は`/employment-income`の対象のため、この金額を同画面の給与収入金額に
   * 合算して入力すること。
   */
  additionalEmploymentRevenueJpy: Decimal;
  notes: string[];
}

function requireNonNegative(value: Decimal, label: string): void {
  if (value.isNegative()) {
    throw new Error(`${label}は0以上である必要があります`);
  }
}

export function estimateTokenServiceCompensationIncome(
  input: TokenServiceCompensationInput,
): TokenServiceCompensationResult {
  let businessOrMiscRevenueJpy = new Decimal(0);
  let businessOrMiscExpensesJpy = new Decimal(0);
  let additionalEmploymentRevenueJpy = new Decimal(0);

  const items: TokenServiceCompensationItemResult[] = input.items.map((item) => {
    const tokenFairValueJpy = new Decimal(item.tokenFairValueJpy);
    const contractualServiceValueJpy = new Decimal(item.contractualServiceValueJpy);
    const necessaryExpensesJpy = new Decimal(item.necessaryExpensesJpy);

    requireNonNegative(tokenFairValueJpy, "トークンの時価");
    requireNonNegative(contractualServiceValueJpy, "契約などによって定められた対価の額");
    requireNonNegative(necessaryExpensesJpy, "必要経費");

    const compensationValueJpy = item.fairValueDifficultToDetermine
      ? contractualServiceValueJpy
      : tokenFairValueJpy;

    if (item.contractType === "CONTRACT") {
      businessOrMiscRevenueJpy = businessOrMiscRevenueJpy.plus(compensationValueJpy);
      businessOrMiscExpensesJpy = businessOrMiscExpensesJpy.plus(necessaryExpensesJpy);
    } else {
      additionalEmploymentRevenueJpy = additionalEmploymentRevenueJpy.plus(compensationValueJpy);
    }

    return {
      description: item.description,
      contractType: item.contractType,
      compensationValueJpy,
    };
  });

  const businessOrMiscIncomeJpy = businessOrMiscRevenueJpy.minus(businessOrMiscExpensesJpy);

  const notes: string[] = [
    "国税庁「NFTに関する税務上の取扱いについて(FAQ)」(令和5年1月13日)問6「役務提供の対価として取引先が発行するトークンを取得した場合」に基づく概算値。",
    "役務提供の対価に係る所得区分は契約の類型による。請負契約その他これに類する契約の場合は事業所得又は雑所得(本ツールはNFT一次流通(機能125)と同じ方針で雑所得として試算する)、雇用契約その他これに類する契約の場合は給与所得に区分される(FAQ問6)。",
    "役務提供の対価の額は、そのトークンの時価となる。ただし、そのトークンが暗号資産などの財産的価値を有する資産と交換できないなどの理由により時価の算定が困難な場合には、契約などによって定められた役務提供の対価の額を、そのトークンの時価と取り扱って差し支えない(FAQ問6の注)。",
    "雇用契約等(給与所得)分は、給与所得控除の適用対象のため、この試算では対価の額の合計(additionalEmploymentRevenueJpy)までしか計算しない。この金額を、通常の給与収入額とは別枠の追加分として/employment-incomeの給与収入金額に合算し、給与所得金額を再計算すること。",
    "請負契約等(事業所得又は雑所得)分の必要経費は、その役務提供・トークンの取得に直接要した費用を入力すること。雑所得の金額が赤字(マイナス)の場合、他の所得区分との損益通算はできない(雑所得内の通算のみ可能)。",
    "商品の購入の際に無償でトークンを取得した場合(FAQ問7)は、経済的利益が一時所得に区分されるため対象外(そのトークンの時価(算定困難な場合は0円。FAQ問7注)を/occasional-incomeの総収入金額に合算して試算すること)。",
    "各金額は円未満の端数を切り捨てずDecimalの計算結果をそのまま返す概算値。他の暗号資産・投資の集計とは独立した単体の試算画面のため、特定の年分の取引データには依存しない。",
  ];

  return {
    items,
    businessOrMiscRevenueJpy,
    businessOrMiscExpensesJpy,
    businessOrMiscIncomeJpy,
    additionalEmploymentRevenueJpy,
    notes,
  };
}
