/**
 * 国外財産調書・財産債務調書に係る過少申告加算税等の軽減・加重措置を判定する。
 *
 * 機能139(国外財産調書・財産債務調書の提出要否判定)が「今後の課題」として明記
 * していた、両調書の適正な提出に向けたインセンティブとして設けられている過少申告
 * 加算税等の特例措置(軽減5%・加重5%又は10%)の適用関係に対応した項目。提出要否
 * (機能139)だけでは、実際に申告漏れが生じた場合にどの程度の加算税リスクがあるかが
 * 分からないため、両者を組み合わせて初めて調書提出のインセンティブが実感できる。
 *
 * 一次情報:
 * - 国外送金等調書法6条(国外財産調書)・6条の3(財産債務調書)、同法施行令11条2項・
 *   12条の3第2項
 * - 国税庁「国外財産調書制度(FAQ)」(令和3年12月版)問42〜44・問53
 * - 国税庁「財産債務調書制度(FAQ)」(令和7年6月版)問47〜49・問53
 *
 * ## 軽減措置(国外送金等調書法6条1項・6条の3第1項)
 *
 * 調書を提出期限内に提出し(又は調査通知前に提出したことにより提出期限内に提出した
 * ものとみなされ。同法6条6項・6条の3第3項、問53)、その調書に申告漏れの基因となった
 * 資産(債務)についての記載があった場合、その資産(債務)に関する申告漏れに係る部分の
 * 過少申告加算税等が5%軽減される。国外財産調書については、書類の提示等の求めに
 * 応じなかった場合は軽減措置は適用されない(同法6条7項、国外財産調書FAQ問43)。
 * 財産債務調書にはこの書類提示等に基づく特例は存在しない。
 *
 * ## 加重措置(国外送金等調書法6条3項・6条の3第2項)
 *
 * 調書の提出等がない場合(期限内提出がない、又は記載すべき資産(債務)の記載がない
 * 場合。重要なものの記載が不十分な場合を含む)に申告漏れが生じたときは、その部分の
 * 過少申告加算税等が5%加重される。国外財産調書については、書類の提示等の求めに
 * 応じなかった場合は加重割合が5%から10%に引き上げられる(同法6条7項、問43)。
 * 財産債務調書にはこの10%への引上げは存在しない。
 *
 * 加重措置には次の除外がある(両調書で対象が異なる非対称な取扱いのため、
 * `UnderreportingTaxType`で申告漏れの原因区分を明示的に入力させる)。
 * - 国外財産調書: 「死亡した方に係るもの」、すなわち死亡した方自身の所得税
 *   (準確定申告)の申告漏れは加重措置の対象外(国外財産調書FAQ問42②)。相続人自身の
 *   相続税の申告漏れは、通常どおり加重措置の対象になる(ただし相続財産である
 *   国外財産について、提出等がないことに相続人本人の責めに帰すべき事由が
 *   なければ対象外。問42②・問45〜46)。
 * - 財産債務調書: 相続税及び死亡した方自身の所得税のいずれも加重措置の対象外
 *   (財産債務調書FAQ問47②注2「相続税及び亡くなられた方の所得税についての
 *   適用はありません」)。財産債務調書は生存する本人の所得税確定申告の前提となる
 *   資産開示制度であり、相続税自体は本来この調書の対象ではないため、国外財産調書
 *   よりも加重の対象が狭い。
 */

export type DisclosureStatementType = "OVERSEAS_ASSET" | "ASSET_LIABILITY";

/**
 * 申告漏れの原因となった税目・申告主体の区分。加重措置の除外対象が
 * 調書の種類によって異なるため、この区分を独立した入力として明示する。
 */
export type UnderreportingTaxType =
  | "OWN_INCOME_TAX" // 本人自身の所得税(又は相続税)の申告漏れ
  | "DECEASED_PERSON_INCOME_TAX" // 死亡した方自身の所得税(準確定申告)の申告漏れ
  | "INHERITANCE_TAX"; // 相続人自身の相続税の申告漏れ(相続財産(債務)に係るもの)

