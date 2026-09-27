import { Decimal } from "decimal.js";

/**
 * 国外財産調書・財産債務調書の提出要否を判定する。
 *
 * 機能138(暗号資産取引の所得区分の判定)までで投資・暗号資産領域の主要な所得計算の
 * ギャップへの対応が進んだことを踏まえ、暗号資産・投資資産の「保有」に着目した
 * 提出義務(国外送金等調書法に基づく調書制度)に対象を広げたところ、国外財産調書
 * (同法5条)・財産債務調書(同法6条の2)のいずれもコードベース・READMEのどこにも
 * 実装が無いギャップであることを確認した。
 *
 * とりわけ暗号資産については、国外の暗号資産交換業者に暗号資産を保有していても
 * 国外財産調書への記載対象にはならないという、直感に反する(誤解しやすい)取扱いが
 * 国税庁「国外財産調書制度(FAQ)」問11で明記されており、この判定を自動化する
 * 意義が大きいと判断した。
 *
 * 一次情報:
 * - 国外送金等調書法5条・6条の2、国外送金等調書令10条、国外送金等調書規則12条
 * - 国税庁「国外財産調書制度(FAQ)」問2・問11(令和5年4月版で提出期限が翌年
 *   6月30日に改正されたことを反映済み)
 * - 国税庁タックスアンサーNo.7456「国外財産調書の提出義務」・
 *   No.7457「財産債務調書の提出義務」
 *
 * ## 国外財産調書(国外送金等調書法5条)
 *
 * - 提出義務者は、その年の12月31日において「非永住者以外の居住者」であり、かつ
 *   その日において有する国外財産の価額の合計額が5,000万円を超える者(問2)。
 *   非永住者・非居住者はそもそも提出義務者にならない。
 * - 暗号資産は、国外送金等調書規則12条3項6号により、「財産を有する方の住所
 *   (住所が無ければ居所)の所在」によって国外にあるかどうかを判定する財産に
 *   区分される。したがって居住者本人の住所は常に国内にあるため、暗号資産を
 *   保管する交換業者・ウォレットが国内か国外かを問わず、暗号資産は「国外にある
 *   財産」に該当せず、国外財産調書への記載対象にはならない(問11)。この点を
 *   踏まえ、本ツールでは暗号資産の価額を国外財産の合計額の判定に含めない。
 * - 提出期限は、その年の翌年6月30日(令和4年度税制改正により翌年3月15日から
 *   延長。令和5年分以後に適用)。
 *
 * ## 財産債務調書(国外送金等調書法6条の2)
 *
 * 次のいずれかに該当する場合に提出義務が生じる(タックスアンサーNo.7457)。
 *
 * - 要件1: 所得税の確定申告書を提出する必要がある方又は一定の還付申告書を
 *   提出できる方で、その年分の退職所得を除く各種所得金額の合計額が2,000万円を
 *   超え、かつ、その年の12月31日において(a)価額の合計額が3億円以上の財産、
 *   又は(b)価額の合計額が1億円以上の有価証券等(所得税法60条の2第1項の
 *   有価証券等並びに同条2項の未決済信用取引等及び同条3項の未決済デリバティブ
 *   取引に係る権利。暗号資産はこの「有価証券等」に含まれない)を有する方。
 * - 要件2: 要件1に該当しない場合でも、その年の12月31日において価額の合計額が
 *   10億円以上の財産を有する居住者の方(令和4年度税制改正で追加。非居住者は
 *   対象外)。
 * - 暗号資産は「その他の財産」の区分として記載対象になり(国外財産調書とは
 *   異なり所在を問わず記載対象)、財産の合計額(3億円・10億円の判定)には
 *   含めるが、60条の2の「有価証券等」には該当しないため1億円の判定には
 *   含めない。記載する価額は12月31日時点の時価(活発な市場がある場合は取引を
 *   行う暗号資産交換業者の同日時点の取引価格)、時価の算定が困難な場合は
 *   取得価額等を基にした見積価額。
 * - 提出期限は、その年の翌年6月30日(国外財産調書と同時期に延長)。
 */

export type ResidencyStatusForDisclosure =
  | "RESIDENT" // 非永住者以外の居住者
  | "NON_PERMANENT_RESIDENT" // 非永住者
  | "NON_RESIDENT"; // 非居住者

/** 国外財産調書の提出義務者となる国外財産の価額の閾値(5,000万円)。 */
export const OVERSEAS_ASSET_STATEMENT_THRESHOLD_JPY = new Decimal(50_000_000);
/** 財産債務調書 要件1の所得金額の閾値(2,000万円)。 */
export const ASSET_LIABILITY_STATEMENT_INCOME_THRESHOLD_JPY = new Decimal(20_000_000);
/** 財産債務調書 要件1(a)の財産の価額の閾値(3億円)。 */
export const ASSET_LIABILITY_STATEMENT_TOTAL_ASSETS_THRESHOLD_JPY = new Decimal(300_000_000);
/** 財産債務調書 要件1(b)の有価証券等の価額の閾値(1億円)。 */
export const ASSET_LIABILITY_STATEMENT_SECURITIES_THRESHOLD_JPY = new Decimal(100_000_000);
/** 財産債務調書 要件2の財産の価額の閾値(10億円)。所得要件を問わない。 */
export const ASSET_LIABILITY_STATEMENT_LARGE_ASSETS_THRESHOLD_JPY = new Decimal(1_000_000_000);

