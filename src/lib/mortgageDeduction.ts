import { Decimal } from "decimal.js";
import { prisma } from "./db";

/**
 * 住宅借入金等特別控除(住宅ローン控除)を試算する(租税特別措置法41条)。
 * 令和4年度税制改正後、令和4年(2022年)〜令和12年(2030年)に居住の用に供した
 * 場合の制度を対象とする。令和3年以前に入居した場合は控除率・借入限度額・
 * 住民税の控除限度額が異なるため対象外。
 *
 * 控除額(所得税) = min(年末借入金残高, 借入限度額) × 0.7%(100円未満切り捨て)。
 * これを居住開始年から一定期間(住宅の区分に応じて10年間または13年間)、
 * 各年の所得税額から控除する。
 *
 * 借入限度額は次の要素で決まる(国税庁タックスアンサーNo.1211-1、
 * 国土交通省「住宅ローン減税」特設ページの公表資料に基づく)。
 *  - 居住年(令和4・5年/令和6・7年/令和8〜12年で新築住宅の限度額が異なる)
 *  - 住宅の区分(認定住宅、ZEH水準省エネ住宅、省エネ基準適合住宅、その他の住宅)
 *  - 新築等か既存住宅(中古)か
 *  - 子育て世帯等(19歳未満の扶養親族を有する世帯、または夫婦のいずれかが
 *    40歳未満の世帯)による上乗せ措置(令和6年(2024年)入居分の新築等から導入。
 *    令和8年(2026年)入居分からは既存住宅(中古)にも拡大)
 *
 * 控除期間は、新築等かつ認定住宅・ZEH水準省エネ住宅・省エネ基準適合住宅の
 * いずれかに該当する場合は13年間、それ以外(新築等の「その他の住宅」・
 * 令和4〜7年入居の既存住宅)は10年間。令和8年(2026年)以降入居の既存住宅は
 * 「その他の住宅」を除き控除期間が13年間に拡充される。
 *
 * 床面積40㎡以上50㎡未満の特例(isSmallFloorArea)は、新築等(既存住宅・買取再販を除く)
 * の場合に限り、合計所得金額の上限を2,000万円ではなく1,000万円として判定する
 * (租税特別措置法41条11項)。建築確認を受けた期限(公表資料により令和5年12月31日を
 * 基本としつつ、令和6年度税制改正で延長された可能性があるという情報もあり一次情報で
 * 確定できていない)はこのモジュールでは判定せず、ユーザー自身が対象年分に該当するか
 * 確認する前提とする。令和8年(2026年)以降入居分は、国土交通省「令和8年度住宅税制
 * 改正概要」により床面積40㎡以上が恒久的な要件になった(期限付きの建築確認要件は
 * 撤廃)。ただし合計所得金額が1,000万円を超える者、または子育て世帯等向けの
 * 上乗せ措置を利用する者は引き続き床面積50㎡以上が必要なため、令和8年以降の
 * 入居分で`isSmallFloorArea`と`isChildRearingHousehold`をともに指定した場合は
 * 要件を満たさないものとして適用対象外(eligible=false)を返す。
 *
 * 新築等の「その他の住宅」(省エネ基準への適合なし)で令和6年(2024年)以降に入居した
 * 場合、原則は住宅ローン控除の対象外(借入限度額0円)だが、令和5年12月31日までに
 * 建築確認を受けた場合、または令和6年6月30日までに建築された場合は、経過措置として
 * 借入限度額2,000万円・控除期間10年で控除の対象になる(租税特別措置法等改正附則。
 * 国土交通省の公表資料により、この経過措置は入居年を問わず建築確認日・建築日の
 * 期限のみで判定されることを確認した)。`otherHousingTransitionalMeasure`をtrueに
 * すると、この経過措置を適用したものとして借入限度額2,000万円で計算する。建築確認日・
 * 建築日がこの期限内かどうかの判定自体は(床面積40㎡以上50㎡未満の特例と同様)この
 * モジュールでは行わないため、ユーザー自身が確認する前提とする。
 *
 * 令和8年度税制改正(令和7年12月19日与党公表、国土交通省「令和8年度住宅税制改正
 * 概要」・住宅ローン減税特設ページの公表資料に基づく)により、令和8年(2026年)〜
 * 令和12年(2030年)入居分は次のとおり借入限度額・控除期間が変わる。
 *  - 新築等の認定長期優良住宅・認定低炭素住宅(CERTIFIED): 4,500万円
 *    (子育て世帯等5,000万円)・控除期間13年間(全期間を通じて一定)。
 *  - 新築等のZEH水準省エネ住宅(ZEH): 3,500万円(子育て世帯等4,500万円)・
 *    控除期間13年間。
 *  - 新築等の省エネ基準適合住宅(ENERGY_SAVING): 令和8・9年(2026・2027年)入居分は
 *    2,000万円(子育て世帯等3,000万円)・控除期間13年間。令和10年(2028年)以降入居分は
 *    原則対象外(借入限度額0円)になるが、令和9年(2027年)末までに建築確認を受けた
 *    住宅、または令和10年6月30日までに建築された住宅は、経過措置として借入限度額
 *    2,000万円・控除期間10年(子育て世帯等の上乗せなし)で控除の対象になる。
 *    `energySavingTransitionalMeasure`をtrueにするとこの経過措置を適用する
 *    (建築確認日・建築日の期限内かどうかの判定はユーザー自身が行う前提とする)。
 *  - 既存住宅(中古)は令和8年(2026年)以降、住宅の区分ごとに新築等と近い枠組みが
 *    導入される。認定長期優良住宅・認定低炭素住宅・ZEH水準省エネ住宅は3,500万円
 *    (子育て世帯等4,500万円)、省エネ基準適合住宅は2,000万円(子育て世帯等3,000万円)、
 *    それぞれ控除期間13年間。「その他の住宅」は従来どおり2,000万円・控除期間10年
 *    (子育て世帯等の上乗せなし)。令和4〜7年入居の既存住宅(区分によらず一律の
 *    限度額・控除期間10年、子育て世帯等の上乗せなし)とは異なる制度である点に注意。
 *  - 令和10年(2028年)以降入居分の新築住宅は、土砂災害特別警戒区域等の
 *    「災害レッドゾーン」に所在する場合、住宅ローン控除の対象外になる(建替え・
 *    既存住宅・リフォームは対象)。この判定はこのモジュールでは行わないため、
 *    該当の可能性がある場合はユーザー自身が確認すること。
 *
 * 簡略化している点(今後の課題):
 *  - 「買取再販住宅」固有の限度額差異(認定住宅等以外の区分で新築と異なる場合が
 *    ある)は反映せず、新築住宅と同じ限度額として扱う。
 *  - 子育て世帯等に該当するかどうかの判定(年齢・扶養親族の有無)はユーザー自身が
 *    行う前提とし、本モジュールは入力されたフラグをそのまま使う。
 *  - 令和10年(2028年)以降入居分の新築住宅における「災害レッドゾーン」要件は、
 *    上記のとおり判定を行わない(ユーザー自身の確認事項)。
 *  - 住民税からの控除限度額(課税総所得金額等の5%、上限9万7,500円)は目安として
 *    算出するが、実際に住民税から控除される額(所得税から控除しきれなかった額と
 *    この限度額のいずれか少ない方)の算出には、住宅ローン控除適用前の所得税額の
 *    入力が必要(未入力の場合は限度額のみを表示する)。
 *  - 連帯債務(共有名義)の場合、`jointDebtShareRatioPercent`(本人の負担割合)を
 *    指定すると、`yearEndLoanBalanceJpy`(連帯債務者全員分の年末残高の合計額)に
 *    その割合を乗じた額を本人の年末残高とみなして計算する(国税庁タックスアンサー
 *    No.1234)。負担割合は連帯債務者間の合意で定める割合で、実務上は持分登記割合や
 *    出資割合と一致させることが多いが、この判定自体はユーザー自身が行う前提とする。
 *    未指定の場合は従来どおり`yearEndLoanBalanceJpy`を本人負担分の金額として扱う。
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

/** 床面積40㎡以上50㎡未満の特例を適用する場合の合計所得金額の要件(通常より厳しい) */
const SMALL_FLOOR_AREA_TOTAL_INCOME_LIMIT_JPY = new Decimal(10_000_000);

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
  // 経過措置(otherHousingTransitionalMeasure)の対象でなければ0円(対象外)
  OTHER: 0,
};

