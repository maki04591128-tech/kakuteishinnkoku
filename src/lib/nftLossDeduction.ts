import { Decimal } from "decimal.js";

/**
 * 第三者の不正アクセス等によりNFTが消失した場合の所得税の取扱いを試算する。
 * 国税庁「NFTに関する税務上の取扱いについて(FAQ)」(令和5年1月13日、課税総括課
 * 情報等第1号)の問5「第三者の不正アクセスにより購入したNFTが消失した場合」に
 * 基づく。機能125(NFT一次流通の雑所得)・機能126(ブロックチェーンゲームの報酬)が
 * 「今後の課題」として明記していた問3・問5・問9のうち、既存の雑損控除の試算画面
 * (`casualtyLossDeduction.ts`・`/casualty-loss-deduction`)に入力する損失額・必要経費
 * 算入額の算定という形で既存パターンをそのまま踏襲できる問5から対応した。
 *
 * FAQ問5により、NFTが消失した場合の取扱いは次のとおり。
 *   - そのNFTが生活に通常必要でない資産(競走馬等の射こう的行為の手段となる動産・
 *     主として趣味/娯楽/保養/鑑賞目的で所有する資産・貴金属等で30万円を超える動産)
 *     や事業用資産等(棚卸資産又は業務の用に供される資産・山林)に該当せず、かつ
 *     その消失が盗難等(第三者の不正アクセス等)に該当する場合には、雑損控除の対象
 *     となる(所法72条)。損失の額は消失時点の時価(時価が不明な場合は購入金額で
 *     差し支えない)。
 *   - そのNFTが事業用資産等に該当する場合には、その損失を事業所得又は雑所得の
 *     金額の計算上、必要経費に算入できる(必要経費算入額はそのNFTの帳簿価額)。
 *   - 生活に通常必要でない資産に該当する場合や、消失原因が盗難等に該当しない場合
 *     (詐欺・恐喝等)は、いずれの控除の対象にもならない。
 *
 * 本ツールは既存の雑損控除試算(`/casualty-loss-deduction`)・雑所得等の必要経費入力
 * (`/nft-creator-income`等)にそのまま合算できる金額までを返す単体の試算画面とし、
 * 控除額そのものの計算(総所得金額等による足切り等)は既存画面に委ねる。
 */

export type NftLossTreatment =
  | "MISCELLANEOUS_LOSS_DEDUCTION"
  | "NECESSARY_EXPENSE"
  | "NOT_DEDUCTIBLE";

export interface NftLossInput {
  /** そのNFTの取得価額(購入金額) */
  acquisitionCostJpy: Decimal.Value;
  /**
   * 消失時点の時価。不明な場合は入力不要(未入力またはnullの場合は取得価額を
   * 時価とみなす。FAQ問5注3「時価が分からない場合には、そのNFTの購入金額として
   * 差し支えない」)。
   */
  fairValueAtLossJpy?: Decimal.Value | null;
  /**
   * 事業用資産等(棚卸資産又は業務の用に供される資産(必要経費未算入の繰延資産を
   * 含む)及び山林)に該当するか。該当する場合は雑損控除ではなく必要経費算入の
   * 対象となる(FAQ問5注2)。
   */
  isBusinessAsset: boolean;
  /**
   * 事業用資産等に該当する場合の帳簿価額。未入力またはnullの場合は取得価額を
   * そのまま帳簿価額とみなす(必要経費算入額はそのNFTの帳簿価額。FAQ問5注)。
   */
  bookValueJpy?: Decimal.Value | null;
  /**
   * 生活に通常必要でない資産(競走馬その他射こう的行為の手段となる動産・主として
   * 趣味/娯楽/保養/鑑賞の目的で所有する資産・貴金属/書画/美術工芸品等で30万円を
   * 超える動産)に該当するか(FAQ問5注1)。事業用資産等に該当する場合はこの判定は
   * 用いない(必要経費算入が優先する)。
   */
  isPersonalUseAsset: boolean;
  /**
   * 消失の原因が盗難等(第三者の不正アクセス等)に該当するか。詐欺・恐喝による
   * 損失は雑損控除の対象外(`casualtyLossDeduction.ts`と同様の整理)。
   */
  isTheft: boolean;
}

