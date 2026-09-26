import { Decimal } from "decimal.js";
import {
  RESIDENT_TAX_RATE,
  SEPARATE_NATIONAL_TAX_RATE,
  SEPARATE_RESIDENT_TAX_RATE,
  nationalIncomeTaxWithSurtaxJpy,
} from "../incomeTax";

/**
 * 会社から付与されたストックオプションの税額試算(国税庁タックスアンサーNo.1540
 * 「ストック・オプション税制の適用を受けて取得した株式を譲渡した場合」・No.1543
 * 「税制非適格ストック・オプションに係る課税関係について」、租税特別措置法29条の2)。
 *
 * ストックオプションは「税制適格」(措置法29条の2の要件を満たすもの)かどうかで
 * 課税タイミングが大きく異なる。
 *
 *  - **税制適格**: 権利行使時には課税されない(課税が株式売却時まで繰り延べられる)。
 *    株式売却時に (譲渡価額 − 権利行使価額) を譲渡所得として申告分離課税
 *    20.315%で課税する(取得費は権利行使時の時価ではなく権利行使価額そのもの)。
 *  - **税制非適格**: 2段階で課税される。
 *    1. 権利行使時: (権利行使時の時価 − 権利行使価額) を、原則として給与所得
 *       (社外高度人材等との業務委託契約に基づく付与の場合は事業所得又は雑所得)
 *       として総合課税(超過累進税率)する。
 *    2. 株式売却時: (譲渡価額 − 権利行使時の時価) を譲渡所得として申告分離課税
 *       20.315%で課税する。
 *
 * **税制適格の要件(措置法29条の2。No.1540のQ&A・複数の専門家解説を一次情報として
 * 自動判定する範囲)**:
 *  1. 権利行使価額が、ストックオプションの付与契約締結時における1株当たりの価額
 *     以上であること。
 *  2. 権利行使期間が、付与に関する決議の日後2年を経過した日から10年を経過する日
 *     まで(設立の日以後の期間が5年未満の一定の株式会社が付与するものは15年を
 *     経過する日まで)であること。本ツールは付与日・権利行使日の実際の日付から
 *     この期間内かどうかを判定する(契約書上の権利行使期間そのものではなく実際の
 *     行使日で近似する簡略化)。
 *  3. その年中における権利行使価額の合計額(同一の付与者からの他の税制適格
 *     ストックオプションの権利行使分を含む)が、令和6年度税制改正後の上限額
 *     (発行会社が上場会社なら1,200万円、設立5年以上の非上場会社なら2,400万円、
 *     設立5年未満の非上場会社なら3,600万円)以下であること。上限を超える場合は
 *     超過部分に対応する株数のみが税制非適格として扱われる(措置法29条の2第1項
 *     ただし書)。本ツールは行使価額に基づき比例的に株数を按分する。
 *
 * これら以外の要件(付与対象者が会社・子会社の取締役等又は一定の社外高度人材で
 * あり大口株主等に該当しないこと、無償で付与されていること、他者への譲渡が
 * 禁止されていること、発行会社等による株式の管理等の要件)は、他の特別控除
 * (`agriculturalLandRationalizationSaleDeduction.ts`の`specialDeductionEligible`等)と
 * 同様にユーザー自身の確認事項とし(`otherRequirementsConfirmed`)、本ツールでは
 * 判定しない。
 *
 * 非適格分の権利行使益(給与所得等)の税額は、既存の他の所得の課税所得金額
 * (`otherTaxableIncomeJpy`。給与所得控除等の適用後の金額をユーザー自身が入力する
 * 前提)に上乗せした場合の所得税額との差分(超過累進税率を正しく跨いで計算する
 * ための差分方式。`src/lib/incomeTax.ts`の`nationalIncomeTaxWithSurtaxJpy`を再利用)
 * で試算し、住民税は他の総合課税所得と同様一律10%として計算する(均等割・
 * 調整控除は考慮しない)。
 *
 * **対象外とした範囲(今後の課題)**:
 *  - 税制適格の要件のうち上記1〜3以外(付与対象者・大口株主等の判定・譲渡制限・
 *    管理方法要件)は自動判定しない。
 *  - 権利行使時の給与所得等が退職後の一定期間内の行使で「退職所得」相当と
 *    される例外的な取扱い(株価上昇分がほとんどの場合等)は対象外。
 *  - 権利行使・売却が異なる年にまたがる場合の年度分割入力には対応するが、
 *    同一年中に複数回に分けて権利行使した場合の上限額按分は、他の税制適格
 *    ストックオプションの行使価額合計を`otherQualifiedExercisesJpy`として
 *    ユーザー自身が入力する前提とする(自動集計はしない)。
 *  - 本ツールは他の単体試算画面(一時所得・国外転出時課税等)と同様、DBへの
 *    登録機能を持たない(結果は`/tax-estimate`等へ手入力で反映すること)。
 */

