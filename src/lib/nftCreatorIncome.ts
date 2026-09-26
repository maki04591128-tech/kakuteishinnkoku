import { Decimal } from "decimal.js";

/**
 * NFT(Non-Fungible Token)を組成(発行)して第三者に有償で譲渡した場合(一次流通)の
 * 雑所得の金額を試算する。国税庁「NFTに関する税務上の取扱いについて(FAQ)」
 * (令和5年1月13日、課税総括課情報等第1号)の問1「NFTを組成して第三者に譲渡した
 * 場合(一次流通)」に基づく。
 *
 * デジタルアート等を制作し、それに紐づけたNFTをマーケットプレイス等で有償譲渡した
 * ことにより得た利益は、「デジタルアートの閲覧に関する権利」の設定に係る取引として
 * 雑所得(又は事業所得。営利を目的として継続的に行われる場合や規模が大きい場合は
 * 事業所得になり得るが、本ツールは事業所得の判定は行わず雑所得として試算する)に
 * 区分される。
 *
 * 計算式(問1【算式】):
 *   雑所得の金額 = NFTの譲渡収入 - NFTに係る必要経費
 *
 * NFTの譲渡収入をマーケットプレイス内で流通するトークンで受け取った場合は、その
 * トークンの時価が譲渡収入となる(そのトークンが暗号資産等の財産的価値を有する
 * 資産と交換できない等の理由で時価算定が困難な場合は、譲渡したNFTの市場価額(無い
 * 場合は売上原価等)をそのトークンの時価として扱ってよい、とFAQは注記しているが、
 * 円換算後の金額はユーザー自身が算定して入力する前提とする)。
 *
 * 必要経費(問1の注2)は、譲渡収入を得るために要した売上原価並びに販売費及び一般
 * 管理費の額(NFTの組成(ミント)に要したガス代・プラットフォーム手数料等)。
 * 「そのNFTを組成するために要した費用の額」が売上原価であり、デジタルアート
 * そのものの制作費は含まれない点をFAQが明記しているため、本ツールでは制作費を
 * 独立した入力欄(artCreationCostJpy)として受け取り、必要経費には合算しない
 * (参考情報として合計額のみ返す)。
 */

export interface NftCreatorIncomeItem {
  /** 作品名・NFTの内容等(任意の説明ラベル) */
  description: string;
  /** NFTの譲渡収入(トークンで受け取った場合はその時価。円換算後の金額) */
  transferRevenueJpy: Decimal.Value;
  /** NFTの組成(ミント)費用(ガス代・プラットフォーム手数料等。必要経費に算入可) */
  mintingCostJpy: Decimal.Value;
  /** 販売費及び一般管理費(マーケットプレイス手数料等。必要経費に算入可) */
  sellingAndAdminExpensesJpy: Decimal.Value;
  /** デジタルアート等の制作費(参考情報。FAQ問1注2により必要経費に算入不可) */
  artCreationCostJpy: Decimal.Value;
}

export interface NftCreatorIncomeInput {
  items: NftCreatorIncomeItem[];
}

export interface NftCreatorIncomeResult {
  /** NFTの譲渡収入の合計 */
  totalRevenueJpy: Decimal;
  /** 必要経費に算入できる額の合計(組成費用+販売費及び一般管理費) */
  deductibleExpensesJpy: Decimal;
  /** 参考情報: 必要経費に算入できないデジタルアート制作費の合計 */
  excludedArtCreationCostJpy: Decimal;
  /**
   * 雑所得の金額(譲渡収入の合計-必要経費の合計)。赤字(マイナス)になる場合も
   * そのまま返す。FAQ問1注3のとおり、赤字の場合は他の所得区分との損益通算はできず、
   * 雑所得内(他のNFT取引・暗号資産等)での通算のみ可能。
   */
  miscIncomeJpy: Decimal;
  notes: string[];
}

function requireNonNegative(value: Decimal, label: string): void {
  if (value.isNegative()) {
    throw new Error(`${label}は0以上である必要があります`);
  }
}