export interface PenaltyAdjustmentInput {
  statementType: DisclosureStatementType;
  underreportingTaxType: UnderreportingTaxType;
  /** その資産(債務)に関して生じる所得等について、所得税又は相続税の申告漏れが生じたか。 */
  hasUnderreporting: boolean;
  /**
   * 修正申告等に係る年分の調書を提出期限内に提出したか。提出期限後でも、
   * 調査があったことによる更正・決定を予知したものでなく、かつ調査通知前に
   * 提出した場合は、提出期限内に提出したものとみなされる(問53)。
   */
  filedByDeadlineOrDeemedTimely: boolean;
  /**
   * 提出した調書に、申告漏れの基因となった当該資産(債務)についての記載があったか。
   * 重要なものの記載が不十分な場合は「記載がない」扱いになる。
   */
  assetOrDebtWasListed: boolean;
  /**
   * `underreportingTaxType`が`INHERITANCE_TAX`の場合に限り意味を持つ。相続財産
   * (国外財産調書)・相続財産債務(財産債務調書)について、調書の提出等がないことに
   * つき相続人本人の責めに帰すべき事由がないか(過失なし)。trueの場合は加重措置の
   * 対象外になる。
   */
  noFaultForInheritedProperty?: boolean;
  /**
   * 国外財産調書のみ有効。税務調査で国外財産の取得・運用・処分に係る書類の提示等を
   * 求められたが、指定期限(求めがあった日から60日を超えない範囲)までに提示等が
   * なかったか(提示等をする方の責めに帰すべき事由がない場合を除く)。財産債務調書に
   * この特例は存在しないため無視される。
   */
  overseasDocumentsNotProvided?: boolean;
}

export interface PenaltyAdjustmentResult {
  /** 申告漏れそのものが無い場合はfalse(軽減・加重いずれも適用の余地が無い)。 */
  applicable: boolean;
  /** 軽減される過少申告加算税等の割合(0または5)。 */
  reductionPercent: number;
  /** 加重される過少申告加算税等の割合(0・5・10のいずれか)。 */
  increasePercent: number;
  reason: string;
  notes: string[];
}

const TAX_TYPE_LABELS: Record<UnderreportingTaxType, string> = {
  OWN_INCOME_TAX: "本人自身の所得税(又は相続税)",
  DECEASED_PERSON_INCOME_TAX: "死亡した方自身の所得税(準確定申告)",
  INHERITANCE_TAX: "相続人自身の相続税",
};

const STATEMENT_LABELS: Record<DisclosureStatementType, string> = {
  OVERSEAS_ASSET: "国外財産調書",
  ASSET_LIABILITY: "財産債務調書",
};

/** 加重措置の対象から除外される申告漏れの原因区分(調書ごとに非対称)。 */
const INCREASE_EXCLUDED_TAX_TYPES: Record<DisclosureStatementType, UnderreportingTaxType[]> = {
  OVERSEAS_ASSET: ["DECEASED_PERSON_INCOME_TAX"],
  ASSET_LIABILITY: ["DECEASED_PERSON_INCOME_TAX", "INHERITANCE_TAX"],
};

