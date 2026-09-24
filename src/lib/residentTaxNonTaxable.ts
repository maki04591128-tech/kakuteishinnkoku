import { Decimal } from "decimal.js";

/**
 * 個人住民税(所得割・均等割)が非課税になるかどうかを判定する(地方税法24条の5・
 * 295条、市区町村の条例)。
 *
 * 非課税になるパターンは大きく2つある(生活保護法の生活扶助を受けている場合は
 * 対象者がごく少数であり本ツールでは扱わない):
 *
 * 1. 障害者・未成年者・寡婦・ひとり親のいずれかに該当し、前年の合計所得金額が
 *    135万円以下(地方税法295条1項2号)。この場合、扶養親族の有無・人数に
 *    関わらず所得割・均等割の両方が非課税になる。「未成年者」は判定基準日
 *    (1月1日)時点で18歳未満の者(2022年4月の民法改正による成年年齢引下げ後)。
 * 2. 前年の合計所得金額が、同一生計配偶者・扶養親族の人数に応じた非課税限度額
 *    以下(地方税法295条3項等に基づき市区町村が条例で規定)。同一生計配偶者・
 *    扶養親族がいない場合:
 *      非課税限度額(所得割・均等割共通) = 級地係数 + 10万円
 *    同一生計配偶者・扶養親族がいる場合:
 *      均等割の非課税限度額 = 級地係数 ×(本人+同一生計配偶者+扶養親族の人数)+ 21万円 + 10万円
 *      所得割の非課税限度額 = 級地係数 ×(本人+同一生計配偶者+扶養親族の人数)+ 32万円 + 10万円
 *    (2021年度税制改正による給与所得控除等の引き下げに伴う10万円の調整を含む。
 *    大阪市「市民税・府民税・森林環境税が課税されない方」2025年12月26日更新
 *    https://www.city.osaka.lg.jp/zaisei/page/0000384084.html で確認)。
 *    所得割の非課税限度額は均等割より常に高いため、所得割のみ非課税(均等割は
 *    課税)になることはあっても、その逆(均等割のみ非課税)にはならない。
 *
 * 「級地係数」は生活保護法の級地区分に由来する自治体ごとの差異で、1級地35万円・
 * 2級地31.5万円・3級地28万円の3段階がある(政令指定都市を含むほとんどの
 * 市区町村は1級地)。均等割の標準税率(機能51)と同様に市区町村の条例次第のため、
 * この試算ではユーザー自身が居住する市区町村の級地区分を選択する方式とする。
 *
 * 扶養親族の人数には、所得税の扶養控除の対象にならない16歳未満の年少扶養親族も
 * 含めてカウントする(住民税の調整控除の人的控除額の差の計算(`src/lib/
 * residentTaxAdjustmentDeduction.ts`)や所得税の扶養控除(`src/lib/
 * dependentDeduction.ts`)とは対象人数の数え方が異なる点に注意)。
 */

export type MunicipalityGradeClass = "GRADE_1" | "GRADE_2" | "GRADE_3";

const GRADE_COEFFICIENT_JPY: Record<MunicipalityGradeClass, number> = {
  GRADE_1: 350_000,
  GRADE_2: 315_000,
  GRADE_3: 280_000,
};

export const MUNICIPALITY_GRADE_CLASS_LABEL: Record<MunicipalityGradeClass, string> = {
  GRADE_1: "1級地(35万円。政令指定都市を含む大多数の市区町村)",
  GRADE_2: "2級地(31.5万円)",
  GRADE_3: "3級地(28万円)",
};

const FLAT_ADD_ON_JPY = 100_000;
const PER_CAPITA_LEVY_DEPENDENT_ADD_ON_JPY = 210_000;
const INCOME_LEVY_DEPENDENT_ADD_ON_JPY = 320_000;

const SPECIAL_CATEGORY_INCOME_LIMIT_JPY = new Decimal(1_350_000);