/** 「その他の住宅」の経過措置(令和6・7年入居)を適用する場合の借入限度額 */
const OTHER_HOUSING_TRANSITIONAL_MEASURE_LIMIT_JPY = 20_000_000;

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

/**
 * 令和8年(2026年)〜令和12年(2030年)入居分の新築等の借入限度額。
 * 省エネ基準適合住宅(ENERGY_SAVING)は令和8・9年(2026・2027年)入居分のみに適用し、
 * 令和10年(2028年)以降入居分は`resolveBorrowingLimitJpy`側で別途0円(経過措置適用時は
 * `ENERGY_SAVING_TRANSITIONAL_MEASURE_LIMIT_JPY`)として扱う。
 */
const NEW_BUILD_LIMITS_R8_R12: Record<HousingCategory, number> = {
  CERTIFIED: 45_000_000,
  ZEH: 35_000_000,
  ENERGY_SAVING: 20_000_000,
  OTHER: 0,
};

// 令和8年(2026年)〜令和12年(2030年)入居の子育て世帯等向け上乗せ措置。
// 「その他の住宅」は上乗せ措置の対象外。ENERGY_SAVINGは令和8・9年入居分のみ
// (令和10年以降入居分の経過措置には上乗せ措置は適用されない)。
const CHILD_REARING_BONUS_LIMITS_R8_R12: Partial<Record<HousingCategory, number>> = {
  CERTIFIED: 50_000_000,
  ZEH: 45_000_000,
  ENERGY_SAVING: 30_000_000,
};