export interface NftLossResult {
  /** この試算が適用したと判定した取扱い */
  treatment: NftLossTreatment;
  /**
   * 雑損控除の損失額として`/casualty-loss-deduction`の損害金額に入力する金額
   * (treatmentがMISCELLANEOUS_LOSS_DEDUCTIONの場合のみ非null)。
   */
  casualtyLossAmountJpy: Decimal | null;
  /**
   * 事業所得又は雑所得の必要経費に算入する金額(treatmentがNECESSARY_EXPENSEの
   * 場合のみ非null)。
   */
  necessaryExpenseJpy: Decimal | null;
  notes: string[];
}

function requireNonNegative(value: Decimal, label: string): void {
  if (value.isNegative()) {
    throw new Error(`${label}は0以上である必要があります`);
  }
}

export function estimateNftLossDeduction(input: NftLossInput): NftLossResult {
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

  const notes: string[] = [
    "国税庁「NFTに関する税務上の取扱いについて(FAQ)」(令和5年1月13日)問5「第三者の不正アクセスにより購入したNFTが消失した場合」に基づく概算値。",
    "生活に通常必要でない資産(競走馬等の射こう的行為の手段となる動産・主として趣味/娯楽/保養/鑑賞目的で所有する資産・貴金属/書画/美術工芸品等で30万円を超える動産)や事業用資産等(棚卸資産又は業務の用に供される資産・山林)に該当するかどうかは自身で確認すること(FAQ問5注1・注2)。",
    "詐欺・恐喝による損失は盗難等に該当せず、雑損控除の対象外(`casualtyLossDeduction.ts`と同様の整理)。",
  ];

  if (input.isBusinessAsset) {
    const necessaryExpenseJpy = bookValueJpy ?? acquisitionCostJpy;
    notes.push(
      "事業用資産等に該当するため、この損失は雑損控除ではなく事業所得又は雑所得の金額の計算上、必要経費に算入する(必要経費算入額はそのNFTの帳簿価額。未入力の場合は取得価額をそのまま帳簿価額とみなした)。",
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
      "生活に通常必要でない資産に該当するため、雑損控除・必要経費算入のいずれの対象にもならない(所法72条は生活に通常必要でない資産を雑損控除の対象から除外している)。",
    );
    return {
      treatment: "NOT_DEDUCTIBLE",
      casualtyLossAmountJpy: null,
      necessaryExpenseJpy: null,
      notes,
    };
  }

  if (input.isTheft) {
    const casualtyLossAmountJpy = fairValueAtLossJpy ?? acquisitionCostJpy;
    notes.push(
      "盗難等(第三者の不正アクセス等)に該当し、生活に通常必要でない資産にも事業用資産等にも該当しないため雑損控除の対象となる。損失の額は消失時点の時価(不明な場合は購入金額。FAQ問5注3)とし、この金額を/casualty-loss-deductionの損害金額に入力すること(控除額そのものの計算(総所得金額等による足切り等)は同画面で行う)。",
    );
    return {
      treatment: "MISCELLANEOUS_LOSS_DEDUCTION",
      casualtyLossAmountJpy,
      necessaryExpenseJpy: null,
      notes,
    };
  }

  notes.push(
    "消失原因が盗難等(第三者の不正アクセス等)に該当しない場合(詐欺・恐喝等)は、雑損控除・必要経費算入のいずれの対象にもならない。",
  );
  return {
    treatment: "NOT_DEDUCTIBLE",
    casualtyLossAmountJpy: null,
    necessaryExpenseJpy: null,
    notes,
  };
}
