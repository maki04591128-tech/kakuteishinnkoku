import { Decimal } from "decimal.js";

/**
 * 住宅借入金等特別控除(住宅ローン控除)を試算する(租税特別措置法41条)。
 * 令和4年度税制改正後、令和4年(2022年)〜令和7年(2025年)に居住の用に供した
 * 場合の制度を対象とする。令和3年以前に入居した場合は控除率・借入限度額・
 * 住民税の控除限度額が異なるため対象外(令和8年以降の入居分も、本稿執筆時点で
 * 一次情報を確認できていないため対象外)。
 *
 * 控除額(所得税) = min(年末借入金残高, 借入限度額) × 0.7%(100円未満切り捨て)。
 * これを居住開始年から一定期間(住宅の区分に応じて10年間または13年間)、
 * 各年の所得税額から控除する。
 *
 * 借入限度額は次の要素で決まる(国税庁タックスアンサーNo.1211-1、
 * 国土交通省「住宅ローン減税」特設ページの公表資料に基づく)。
 *  - 居住年(令和4・5年 or 令和6・7年で新築住宅の限度額が異なる)
 *  - 住宅の区分(認定住宅、ZEH水準省エネ住宅、省エネ基準適合住宅、その他の住宅)
 *  - 新築等か既存住宅(中古)か
 *  - 子育て世帯等(19歳未満の扶養親族を有する世帯、または夫婦のいずれかが
 *    40歳未満の世帯)による令和6・7年入居限定の上乗せ措置
 *    (令和4・5年入居時点の水準まで借入限度額を引き上げる)
 *
 * 控除期間は、新築等かつ認定住宅・ZEH水準省エネ住宅・省エネ基準適合住宅の
 * いずれかに該当する場合は13年間、それ以外(新築等の「その他の住宅」・
 * 既存住宅)は10年間。
 *
 * 簡略化している点(今後の課題):
 *  - 床面積40㎡以上50㎡未満の特例(合計所得金額1,000万円以下・令和5年12月31日
 *    までの建築確認が条件)は対象外とし、床面積50㎡以上の住宅のみを前提とする。
 *  - 新築等の「その他の住宅」で、令和5年12月31日までに建築確認を受けた場合の
 *    経過措置(令和6・7年入居でも借入限度額2,000万円・控除期間10年)は対象外とし、
 *    令和6・7年入居の「その他の住宅」は一律で対象外(借入限度額0円)として扱う。
 *  - 「買取再販住宅」固有の限度額差異(認定住宅等以外の区分で新築と異なる場合が
 *    ある)は反映せず、新築住宅と同じ限度額として扱う。
 *  - 子育て世帯等に該当するかどうかの判定(年齢・扶養親族の有無)はユーザー自身が
 *    行う前提とし、本モジュールは入力されたフラグをそのまま使う。既存住宅
 *    (中古)にはこの上乗せ措置は適用されないという前提で実装している。
 *  - 住民税からの控除限度額(課税総所得金額等の5%、上限9万7,500円)は目安として
 *    算出するが、実際に住民税から控除される額(所得税から控除しきれなかった額と
 *    この限度額のいずれか少ない方)の算出には、住宅ローン控除適用前の所得税額の
 *    入力が必要(未入力の場合は限度額のみを表示する)。
 *  - 連帯債務・共有名義の場合の持分按分は考慮しない(年末残高は本人負担分の
 *    金額を入力する前提)。
 */

export type HousingCategory = "CERTIFIED" | "ZEH" | "ENERGY_SAVING" | "OTHER";

export const HOUSING_CATEGORY_LABEL: Record<HousingCategory, string> = {
  CERTIFIED: "認定住宅(認定長期優良住宅・認定低炭素住宅)",
  ZEH: "ZEH水準省エネ住宅",
  ENERGY_SAVING: "省エネ基準適合住宅",
  OTHER: "その他の住宅(省エネ基準への適合なし)",
};

/** 控除率(年末借入金残高等に乗じる率) */
export const MORTGAGE_DEDUCTION_RATE = new Decimal(0.007);

/** 合計所得金額の要件(これを超える年は控除の適用を受けられない) */
const TOTAL_INCOME_LIMIT_JPY = new Decimal(20_000_000);

/** 住民税の控除限度額(課税総所得金額等の5%、上限9万7,500円。令和4年以降入居) */
const RESIDENT_TAX_CREDIT_RATE = new Decimal(0.05);
const RESIDENT_TAX_CREDIT_MAX_JPY = new Decimal(97_500);

const NEW_BUILD_LIMITS_R4_R5: Record<HousingCategory, number> = {
  CERTIFIED: 50_000_000,
  ZEH: 45_000_000,
  ENERGY_SAVING: 40_000_000,
  OTHER: 30_000_000,
};

const NEW_BUILD_LIMITS_R6_R7: Record<HousingCategory, number> = {
  CERTIFIED: 45_000_000,
  ZEH: 35_000_000,
  ENERGY_SAVING: 30_000_000,
  // 経過措置(令和5年末までの建築確認等)を除き対象外
  OTHER: 0,
};