/**
 * 新築等の省エネ基準適合住宅で令和10年(2028年)以降に入居する場合の経過措置
 * (令和9年(2027年)末までの建築確認、または令和10年6月30日までの建築)の借入限度額。
 * 子育て世帯等向けの上乗せ措置は適用されない。
 */
const ENERGY_SAVING_TRANSITIONAL_MEASURE_LIMIT_JPY = 20_000_000;

/** 令和8年(2026年)〜令和12年(2030年)入居分の既存住宅(中古)の借入限度額 */
const EXISTING_HOME_LIMITS_R8_R12: Record<HousingCategory, number> = {
  CERTIFIED: 35_000_000,
  ZEH: 35_000_000,
  ENERGY_SAVING: 20_000_000,
  OTHER: 20_000_000,
};

// 令和8年(2026年)〜令和12年(2030年)入居の既存住宅(中古)向け子育て世帯等の
// 上乗せ措置(令和4〜7年入居の既存住宅には存在しなかった、令和8年度税制改正での
// 新設措置)。「その他の住宅」は対象外。
const CHILD_REARING_BONUS_EXISTING_HOME_LIMITS_R8_R12: Partial<Record<HousingCategory, number>> =
  {
    CERTIFIED: 45_000_000,
    ZEH: 45_000_000,
    ENERGY_SAVING: 30_000_000,
  };

function isR8ToR12MoveIn(moveInYear: number): boolean {
  return moveInYear >= 2026 && moveInYear <= 2030;
}