export interface ResidentTaxNonTaxableInput {
  /** 判定対象年分の合計所得金額 */
  totalIncomeJpy: Decimal.Value;
  /** 同一生計配偶者・扶養親族の人数(16歳未満の年少扶養親族を含む) */
  dependentCount: number;
  /** 障害者に該当するか(本人・同一生計配偶者・扶養親族のいずれか1人でも該当すれば該当扱い) */
  disability?: boolean;
  /** 未成年者(判定基準日である1月1日時点で18歳未満)に該当するか */
  minor?: boolean;
  /** 寡婦控除・ひとり親控除の対象に該当するか */
  widowOrSingleParent?: boolean;
  /** 市区町村の級地区分。省略時は1級地(35万円)を適用する */
  gradeClass?: MunicipalityGradeClass;
}

export interface ResidentTaxNonTaxableResult {
  perCapitaLevyNonTaxable: boolean;
  incomeLevyNonTaxable: boolean;
  /** 判定2(所得金額基準)による均等割の非課税限度額 */
  perCapitaLevyThresholdJpy: Decimal;
  /** 判定2(所得金額基準)による所得割の非課税限度額 */
  incomeLevyThresholdJpy: Decimal;
  /** 判定1(障害者・未成年者・寡婦・ひとり親で135万円以下)に該当するか */
  specialCategoryApplies: boolean;
  notes: string[];
}

function requireNonNegativeInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label}は0以上の整数である必要があります`);
  }
}

export function estimateResidentTaxNonTaxable(
  input: ResidentTaxNonTaxableInput,
): ResidentTaxNonTaxableResult {
  const totalIncomeJpy = new Decimal(input.totalIncomeJpy);
  if (totalIncomeJpy.isNegative()) {
    throw new Error("合計所得金額は0以上である必要があります");
  }
  requireNonNegativeInteger(input.dependentCount, "同一生計配偶者・扶養親族の人数");

  const gradeClass = input.gradeClass ?? "GRADE_1";
  const gradeCoefficientJpy = new Decimal(GRADE_COEFFICIENT_JPY[gradeClass]);
  const headcount = input.dependentCount + 1;
  const hasDependents = input.dependentCount > 0;

  const perCapitaLevyThresholdJpy = gradeCoefficientJpy
    .times(headcount)
    .plus(FLAT_ADD_ON_JPY)
    .plus(hasDependents ? PER_CAPITA_LEVY_DEPENDENT_ADD_ON_JPY : 0);
  const incomeLevyThresholdJpy = gradeCoefficientJpy
    .times(headcount)
    .plus(FLAT_ADD_ON_JPY)
    .plus(hasDependents ? INCOME_LEVY_DEPENDENT_ADD_ON_JPY : 0);

  const isSpecialCategory = Boolean(
    input.disability || input.minor || input.widowOrSingleParent,
  );
  const specialCategoryApplies =
    isSpecialCategory && totalIncomeJpy.lessThanOrEqualTo(SPECIAL_CATEGORY_INCOME_LIMIT_JPY);

  const perCapitaLevyNonTaxable =
    specialCategoryApplies || totalIncomeJpy.lessThanOrEqualTo(perCapitaLevyThresholdJpy);
  const incomeLevyNonTaxable =
    specialCategoryApplies || totalIncomeJpy.lessThanOrEqualTo(incomeLevyThresholdJpy);

  const notes: string[] = [
    `${MUNICIPALITY_GRADE_CLASS_LABEL[gradeClass]}を前提とした概算値。級地区分は市区町村の条例で定まるため、居住する市区町村の公式情報で必ず確認すること。`,
    "扶養親族の人数には、所得税の扶養控除の対象にならない16歳未満の年少扶養親族も含めてカウントする。",
  ];
  if (isSpecialCategory) {
    notes.push(
      specialCategoryApplies
        ? "障害者・未成年者・寡婦・ひとり親のいずれかに該当し、前年の合計所得金額が135万円以下のため、所得割・均等割ともに非課税(地方税法295条1項2号)。"
        : "障害者・未成年者・寡婦・ひとり親のいずれかに該当するが、前年の合計所得金額が135万円を超えるため、この規定による非課税(地方税法295条1項2号)は適用されない(下記の所得金額基準の判定結果による)。",
    );
  }
  notes.push(
    "生活保護法の規定による生活扶助を受けている場合も非課税となるが、この試算では対象外(該当有無はユーザー自身で確認すること)。",
  );

  return {
    perCapitaLevyNonTaxable,
    incomeLevyNonTaxable,
    perCapitaLevyThresholdJpy,
    incomeLevyThresholdJpy,
    specialCategoryApplies,
    notes,
  };
}