export interface AssetDisclosureRequirementInput {
  /** その年の12月31日現在の居住形態。 */
  residencyStatus: ResidencyStatusForDisclosure;
  /**
   * 所得税の確定申告書を提出する必要がある、又は一定の還付申告書
   * (その年分の所得税額の合計額が配当控除額・住宅借入金等特別控除額(年末調整分)
   * の合計額を超える場合の還付申告書)を提出できるかどうか。財産債務調書の
   * 要件1の前提条件。
   */
  hasIncomeTaxReturnObligationOrEligibleRefundReturn: boolean;
  /** その年分の退職所得を除く各種所得金額の合計額。 */
  aggregateIncomeExcludingRetirementJpy: Decimal.Value;
  /**
   * その年の12月31日において保有する暗号資産(仮想通貨)の価額の合計額。
   * 保管する交換業者・ウォレットの所在地(国内・国外)を問わず入力する
   * (国外財産調書の判定からは自動的に除外し、財産債務調書の財産の合計額には
   * 算入する)。
   */
  cryptoAssetsJpy: Decimal.Value;
  /**
   * 暗号資産を除く、その年の12月31日において保有する国外財産(国外にある
   * 不動産・預貯金・有価証券等)の価額の合計額。
   */
  overseasAssetsExcludingCryptoJpy: Decimal.Value;
  /**
   * その年の12月31日において保有する財産(国内・国外、暗号資産を含む)の
   * 価額の合計額。財産債務調書の要件1(a)・要件2の判定に用いる。
   */
  totalAssetsJpy: Decimal.Value;
  /**
   * 上記`totalAssetsJpy`の内数のうち、所得税法60条の2第1項の有価証券等・
   * 同条2項の未決済信用取引等・同条3項の未決済デリバティブ取引に係る権利の
   * 価額の合計額(暗号資産を含まない)。財産債務調書の要件1(b)の判定に用いる。
   */
  section60SecuritiesEtcJpy: Decimal.Value;
}

export interface OverseasAssetStatementResult {
  required: boolean;
  overseasAssetsTotalJpy: Decimal;
  reason: string;
}

export interface AssetLiabilityStatementResult {
  required: boolean;
  satisfiesRequirement1: boolean;
  satisfiesRequirement2: boolean;
  reason: string;
}

export interface AssetDisclosureRequirementResult {
  overseasAssetStatement: OverseasAssetStatementResult;
  assetLiabilityStatement: AssetLiabilityStatementResult;
  /** 両調書に共通の提出期限(その年の翌年6月30日)についての注記。 */
  deadlineNote: string;
  notes: string[];
}

function toDecimal(value: Decimal.Value, label: string): Decimal {
  const decimal = new Decimal(value);
  if (decimal.isNegative()) {
    throw new Error(`${label}は0以上である必要があります`);
  }
  return decimal;
}