export interface MortgageDeductionInput {
  /** 試算対象の年分(暦年) */
  taxYear: number;
  /** 居住を開始した年(暦年。令和4年=2022年〜令和12年=2030年のみ対応) */
  moveInYear: number;
  /** 住宅の区分(省エネ性能等) */
  housingCategory: HousingCategory;
  /** 既存住宅(中古)の取得かどうか(false=新築等・買取再販) */
  isExistingHome: boolean;
  /**
   * 子育て世帯等(令和6年(2024年)以降入居の新築等、または令和8年(2026年)以降
   * 入居の既存住宅(中古)が上乗せ措置の対象。「その他の住宅」・令和10年(2028年)
   * 以降入居の省エネ基準適合住宅の経過措置には適用されない)
   */
  isChildRearingHousehold?: boolean;
  /**
   * 床面積40㎡以上50㎡未満の特例の対象かどうか(新築等のみ。既存住宅は対象外)。
   * trueの場合、合計所得金額の要件が2,000万円ではなく1,000万円になる。
   * 建築確認を受けた期限の判定はこのモジュールでは行わないため、対象年分に
   * 該当するかはユーザー自身が確認すること。
   */
  isSmallFloorArea?: boolean;
  /**
   * 新築等の「その他の住宅」(省エネ基準への適合なし)で令和6年(2024年)以降入居の
   * 場合に、経過措置(令和5年12月31日までの建築確認、または令和6年6月30日までの建築)の
   * 対象となるかどうか。trueの場合、本来は対象外(借入限度額0円)となるところを
   * 借入限度額2,000万円・控除期間10年として計算する。建築確認日・建築日がこの期限内かは
   * このモジュールでは判定しないため、ユーザー自身が確認すること(他の住宅区分・
   * 既存住宅・令和4・5年入居分には影響しない)。
   */
  otherHousingTransitionalMeasure?: boolean;
  /**
   * 新築等の省エネ基準適合住宅で令和10年(2028年)以降(2028〜2030年)に入居する場合に、
   * 経過措置(令和9年(2027年)末までの建築確認、または令和10年6月30日までの建築)の
   * 対象となるかどうか。trueの場合、本来は対象外(借入限度額0円)となるところを
   * 借入限度額2,000万円・控除期間10年(子育て世帯等の上乗せなし)として計算する。
   * 建築確認日・建築日がこの期限内かはこのモジュールでは判定しないため、ユーザー
   * 自身が確認すること(他の住宅区分・既存住宅・令和9年(2027年)以前入居分には
   * 影響しない)。
   */
  energySavingTransitionalMeasure?: boolean;
  /**
   * その年の年末借入金残高。`jointDebtShareRatioPercent`を指定する場合は、
   * 連帯債務者全員分の年末残高の合計額を入力する(本人負担分への按分は
   * 自動計算する)。指定しない場合は、従来どおり本人負担分の金額を入力する。
   */
  yearEndLoanBalanceJpy: Decimal.Value;
  /**
   * 連帯債務(共有名義)による持分按分を行う場合の、本人の債務負担割合(%。
   * 0より大きく100以下)。指定すると`yearEndLoanBalanceJpy`(合計額)に
   * この割合を乗じた額を本人の年末残高として計算する。単独債務の場合は
   * 指定不要(未指定)。
   */
  jointDebtShareRatioPercent?: Decimal.Value;
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
  /**
   * 本人の年末借入金残高(連帯債務の場合は`yearEndLoanBalanceJpy`に
   * `jointDebtShareRatioPercent`を乗じた按分後の金額。単独債務の場合は
   * `yearEndLoanBalanceJpy`と同じ)。
   */
  ownYearEndLoanBalanceJpy: Decimal;
  /** 控除対象借入金残高(本人の年末借入金残高と借入限度額のいずれか少ない方) */
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
  otherHousingTransitionalMeasure: boolean,
  energySavingTransitionalMeasure: boolean,
): Decimal {
  if (isExistingHome) {
    if (isR8ToR12MoveIn(moveInYear)) {
      if (isChildRearingHousehold) {
        const bonus = CHILD_REARING_BONUS_EXISTING_HOME_LIMITS_R8_R12[housingCategory];
        if (bonus !== undefined) return new Decimal(bonus);
      }
      return new Decimal(EXISTING_HOME_LIMITS_R8_R12[housingCategory]);
    }
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
    if (housingCategory === "OTHER" && otherHousingTransitionalMeasure) {
      return new Decimal(OTHER_HOUSING_TRANSITIONAL_MEASURE_LIMIT_JPY);
    }
    return new Decimal(NEW_BUILD_LIMITS_R6_R7[housingCategory]);
  }

  if (isR8ToR12MoveIn(moveInYear)) {
    if (housingCategory === "OTHER") {
      return otherHousingTransitionalMeasure
        ? new Decimal(OTHER_HOUSING_TRANSITIONAL_MEASURE_LIMIT_JPY)
        : new Decimal(0);
    }
    if (housingCategory === "ENERGY_SAVING" && moveInYear >= 2028) {
      return energySavingTransitionalMeasure
        ? new Decimal(ENERGY_SAVING_TRANSITIONAL_MEASURE_LIMIT_JPY)
        : new Decimal(0);
    }
    if (isChildRearingHousehold) {
      const bonus = CHILD_REARING_BONUS_LIMITS_R8_R12[housingCategory];
      if (bonus !== undefined) return new Decimal(bonus);
    }
    return new Decimal(NEW_BUILD_LIMITS_R8_R12[housingCategory]);
  }

  throw new Error(
    `居住年${moveInYear}年は未対応(令和4年(2022年)〜令和12年(2030年)入居のみ対応)`,
  );
}