export function determinePenaltyAdjustment(
  input: PenaltyAdjustmentInput,
): PenaltyAdjustmentResult {
  const statementLabel = STATEMENT_LABELS[input.statementType];
  const taxTypeLabel = TAX_TYPE_LABELS[input.underreportingTaxType];

  const notes: string[] = [
    "国外送金等調書法6条・6条の3、同法施行令11条2項・12条の3第2項、国税庁「国外財産調書制度(FAQ)」問42〜44・問53、「財産債務調書制度(FAQ)」問47〜49・問53に基づく判定。",
    "この措置は、修正申告等の基因となった事実のうち「資産(債務)に係るもの以外の事実」(人的役務の提供に係る対価等の申告漏れ・所得控除・税額控除の適用誤り等)や重加算税の対象となる仮装隠蔽の事実には適用されない。それらを除いた本税額の部分が軽減・加重の対象になる。",
  ];

  if (!input.hasUnderreporting) {
    return {
      applicable: false,
      reductionPercent: 0,
      increasePercent: 0,
      reason: `${statementLabel}: 対象資産(債務)に関する所得税・相続税の申告漏れが無いため、軽減・加重いずれの措置も適用の余地が無い。`,
      notes,
    };
  }

  const isOverseas = input.statementType === "OVERSEAS_ASSET";
  const documentsNotProvided = isOverseas && !!input.overseasDocumentsNotProvided;
  const listedProperly = input.filedByDeadlineOrDeemedTimely && input.assetOrDebtWasListed;

  // 軽減措置: 期限内提出(またはみなし)かつ記載あり。国外財産調書は書類提示等に
  // 応じなかった場合は軽減措置自体が不適用になる(財産債務調書にこの特例は無い)。
  const reductionApplies = listedProperly && !documentsNotProvided;
  const reductionPercent = reductionApplies ? 5 : 0;

  // 加重措置: 除外対象の税目でなく、かつ調書の提出等が無い(期限内提出が無い、
  // または記載が無い)場合に適用。相続財産(債務)は本人に帰責事由が無ければ除外。
  const isExcludedTaxType = INCREASE_EXCLUDED_TAX_TYPES[input.statementType].includes(
    input.underreportingTaxType,
  );
  const isInheritanceNoFault =
    input.underreportingTaxType === "INHERITANCE_TAX" && !!input.noFaultForInheritedProperty;

  let increasePercent = 0;
  if (!isExcludedTaxType && !listedProperly && !isInheritanceNoFault) {
    increasePercent = documentsNotProvided ? 10 : 5;
  }

  const reasonParts: string[] = [`${statementLabel}(${taxTypeLabel}の申告漏れ):`];
  if (reductionApplies) {
    reasonParts.push("提出期限内(又は調査通知前提出によるみなし)提出済みで対象資産(債務)の記載もあるため、過少申告加算税等が5%軽減される。");
  } else if (listedProperly && documentsNotProvided) {
    reasonParts.push(
      "期限内提出・記載自体はあるが、国外財産に関する書類の提示等の求めに応じなかったため軽減措置は適用されない。",
    );
  } else {
    reasonParts.push("提出期限内の提出、又は対象資産(債務)の記載のいずれかが無いため軽減措置は適用されない。");
  }

  if (isExcludedTaxType) {
    reasonParts.push(
      `${taxTypeLabel}の申告漏れは、${statementLabel}の加重措置の対象から除外されているため加重措置は適用されない。`,
    );
  } else if (listedProperly) {
    reasonParts.push("調書に適正な提出等があるため加重措置は適用されない。");
  } else if (isInheritanceNoFault) {
    reasonParts.push(
      "相続財産(債務)について提出等がないことに相続人本人の責めに帰すべき事由が無いため加重措置は適用されない。",
    );
  } else if (documentsNotProvided) {
    reasonParts.push(
      "調書の提出等が無く、かつ国外財産に関する書類の提示等の求めにも応じなかったため、過少申告加算税等が通常の5%ではなく10%加重される。",
    );
  } else {
    reasonParts.push("調書の提出等が無いため、過少申告加算税等が5%加重される。");
  }

  if (input.underreportingTaxType === "INHERITANCE_TAX") {
    notes.push(
      "相続税の申告漏れは、国外財産調書では通常どおり加重措置の対象になり得るが(相続財産について本人に帰責事由が無い場合を除く)、財産債務調書では相続税自体が加重措置の対象から除外される点が両調書で異なる。",
    );
  }
  if (input.underreportingTaxType === "DECEASED_PERSON_INCOME_TAX") {
    notes.push("死亡した方自身の所得税(準確定申告)の申告漏れは、いずれの調書でも加重措置の対象外。");
  }
  if (!isOverseas && input.overseasDocumentsNotProvided) {
    notes.push("財産債務調書には書類の提示等に基づく10%加重・軽減不適用の特例は存在しないため、この入力は判定に用いていない。");
  }

  return {
    applicable: true,
    reductionPercent,
    increasePercent,
    reason: reasonParts.join(" "),
    notes,
  };
}