export function determineAssetDisclosureRequirement(
  input: AssetDisclosureRequirementInput,
): AssetDisclosureRequirementResult {
  const cryptoAssetsJpy = toDecimal(input.cryptoAssetsJpy, "暗号資産の価額");
  const overseasAssetsExcludingCryptoJpy = toDecimal(
    input.overseasAssetsExcludingCryptoJpy,
    "暗号資産を除く国外財産の価額",
  );
  const totalAssetsJpy = toDecimal(input.totalAssetsJpy, "財産の価額の合計額");
  const section60SecuritiesEtcJpy = toDecimal(
    input.section60SecuritiesEtcJpy,
    "所得税法60条の2の有価証券等の価額",
  );
  const aggregateIncomeExcludingRetirementJpy = toDecimal(
    input.aggregateIncomeExcludingRetirementJpy,
    "退職所得を除く各種所得金額の合計額",
  );

  // 国外財産調書: 暗号資産は所在の判定上、常に国内財産として扱われ含まれない。
  const overseasAssetsTotalJpy = overseasAssetsExcludingCryptoJpy;
  const isResidentEligibleForOverseasStatement = input.residencyStatus === "RESIDENT";
  const exceedsOverseasThreshold = overseasAssetsTotalJpy.greaterThan(
    OVERSEAS_ASSET_STATEMENT_THRESHOLD_JPY,
  );
  const overseasRequired = isResidentEligibleForOverseasStatement && exceedsOverseasThreshold;

  let overseasReason: string;
  if (!isResidentEligibleForOverseasStatement) {
    overseasReason =
      input.residencyStatus === "NON_PERMANENT_RESIDENT"
        ? "非永住者は国外財産調書の提出義務者にならない(国外送金等調書法5条1項は「非永住者以外の居住者」に限定)。"
        : "非居住者は国外財産調書の提出義務者にならない(国外送金等調書法5条1項は居住者に限定)。";
  } else if (exceedsOverseasThreshold) {
    overseasReason = `暗号資産を除く国外財産の価額の合計額(${overseasAssetsTotalJpy.toString()}円)が5,000万円を超えるため、国外財産調書の提出義務がある。暗号資産は保有者本人の住所(国内)により所在が判定されるため、保管先の交換業者・ウォレットが国外であっても国外財産には該当しない(国外財産調書制度FAQ問11)。`;
  } else {
    overseasReason = `暗号資産を除く国外財産の価額の合計額(${overseasAssetsTotalJpy.toString()}円)が5,000万円以下のため、国外財産調書の提出義務はない。暗号資産(${cryptoAssetsJpy.toString()}円)は所在が保有者本人の住所により判定されるため、この合計額に含めていない。`;
  }

  // 財産債務調書: 暗号資産は「その他の財産」として財産の合計額には含まれるが、
  // 所得税法60条の2の「有価証券等」には該当しない。
  const satisfiesRequirement1 =
    input.hasIncomeTaxReturnObligationOrEligibleRefundReturn &&
    aggregateIncomeExcludingRetirementJpy.greaterThan(
      ASSET_LIABILITY_STATEMENT_INCOME_THRESHOLD_JPY,
    ) &&
    (totalAssetsJpy.greaterThanOrEqualTo(ASSET_LIABILITY_STATEMENT_TOTAL_ASSETS_THRESHOLD_JPY) ||
      section60SecuritiesEtcJpy.greaterThanOrEqualTo(
        ASSET_LIABILITY_STATEMENT_SECURITIES_THRESHOLD_JPY,
      ));

  const isResidentForRequirement2 = input.residencyStatus !== "NON_RESIDENT";
  const satisfiesRequirement2 =
    !satisfiesRequirement1 &&
    isResidentForRequirement2 &&
    totalAssetsJpy.greaterThanOrEqualTo(ASSET_LIABILITY_STATEMENT_LARGE_ASSETS_THRESHOLD_JPY);

  const assetLiabilityRequired = satisfiesRequirement1 || satisfiesRequirement2;

  let assetLiabilityReason: string;
  if (satisfiesRequirement1) {
    assetLiabilityReason = `退職所得を除く各種所得金額の合計額(${aggregateIncomeExcludingRetirementJpy.toString()}円)が2,000万円を超え、かつ財産の合計額(${totalAssetsJpy.toString()}円、暗号資産${cryptoAssetsJpy.toString()}円を含む)が3億円以上、又は所得税法60条の2の有価証券等の価額(${section60SecuritiesEtcJpy.toString()}円、暗号資産を含まない)が1億円以上であるため、財産債務調書の提出義務がある(要件1)。`;
  } else if (satisfiesRequirement2) {
    assetLiabilityReason = `要件1(所得2,000万円超かつ財産3億円以上等)には該当しないが、財産の合計額(${totalAssetsJpy.toString()}円、暗号資産${cryptoAssetsJpy.toString()}円を含む)が10億円以上の居住者であるため、財産債務調書の提出義務がある(要件2。非居住者は対象外)。`;
  } else if (!isResidentForRequirement2 && totalAssetsJpy.greaterThanOrEqualTo(
    ASSET_LIABILITY_STATEMENT_LARGE_ASSETS_THRESHOLD_JPY,
  )) {
    assetLiabilityReason = `財産の合計額(${totalAssetsJpy.toString()}円)が10億円以上だが、要件2は居住者に限られ非居住者には適用されないため、財産債務調書の提出義務はない。`;
  } else {
    assetLiabilityReason =
      "要件1(所得2,000万円超かつ財産3億円以上又は有価証券等1億円以上)・要件2(財産10億円以上の居住者)のいずれにも該当しないため、財産債務調書の提出義務はない。";
  }

  const notes: string[] = [
    "国外送金等調書法5条・6条の2、国外送金等調書令10条、国外送金等調書規則12条、国税庁「国外財産調書制度(FAQ)」問2・問11、タックスアンサーNo.7456・No.7457に基づく判定。",
    "暗号資産は、国外財産調書では所在が保有者本人の住所により判定されるため保管先の国内外を問わず国外財産に含めず、財産債務調書では所在を問わず「その他の財産」として財産の合計額に含めるが所得税法60条の2の「有価証券等」には該当しない、という異なる取扱いになる点に注意する。",
  ];

  return {
    overseasAssetStatement: {
      required: overseasRequired,
      overseasAssetsTotalJpy,
      reason: overseasReason,
    },
    assetLiabilityStatement: {
      required: assetLiabilityRequired,
      satisfiesRequirement1,
      satisfiesRequirement2,
      reason: assetLiabilityReason,
    },
    deadlineNote:
      "いずれの調書も提出期限はその年の翌年6月30日(令和4年度税制改正により、従来の翌年3月15日から延長。令和5年分以後に適用)。",
    notes,
  };
}