function controlPeriodYears(
  moveInYear: number,
  housingCategory: HousingCategory,
  isExistingHome: boolean,
): number {
  if (isExistingHome) {
    if (isR8ToR12MoveIn(moveInYear)) {
      return housingCategory === "OTHER" ? 10 : 13;
    }
    return 10;
  }
  if (housingCategory === "OTHER") return 10;
  if (isR8ToR12MoveIn(moveInYear) && housingCategory === "ENERGY_SAVING" && moveInYear >= 2028) {
    // 経過措置(energySavingTransitionalMeasure)適用時の控除期間。対象外の場合は
    // borrowingLimitJpyが0円になりeligible=falseで返る。
    return 10;
  }
  return 13;
}

export function calculateMortgageDeduction(
  input: MortgageDeductionInput,
): MortgageDeductionResult {
  const yearEndLoanBalanceJpy = new Decimal(input.yearEndLoanBalanceJpy);
  const totalIncomeJpy = new Decimal(input.totalIncomeJpy);
  const isChildRearingHousehold = input.isChildRearingHousehold ?? false;
  const isSmallFloorArea = input.isSmallFloorArea ?? false;
  const otherHousingTransitionalMeasure = input.otherHousingTransitionalMeasure ?? false;
  const energySavingTransitionalMeasure = input.energySavingTransitionalMeasure ?? false;

  requireNonNegative(yearEndLoanBalanceJpy, "年末借入金残高");
  requireNonNegative(totalIncomeJpy, "合計所得金額");

  if (input.moveInYear < 2022 || input.moveInYear > 2030) {
    throw new Error(
      "居住年は令和4年(2022年)〜令和12年(2030年)の範囲で入力してください(本ツールは令和13年以降の入居に未対応)",
    );
  }

  const borrowingLimitJpy = resolveBorrowingLimitJpy(
    input.moveInYear,
    input.housingCategory,
    input.isExistingHome,
    isChildRearingHousehold,
    otherHousingTransitionalMeasure,
    energySavingTransitionalMeasure,
  );
  const periodYears = controlPeriodYears(
    input.moveInYear,
    input.housingCategory,
    input.isExistingHome,
  );
  const controlPeriodEndYear = input.moveInYear + periodYears - 1;
  const floorAreaBonusConflict =
    isSmallFloorArea &&
    isChildRearingHousehold &&
    !input.isExistingHome &&
    isR8ToR12MoveIn(input.moveInYear);

  const notes: string[] = [
    "国税庁タックスアンサーNo.1211-1・国土交通省の公表資料に基づく概算値。実際の適用には登記事項証明書・住宅取得資金に係る借入金の年末残高等証明書等の確認が必要。",
  ];

  let ownYearEndLoanBalanceJpy = yearEndLoanBalanceJpy;
  if (input.jointDebtShareRatioPercent !== undefined) {
    const jointDebtShareRatioPercent = new Decimal(input.jointDebtShareRatioPercent);
    if (
      jointDebtShareRatioPercent.lessThanOrEqualTo(0) ||
      jointDebtShareRatioPercent.greaterThan(100)
    ) {
      throw new Error("連帯債務の負担割合は0%超100%以下で入力してください");
    }
    ownYearEndLoanBalanceJpy = yearEndLoanBalanceJpy
      .times(jointDebtShareRatioPercent)
      .dividedBy(100);
    notes.push(
      `連帯債務(共有名義)の負担割合${jointDebtShareRatioPercent}%により、年末残高の合計額を本人の年末残高${ownYearEndLoanBalanceJpy.toFixed(0)}円に按分して計算した(国税庁タックスアンサーNo.1234)。負担割合は連帯債務者間の合意で定める割合で、実務上は持分登記割合・出資割合と一致させることが多い。`,
    );
  } else {
    notes.push(
      "連帯債務(共有名義)の場合は、年末借入金残高に連帯債務者全員分の合計額を入力したうえで本人の負担割合(%)を指定すると、本人負担分への按分を自動計算する。未指定の場合、年末借入金残高は本人負担分の金額を入力すること。",
    );
  }

  if (isSmallFloorArea) {
    if (input.isExistingHome) {
      notes.push(
        "床面積40㎡以上50㎡未満の特例は新築等(買取再販住宅・既存住宅を除く)のみが対象のため、既存住宅(中古)にチェックした場合は反映していない。",
      );
    } else if (isR8ToR12MoveIn(input.moveInYear)) {
      notes.push(
        "令和8年(2026年)以降入居分は床面積40㎡以上が恒久的な要件になったため、期限付きの建築確認要件はない。ただし合計所得金額が1,000万円を超える場合、または子育て世帯等向けの上乗せ措置を利用する場合は床面積50㎡以上が必要なため、合計所得金額の要件を2,000万円ではなく1,000万円として判定している。",
      );
    } else {
      notes.push(
        "床面積40㎡以上50㎡未満の特例により、合計所得金額の要件を2,000万円ではなく1,000万円として判定している。建築確認を受けた期限の要件(一次情報での期限確認ができていないため本ツールでは判定しない)は自身で確認すること。",
      );
    }
  } else {
    notes.push("床面積50㎡以上の住宅を前提とする(40㎡以上50㎡未満の特例は入力欄から選択可能)。");
  }

  const applySmallFloorAreaLimit = isSmallFloorArea && !input.isExistingHome;
  const totalIncomeLimitJpy = applySmallFloorAreaLimit
    ? SMALL_FLOOR_AREA_TOTAL_INCOME_LIMIT_JPY
    : TOTAL_INCOME_LIMIT_JPY;

  let eligible = true;
  let ineligibleReason: string | undefined;

  if (floorAreaBonusConflict) {
    eligible = false;
    ineligibleReason =
      "令和8年(2026年)以降入居分は、子育て世帯等向けの上乗せ措置を利用する場合、床面積50㎡以上が必要なため、床面積40㎡以上50㎡未満の特例とは同時に適用できない。";
  } else if (totalIncomeJpy.greaterThan(totalIncomeLimitJpy)) {
    eligible = false;
    ineligibleReason = applySmallFloorAreaLimit
      ? "床面積40㎡以上50㎡未満の特例は合計所得金額が1,000万円を超える年は適用を受けられない。"
      : "合計所得金額が2,000万円を超えるため、その年は適用を受けられない。";
  } else if (borrowingLimitJpy.isZero()) {
    eligible = false;
    ineligibleReason =
      "この居住年・住宅区分の組み合わせでは借入限度額が0円(対象外)。省エネ基準への適合状況を確認すること(令和6年(2024年)以降入居の「その他の住宅」・令和10年(2028年)以降入居の省エネ基準適合住宅は原則対象外)。";
  } else if (input.taxYear < input.moveInYear || input.taxYear > controlPeriodEndYear) {
    eligible = false;
    ineligibleReason = `控除期間(${input.moveInYear}年〜${controlPeriodEndYear}年)の対象外の年分。`;
  }

  const deductibleBalanceJpy = eligible
    ? Decimal.min(ownYearEndLoanBalanceJpy, borrowingLimitJpy)
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

  if (isChildRearingHousehold && input.isExistingHome && !isR8ToR12MoveIn(input.moveInYear)) {
    notes.push(
      "子育て世帯等向けの上乗せ措置は既存住宅(中古)の場合、令和8年(2026年)以降入居分から対象になる制度のため、この居住年には反映していない(令和4〜7年入居の既存住宅には存在しない措置)。",
    );
  }
  if (
    isChildRearingHousehold &&
    !input.isExistingHome &&
    (input.moveInYear === 2022 || input.moveInYear === 2023)
  ) {
    notes.push(
      "子育て世帯等向けの借入限度額の上乗せ措置は令和6年(2024年)入居分以降の新築等の制度のため、この居住年には反映していない。",
    );
  }
  if (
    isChildRearingHousehold &&
    !input.isExistingHome &&
    input.housingCategory === "ENERGY_SAVING" &&
    isR8ToR12MoveIn(input.moveInYear) &&
    input.moveInYear >= 2028
  ) {
    notes.push(
      "省エネ基準適合住宅は令和10年(2028年)以降入居分では原則対象外となり、経過措置(借入限度額2,000万円・控除期間10年)にも子育て世帯等向けの上乗せ措置は適用されないため、反映していない。",
    );
  }
  if (isChildRearingHousehold && !input.isExistingHome && input.housingCategory === "OTHER") {
    notes.push("子育て世帯等向けの上乗せ措置は「その他の住宅」には適用されない(引き続き対象外)。");
  }

  const otherHousingTransitionalMeasureApplicable =
    !input.isExistingHome && input.housingCategory === "OTHER" && input.moveInYear >= 2024;
  if (otherHousingTransitionalMeasure && otherHousingTransitionalMeasureApplicable) {
    notes.push(
      "新築等の「その他の住宅」の経過措置(令和5年12月31日までの建築確認、または令和6年6月30日までの建築)により、借入限度額を2,000万円として計算した。この期限内であることの確認自体はユーザー自身が行う前提とする。",
    );
  } else if (otherHousingTransitionalMeasure) {
    notes.push(
      "「その他の住宅」の経過措置は令和6年(2024年)以降入居の新築等(既存住宅を除く)のみが対象のため、この条件には反映していない。",
    );
  } else if (otherHousingTransitionalMeasureApplicable) {
    notes.push(
      "新築等の「その他の住宅」は令和6年(2024年)以降入居の場合、原則対象外だが、令和5年12月31日までの建築確認(または令和6年6月30日までの建築)があれば経過措置により借入限度額2,000万円・控除期間10年の対象になる。該当する場合は経過措置のチェックを入れること。",
    );
  }

  const energySavingTransitionalMeasureApplicable =
    !input.isExistingHome &&
    input.housingCategory === "ENERGY_SAVING" &&
    isR8ToR12MoveIn(input.moveInYear) &&
    input.moveInYear >= 2028;
  if (energySavingTransitionalMeasure && energySavingTransitionalMeasureApplicable) {
    notes.push(
      "新築等の省エネ基準適合住宅の経過措置(令和9年(2027年)末までの建築確認、または令和10年6月30日までの建築)により、借入限度額を2,000万円(子育て世帯等の上乗せなし)・控除期間10年として計算した。この期限内であることの確認自体はユーザー自身が行う前提とする。",
    );
  } else if (energySavingTransitionalMeasure) {
    notes.push(
      "省エネ基準適合住宅の経過措置は令和10年(2028年)以降入居の新築等(既存住宅を除く)のみが対象のため、この条件には反映していない。",
    );
  } else if (energySavingTransitionalMeasureApplicable) {
    notes.push(
      "新築等の省エネ基準適合住宅は令和10年(2028年)以降入居の場合、原則対象外だが、令和9年(2027年)末までの建築確認(または令和10年6月30日までの建築)があれば経過措置により借入限度額2,000万円・控除期間10年の対象になる。該当する場合は経過措置のチェックを入れること。",
    );
  }

  if (!input.isExistingHome && input.moveInYear >= 2028) {
    notes.push(
      "令和10年(2028年)以降入居分の新築住宅は、土砂災害特別警戒区域等の「災害レッドゾーン」に所在する場合は住宅ローン控除の対象外になる(建替え・既存住宅・リフォームは対象)。該当の可能性がある場合はユーザー自身で確認すること(本ツールでは判定しない)。",
    );
  }

  return {
    eligible,
    ineligibleReason,
    borrowingLimitJpy,
    controlPeriodYears: periodYears,
    controlPeriodEndYear,
    ownYearEndLoanBalanceJpy,
    deductibleBalanceJpy,
    nationalTaxCreditJpy,
    residentTaxCreditLimitJpy,
    residentTaxCreditJpy,
    notes,
  };
}

export interface MortgageDeductionRecordEntry {
  taxYear: number;
  nationalTaxCreditJpy: Decimal;
  residentTaxCreditJpy: Decimal;
}

/**
 * `/mortgage-deduction`で登録済みの、指定した年分の住宅ローン控除額(税額控除)を
 * DBから読み出す。`/tax-estimate`の合計税額試算へ税額控除として自動反映するために使う。
 * 未登録の年は null を返す。
 */
export async function getMortgageDeductionRecord(
  year: number,
): Promise<MortgageDeductionRecordEntry | null> {
  const taxYear = await prisma.taxYear.findUnique({ where: { year } });
  if (!taxYear) return null;

  const record = await prisma.mortgageDeductionRecord.findUnique({
    where: { taxYearId: taxYear.id },
  });
  if (!record) return null;

  return {
    taxYear: year,
    nationalTaxCreditJpy: new Decimal(record.nationalTaxCreditJpy.toString()),
    residentTaxCreditJpy: new Decimal(record.residentTaxCreditJpy.toString()),
  };
}