export type StockOptionCompanyType =
  | "LISTED_5Y_OR_MORE"
  | "UNLISTED_5Y_OR_MORE"
  | "UNLISTED_UNDER_5Y";

const ANNUAL_EXERCISE_LIMIT_JPY: Record<StockOptionCompanyType, Decimal> = {
  LISTED_5Y_OR_MORE: new Decimal(12_000_000),
  UNLISTED_5Y_OR_MORE: new Decimal(24_000_000),
  UNLISTED_UNDER_5Y: new Decimal(36_000_000),
};

const MIN_EXERCISE_PERIOD_YEARS = 2;
const MAX_EXERCISE_PERIOD_YEARS: Record<StockOptionCompanyType, number> = {
  LISTED_5Y_OR_MORE: 10,
  UNLISTED_5Y_OR_MORE: 10,
  UNLISTED_UNDER_5Y: 15,
};

export interface StockOptionTaxSimulationInput {
  companyType: StockOptionCompanyType;
  /** 付与契約締結時における1株当たりの価額 */
  grantContractPricePerShareJpy: Decimal.Value;
  /** 権利行使価額(1株当たり) */
  exercisePricePerShareJpy: Decimal.Value;
  /** 権利行使時の1株当たりの時価 */
  fairMarketValueAtExercisePerShareJpy: Decimal.Value;
  /** 譲渡価額(1株当たり)。未売却の場合は未指定でよい(その場合は売却時の課税は試算しない) */
  salePricePerShareJpy?: Decimal.Value;
  /** 権利行使株数 */
  shares: Decimal.Value;
  /** 付与に関する決議の日(YYYY-MM-DD) */
  grantDate: string;
  /** 権利行使日(YYYY-MM-DD) */
  exerciseDate: string;
  /** その年中に他の税制適格ストックオプションを行使した価額の合計(未入力は0) */
  otherQualifiedExercisesJpy?: Decimal.Value;
  /** 税制適格の要件のうち自動判定しない部分(付与対象者・譲渡制限・管理方法等)を満たすか */
  otherRequirementsConfirmed: boolean;
  /** 社外高度人材等との業務委託契約に基づく付与かどうか(非適格時の所得区分の表示に使用。既定は給与所得) */
  isBusinessConsultant?: boolean;
  /** 非適格分の権利行使益を上乗せする前の、他の所得の課税所得金額(給与所得控除等の適用後) */
  otherTaxableIncomeJpy: Decimal.Value;
}

export interface StockOptionTaxSimulationResult {
  shares: Decimal;
  meetsExercisePriceRequirement: boolean;
  meetsExercisePeriodRequirement: boolean;
  meetsOtherRequirements: boolean;
  /** 上記すべてを満たし、年間上限額の範囲内で税制適格になる株数 */
  qualifiedShares: Decimal;
  /** 年間上限額を超えた分、または要件を満たさないために税制非適格になる株数 */
  nonQualifiedShares: Decimal;
  annualExerciseLimitJpy: Decimal;
  /** その年の権利行使価額の合計(他の税制適格ストックオプション分を含む) */
  totalAnnualExerciseValueJpy: Decimal;

  /** 税制非適格分について、権利行使時に生じる所得の区分 */
  nonQualifiedExerciseIncomeType: "EMPLOYMENT" | "BUSINESS_OR_OCCASIONAL";
  /** 税制非適格分の権利行使益(給与所得等の収入金額に相当) */
  nonQualifiedExerciseGainJpy: Decimal;
  /** 権利行使益を上乗せしたことにより増加する所得税額(復興特別所得税込み) */
  exerciseNationalTaxIncreaseJpy: Decimal;
  /** 権利行使益を上乗せしたことにより増加する住民税額(一律10%として計算) */
  exerciseResidentTaxIncreaseJpy: Decimal;