// 令和6・7年入居の子育て世帯等向け上乗せ措置(令和4・5年入居時点の水準を維持)。
// 「その他の住宅」は上乗せ措置の対象外。
const CHILD_REARING_BONUS_LIMITS_R6_R7: Partial<Record<HousingCategory, number>> = {
  CERTIFIED: 50_000_000,
  ZEH: 45_000_000,
  ENERGY_SAVING: 40_000_000,
};

const EXISTING_HOME_LIMITS: Record<"CERTIFIED_OR_ENERGY_SAVING" | "OTHER", number> = {
  CERTIFIED_OR_ENERGY_SAVING: 30_000_000,
  OTHER: 20_000_000,
};

export interface MortgageDeductionInput {
  /** 試算対象の年分(暦年) */
  taxYear: number;
  /** 居住を開始した年(暦年。令和4年=2022年〜令和7年=2025年のみ対応) */
  moveInYear: number;
  /** 住宅の区分(省エネ性能等) */
  housingCategory: HousingCategory;
  /** 既存住宅(中古)の取得かどうか(false=新築等・買取再販) */
  isExistingHome: boolean;
  /** 子育て世帯等(令和6・7年入居の新築等のみ上乗せ措置の対象) */
  isChildRearingHousehold?: boolean;
  /** その年の年末借入金残高 */
  yearEndLoanBalanceJpy: Decimal.Value;
  /** その年の合計所得金額(2,000万円超の年は適用不可) */
  totalIncomeJpy: Decimal.Value;
  /**
   * 住民税の課税総所得金額等。指定すると住民税の控除限度額の目安を算出する。
   * 未指定の場合は住民税側の試算を省略する。
   */
  residentTaxTaxableIncomeJpy?: Decimal.Value;
  /**
   * その年分の所得税額(住宅ローン控除適用前)。指定すると、所得税から
   * 控除しきれず住民税へ回る額(住民税の控除限度額が上限)まで試算する。
   * 未指定の場合は住民税の控除限度額の目安のみを算出する。
   */
  nationalIncomeTaxBeforeThisCreditJpy?: Decimal.Value;
}

export interface MortgageDeductionResult {
  /** 適用可否(false の場合、控除額はすべて0円) */
  eligible: boolean;
  /** 適用不可の場合の理由(該当する場合のみ) */
  ineligibleReason?: string;
  /** 借入限度額 */
  borrowingLimitJpy: Decimal;
  /** 控除期間(年数。10年または13年) */
  controlPeriodYears: number;
  /** 控除期間の最終年(居住開始年 + 控除期間 - 1) */
  controlPeriodEndYear: number;
  /** 控除対象借入金残高(年末借入金残高と借入限度額のいずれか少ない方) */
  deductibleBalanceJpy: Decimal;
  /** その年分の所得税の控除額(100円未満切り捨て) */
  nationalTaxCreditJpy: Decimal;
  /** 住民税の控除限度額の目安(課税総所得金額等の5%、上限9万7,500円) */
  residentTaxCreditLimitJpy?: Decimal;
  /** 所得税から控除しきれず住民税から控除される額(住民税の控除限度額が上限) */
  residentTaxCreditJpy?: Decimal;
  notes: string[];
}

function requireNonNegative(value: Decimal, label: string): void {
  if (value.isNegative()) {
    throw new Error(`${label}は0以上である必要があります`);
  }
}

/** 100円未満切り捨て(租税特別措置法施行規則の端数処理) */
function floorToHundredYen(value: Decimal): Decimal {
  return value.dividedBy(100).floor().times(100);
}

function resolveBorrowingLimitJpy(
  moveInYear: number,
  housingCategory: HousingCategory,
  isExistingHome: boolean,
  isChildRearingHousehold: boolean,
): Decimal {
  if (isExistingHome) {
    return new Decimal(
      housingCategory === "OTHER"
        ? EXISTING_HOME_LIMITS.OTHER
        : EXISTING_HOME_LIMITS.CERTIFIED_OR_ENERGY_SAVING,
    );
  }

  if (moveInYear === 2022 || moveInYear === 2023) {
    return new Decimal(NEW_BUILD_LIMITS_R4_R5[housingCategory]);
  }

  if (moveInYear === 2024 || moveInYear === 2025) {
    if (isChildRearingHousehold) {
      const bonus = CHILD_REARING_BONUS_LIMITS_R6_R7[housingCategory];
      if (bonus !== undefined) return new Decimal(bonus);
    }
    return new Decimal(NEW_BUILD_LIMITS_R6_R7[housingCategory]);
  }

  throw new Error(
    `居住年${moveInYear}年は未対応(令和4年(2022年)〜令和7年(2025年)入居のみ対応)`,
  );
}

function controlPeriodYears(housingCategory: HousingCategory, isExistingHome: boolean): number {
  if (isExistingHome) return 10;
  return housingCategory === "OTHER" ? 10 : 13;
}