export function estimateNftCreatorIncome(
  input: NftCreatorIncomeInput,
): NftCreatorIncomeResult {
  let totalRevenueJpy = new Decimal(0);
  let deductibleExpensesJpy = new Decimal(0);
  let excludedArtCreationCostJpy = new Decimal(0);

  for (const item of input.items) {
    const transferRevenueJpy = new Decimal(item.transferRevenueJpy);
    const mintingCostJpy = new Decimal(item.mintingCostJpy);
    const sellingAndAdminExpensesJpy = new Decimal(item.sellingAndAdminExpensesJpy);
    const artCreationCostJpy = new Decimal(item.artCreationCostJpy);

    requireNonNegative(transferRevenueJpy, "NFTの譲渡収入");
    requireNonNegative(mintingCostJpy, "NFTの組成費用");
    requireNonNegative(sellingAndAdminExpensesJpy, "販売費及び一般管理費");
    requireNonNegative(artCreationCostJpy, "デジタルアート等の制作費");

    totalRevenueJpy = totalRevenueJpy.plus(transferRevenueJpy);
    deductibleExpensesJpy = deductibleExpensesJpy
      .plus(mintingCostJpy)
      .plus(sellingAndAdminExpensesJpy);
    excludedArtCreationCostJpy = excludedArtCreationCostJpy.plus(artCreationCostJpy);
  }

  const miscIncomeJpy = totalRevenueJpy.minus(deductibleExpensesJpy);

  const notes: string[] = [
    "国税庁「NFTに関する税務上の取扱いについて(FAQ)」(令和5年1月13日)問1「NFTを組成して第三者に譲渡した場合(一次流通)」に基づく概算値。デジタルアート等を制作し、それに紐づけたNFTを有償で第三者に譲渡した(いわゆる一次流通)場合の取扱いが対象。既に取得したNFTを転売する二次流通は対象外(譲渡所得に区分されるため、`/general-transfer-income`(総合課税の譲渡所得)で試算すること)。",
    "所得区分は「デジタルアートの閲覧に関する権利」の設定に係る取引として雑所得(又は事業所得)に区分される。営利を目的として継続的に行われる場合や規模が大きい場合は事業所得になり得るが、その判定はユーザー自身が行うこと(本ツールは雑所得として試算する)。",
    "NFTの譲渡収入をマーケットプレイス内で流通するトークンで受け取った場合は、そのトークンの時価(円換算額)が譲渡収入となる。そのトークンが暗号資産等の財産的価値を有する資産と交換できない等の理由で時価の算定が困難な場合には、譲渡したNFTの市場価額(市場価額が無い場合は売上原価等)をそのトークンの時価として扱って差し支えない(FAQ問1注1)。円換算はユーザー自身が行い、円換算後の金額を入力すること。",
    "必要経費(NFTの組成費用・販売費及び一般管理費)に算入できるのは、そのNFTを組成(ミント)するために要した費用(ガス代・プラットフォーム手数料等)であり、デジタルアート等そのものの制作費は含まれない(FAQ問1注2)。本ツールでは制作費を別欄で入力できるようにし、必要経費には合算せず参考情報(excludedArtCreationCostJpy)として表示する。",
    "雑所得の金額が赤字(マイナス)の場合、他の所得区分との損益通算はできない(雑所得内の通算のみ可能。FAQ問1注3)。本ツールはこの制限を強制せず、赤字の場合もそのままmiscIncomeJpyとして返すため、実際の申告にあたっては暗号資産等の他の雑所得と合算してから0円を下限に扱う必要がある。",
    "非居住者が日本のマーケットプレイスでNFTを譲渡した場合(FAQ問3)、購入したNFTが不正アクセスにより消失した場合の雑損控除・必要経費算入(FAQ問5)、ブロックチェーンゲームの報酬としてゲーム内通貨を取得した場合(FAQ問8)は本ツールの対象外(今後の課題)。",
    "各金額は円未満の端数を切り捨てずDecimalの計算結果をそのまま返す概算値。",
  ];

  return {
    totalRevenueJpy,
    deductibleExpensesJpy,
    excludedArtCreationCostJpy,
    miscIncomeJpy,
    notes,
  };
}