  /** 譲渡価額が入力されている場合のみ計算する売却時の譲渡所得等 */
  sale?: {
    qualifiedGainJpy: Decimal;
    nonQualifiedGainJpy: Decimal;
    totalTaxableGainJpy: Decimal;
    nationalTaxJpy: Decimal;
    residentTaxJpy: Decimal;
  };

  totalTaxJpy: Decimal;
  notes: string[];
}

function requireNonNegative(value: Decimal, label: string): void {
  if (value.isNegative()) {
    throw new Error(`${label}は0以上である必要があります`);
  }
}

function addYears(date: Date, years: number): Date {
  const result = new Date(date.getTime());
  result.setFullYear(result.getFullYear() + years);
  return result;
}

export function simulateStockOptionTax(
  input: StockOptionTaxSimulationInput,
): StockOptionTaxSimulationResult {
  const shares = new Decimal(input.shares);
  const grantContractPricePerShareJpy = new Decimal(input.grantContractPricePerShareJpy);
  const exercisePricePerShareJpy = new Decimal(input.exercisePricePerShareJpy);
  const fairMarketValueAtExercisePerShareJpy = new Decimal(
    input.fairMarketValueAtExercisePerShareJpy,
  );
  const otherQualifiedExercisesJpy = input.otherQualifiedExercisesJpy
    ? new Decimal(input.otherQualifiedExercisesJpy)
    : new Decimal(0);
  const otherTaxableIncomeJpy = new Decimal(input.otherTaxableIncomeJpy);

  requireNonNegative(shares, "権利行使株数");
  requireNonNegative(grantContractPricePerShareJpy, "付与契約締結時の1株当たりの価額");
  requireNonNegative(exercisePricePerShareJpy, "権利行使価額");
  requireNonNegative(fairMarketValueAtExercisePerShareJpy, "権利行使時の時価");
  requireNonNegative(otherQualifiedExercisesJpy, "他の税制適格ストックオプションの行使価額");
  requireNonNegative(otherTaxableIncomeJpy, "他の所得の課税所得金額");

  const grantDate = new Date(input.grantDate);
  const exerciseDate = new Date(input.exerciseDate);
  if (Number.isNaN(grantDate.getTime())) {
    throw new Error("付与に関する決議の日の形式が不正です");
  }
  if (Number.isNaN(exerciseDate.getTime())) {
    throw new Error("権利行使日の形式が不正です");
  }

  const meetsExercisePriceRequirement = exercisePricePerShareJpy.greaterThanOrEqualTo(
    grantContractPricePerShareJpy,
  );

  const minExercisableDate = addYears(grantDate, MIN_EXERCISE_PERIOD_YEARS);
  const maxExercisableDate = addYears(grantDate, MAX_EXERCISE_PERIOD_YEARS[input.companyType]);
  const meetsExercisePeriodRequirement =
    exerciseDate.getTime() > minExercisableDate.getTime() &&
    exerciseDate.getTime() <= maxExercisableDate.getTime();

  const meetsOtherRequirements = input.otherRequirementsConfirmed;

  const annualExerciseLimitJpy = ANNUAL_EXERCISE_LIMIT_JPY[input.companyType];
  const thisExerciseValueJpy = exercisePricePerShareJpy.times(shares);
  const totalAnnualExerciseValueJpy = otherQualifiedExercisesJpy.plus(thisExerciseValueJpy);

  let qualifiedShares = new Decimal(0);
  if (meetsExercisePriceRequirement && meetsExercisePeriodRequirement && meetsOtherRequirements) {
    const remainingRoomJpy = Decimal.max(
      0,
      annualExerciseLimitJpy.minus(otherQualifiedExercisesJpy),
    );
    const qualifiedValueJpy = Decimal.min(thisExerciseValueJpy, remainingRoomJpy);
    qualifiedShares = exercisePricePerShareJpy.greaterThan(0)
      ? qualifiedValueJpy.dividedBy(exercisePricePerShareJpy)
      : new Decimal(0);
  }
  qualifiedShares = Decimal.min(qualifiedShares, shares);
  const nonQualifiedShares = shares.minus(qualifiedShares);

  const nonQualifiedExerciseIncomeType: "EMPLOYMENT" | "BUSINESS_OR_OCCASIONAL" = input
    .isBusinessConsultant
    ? "BUSINESS_OR_OCCASIONAL"
    : "EMPLOYMENT";

  const nonQualifiedExerciseGainJpy = Decimal.max(
    0,
    fairMarketValueAtExercisePerShareJpy.minus(exercisePricePerShareJpy),
  ).times(nonQualifiedShares);

  const exerciseNationalTaxIncreaseJpy = nationalIncomeTaxWithSurtaxJpy(
    otherTaxableIncomeJpy.plus(nonQualifiedExerciseGainJpy),
  ).minus(nationalIncomeTaxWithSurtaxJpy(otherTaxableIncomeJpy));
  const exerciseResidentTaxIncreaseJpy = nonQualifiedExerciseGainJpy.times(RESIDENT_TAX_RATE);

  let sale: StockOptionTaxSimulationResult["sale"];
  if (input.salePricePerShareJpy !== undefined) {
    const salePricePerShareJpy = new Decimal(input.salePricePerShareJpy);
    requireNonNegative(salePricePerShareJpy, "譲渡価額");

    const qualifiedGainJpy = salePricePerShareJpy
      .minus(exercisePricePerShareJpy)
      .times(qualifiedShares);
    const nonQualifiedGainJpy = salePricePerShareJpy
      .minus(fairMarketValueAtExercisePerShareJpy)
      .times(nonQualifiedShares);
    const totalTaxableGainJpy = Decimal.max(0, qualifiedGainJpy.plus(nonQualifiedGainJpy));

    sale = {
      qualifiedGainJpy,
      nonQualifiedGainJpy,
      totalTaxableGainJpy,
      nationalTaxJpy: totalTaxableGainJpy.times(SEPARATE_NATIONAL_TAX_RATE),
      residentTaxJpy: totalTaxableGainJpy.times(SEPARATE_RESIDENT_TAX_RATE),
    };
  }

  const totalTaxJpy = exerciseNationalTaxIncreaseJpy
    .plus(exerciseResidentTaxIncreaseJpy)
    .plus(sale ? sale.nationalTaxJpy.plus(sale.residentTaxJpy) : 0);

  const notes: string[] = [
    "国税庁タックスアンサーNo.1540・No.1543、租税特別措置法29条の2による概算値。税制適格の要件のうち、権利行使価額が付与契約締結時の価額以上であること・権利行使期間(決議日後2年〜10年、設立5年未満の非上場会社は15年)・その年中の権利行使価額の合計額(上場会社1,200万円/非上場会社(設立5年以上)2,400万円/非上場会社(設立5年未満)3,600万円)の3点のみを自動判定し、それ以外(付与対象者・大口株主等の判定・譲渡制限・株式の管理方法)はユーザー自身の確認事項とする。",
    "年間上限額を超える権利行使があった場合、超過部分に対応する株数のみを税制非適格として按分する(措置法29条の2第1項ただし書)。同一年中の他の税制適格ストックオプションの行使価額はユーザー入力(otherQualifiedExercisesJpy)に委ね、自動集計はしない。",
    "税制非適格分の権利行使益は原則として給与所得(社外高度人材等との業務委託契約に基づく付与の場合は事業所得又は雑所得)として総合課税され、他の所得の課税所得金額に上乗せしたことによる所得税額の増加分(超過累進税率を跨いで計算)で試算する。住民税は一律10%として計算し、均等割・調整控除は考慮しない。",
    "権利行使期間の判定は、契約書上定められた行使可能期間そのものではなく、付与日・実際の権利行使日から近似する簡略化を行っている。",
    "本シミュレーターはDBへの登録機能を持たない単体の試算画面のため、結果は/tax-estimate等へ手入力で反映すること。",
  ];
  if (nonQualifiedShares.greaterThan(0) && qualifiedShares.greaterThan(0)) {
    notes.push(
      `年間上限額の範囲内(${qualifiedShares.toString()}株分)は税制適格、超過分(${nonQualifiedShares.toString()}株分)は税制非適格として按分計算した。`,
    );
  }

  return {
    shares,
    meetsExercisePriceRequirement,
    meetsExercisePeriodRequirement,
    meetsOtherRequirements,
    qualifiedShares,
    nonQualifiedShares,
    annualExerciseLimitJpy,
    totalAnnualExerciseValueJpy,
    nonQualifiedExerciseIncomeType,
    nonQualifiedExerciseGainJpy,
    exerciseNationalTaxIncreaseJpy,
    exerciseResidentTaxIncreaseJpy,
    sale,
    totalTaxJpy,
    notes,
  };
}