export function calculateMortgageDeduction(
  input: MortgageDeductionInput,
): MortgageDeductionResult {
  const yearEndLoanBalanceJpy = new Decimal(input.yearEndLoanBalanceJpy);
  const totalIncomeJpy = new Decimal(input.totalIncomeJpy);
  const isChildRearingHousehold = input.isChildRearingHousehold ?? false;

  requireNonNegative(yearEndLoanBalanceJpy, "年末借入金残高");
  requireNonNegative(totalIncomeJpy, "合計所得金額");

  if (input.moveInYear < 2022 || input.moveInYear > 2025) {
    throw new Error(
      "居住年は令和4年(2022年)〜令和7年(2025年)の範囲で入力してください(本ツールは令和8年以降の入居に未対応)",
    );
  }

  const borrowingLimitJpy = resolveBorrowingLimitJpy(
    input.moveInYear,
    input.housingCategory,
    input.isExistingHome,
    isChildRearingHousehold,
  );
  const periodYears = controlPeriodYears(input.housingCategory, input.isExistingHome);
  const controlPeriodEndYear = input.moveInYear + periodYears - 1;

  const notes: string[] = [
    "国税庁タックスアンサーNo.1211-1・国土交通省の公表資料に基づく概算値。実際の適用には登記事項証明書・住宅取得資金に係る借入金の年末残高等証明書等の確認が必要。",
    "床面積50㎡以上の住宅を前提とする(40㎡以上50㎡未満の特例は未対応)。",
    "連帯債務・共有名義の場合の持分按分は考慮していないため、年末借入金残高は本人負担分の金額を入力すること。",
  ];

  let eligible = true;
  let ineligibleReason: string | undefined;

  if (totalIncomeJpy.greaterThan(TOTAL_INCOME_LIMIT_JPY)) {
    eligible = false;
    ineligibleReason = "合計所得金額が2,000万円を超えるため、その年は適用を受けられない。";
  } else if (borrowingLimitJpy.isZero()) {
    eligible = false;
    ineligibleReason =
      "この居住年・住宅区分の組み合わせでは借入限度額が0円(対象外)。省エネ基準への適合状況を確認すること(令和6・7年入居の「その他の住宅」は原則対象外)。";
  } else if (input.taxYear < input.moveInYear || input.taxYear > controlPeriodEndYear) {
    eligible = false;
    ineligibleReason = `控除期間(${input.moveInYear}年〜${controlPeriodEndYear}年)の対象外の年分。`;
  }

  const deductibleBalanceJpy = eligible
    ? Decimal.min(yearEndLoanBalanceJpy, borrowingLimitJpy)
    : new Decimal(0);
  const nationalTaxCreditJpy = eligible
    ? floorToHundredYen(deductibleBalanceJpy.times(MORTGAGE_DEDUCTION_RATE))
    : new Decimal(0);

  let residentTaxCreditLimitJpy: Decimal | undefined;
  let residentTaxCreditJpy: Decimal | undefined;
  if (input.residentTaxTaxableIncomeJpy !== undefined) {
    const residentTaxTaxableIncomeJpy = new Decimal(input.residentTaxTaxableIncomeJpy);
    requireNonNegative(residentTaxTaxableIncomeJpy, "住民税の課税総所得金額等");
    residentTaxCreditLimitJpy = Decimal.min(
      floorToHundredYen(residentTaxTaxableIncomeJpy.times(RESIDENT_TAX_CREDIT_RATE)),
      RESIDENT_TAX_CREDIT_MAX_JPY,
    );

    if (input.nationalIncomeTaxBeforeThisCreditJpy !== undefined) {
      const nationalIncomeTaxBeforeThisCreditJpy = new Decimal(
        input.nationalIncomeTaxBeforeThisCreditJpy,
      );
      requireNonNegative(
        nationalIncomeTaxBeforeThisCreditJpy,
        "所得税額(住宅ローン控除適用前)",
      );
      const shortfallJpy = Decimal.max(
        nationalTaxCreditJpy.minus(nationalIncomeTaxBeforeThisCreditJpy),
        0,
      );
      residentTaxCreditJpy = Decimal.min(shortfallJpy, residentTaxCreditLimitJpy);
    } else {
      notes.push(
        "所得税額(住宅ローン控除適用前)を入力すると、所得税から控除しきれず住民税へ回る額も試算する。",
      );
    }
  } else {
    notes.push(
      "住民税の課税総所得金額等を入力すると、住民税の控除限度額(課税総所得金額等の5%、上限9万7,500円)の目安を表示する。",
    );
  }

  if (isChildRearingHousehold && (input.moveInYear < 2024 || input.moveInYear > 2025)) {
    notes.push(
      "子育て世帯等向けの借入限度額の上乗せ措置は令和6・7年(2024・2025年)入居分のみが対象のため、この居住年には反映していない。",
    );
  }
  if (isChildRearingHousehold && input.isExistingHome) {
    notes.push("子育て世帯等向けの上乗せ措置は新築等(買取再販を含む)が対象で、既存住宅(中古)には適用していない。");
  }

  return {
    eligible,
    ineligibleReason,
    borrowingLimitJpy,
    controlPeriodYears: periodYears,
    controlPeriodEndYear,
    deductibleBalanceJpy,
    nationalTaxCreditJpy,
    residentTaxCreditLimitJpy,
    residentTaxCreditJpy,
    notes,
  };
}
