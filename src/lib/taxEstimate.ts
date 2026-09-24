import { Decimal } from "decimal.js";
import {
  RESIDENT_TAX_RATE,
  SEPARATE_NATIONAL_TAX_RATE,
  SEPARATE_RESIDENT_TAX_RATE,
  marginalIncomeTaxRate,
  nationalIncomeTaxWithSurtaxJpy,
} from "./incomeTax";
import {
  simulateDividendTaxation,
  type DividendTaxMethod,
  type DividendTaxMethodResult,
  type DividendTaxSimulationResult,
} from "./investment/dividendTaxSimulation";
import { estimateFurusatoNozeiLimit, type FurusatoNozeiLimitResult } from "./furusatoNozei";

/**
 * ダッシュボードの各所得区分(暗号資産の雑所得・株式等の譲渡所得・配当所得・
 * 先物取引に係る雑所得等)を合算し、その年の所得税・復興特別所得税・住民税の
 * 概算合計額を試算する。
 *
 * 所得区分ごとの課税方式:
 *  - 暗号資産の雑所得: 給与所得等と合算する総合課税(超過累進税率)。
 *  - 株式等の譲渡所得・先物取引に係る雑所得等: それぞれ別プールの
 *    申告分離課税(一律20.315%)。両者は損益通算できない。
 *  - 配当所得: 総合課税・申告分離課税・申告不要のいずれか
 *    (`dividendTaxSimulation.ts`の試算結果を利用し、`dividendMethod`で
 *    指定がなければ最も税負担が軽い方式を採用する)。
 *
 * 簡略化している点(呼び出し元の各シミュレーターと共通):
 *  - `otherComprehensiveIncomeJpy`(給与所得等)は基礎控除等の所得控除を
 *    既に差し引いた課税所得金額としてユーザーが入力する前提であり、
 *    本モジュールは所得控除の計算を行わない。
 *  - 住民税所得割は10%固定(税額控除適用前)。均等割(定額部分)は
 *    自治体・年度により金額が異なり住所情報から自動算出できないため、
 *    `residentTaxPerCapitaLeviesJpy`にユーザーが入力した場合のみ合計住民税額に
 *    加算する任意項目とする(下記参照)。
 *  - 源泉徴収税額・予定納税額との相殺(還付・納付額の算出)は任意入力項目
 *    (下記参照)。いずれも未入力(0円)の場合は年間の税額そのものの概算値
 *    のみを返す。延滞税・加算税・予定納税の減額申請は考慮しない。
 *
 * 住民税の調整控除(`residentTaxAdjustmentDeduction.ts`)・住宅ローン控除
 * (`mortgageDeduction.ts`)・政党等・認定NPO法人等・公益社団法人等寄附金特別控除
 * (`donationTaxCredit.ts`)・住宅耐震改修特別控除(`earthquakeRenovationDeduction.ts`)・
 * 省エネ改修工事の住宅特定改修特別税額控除(`energySavingRenovationDeduction.ts`)・
 * 外国税額控除(`investment/foreignTaxCredit.ts`)・分配時調整外国税相当額控除
 * (`investment/distributionAdjustedForeignTaxCredit.ts`)は
 * いずれも所得控除ではなく税額控除のため、上記の各所得区分の税額を合算した後の
 * 合計税額から直接差し引く。`/resident-tax-adjustment-deduction`・
 * `/mortgage-deduction`・`/donation-tax-credit`・`/earthquake-renovation-deduction`・
 * `/energy-saving-renovation-deduction`・`/foreign-tax-credit`・
 * `/distribution-adjusted-foreign-tax-credit`の試算結果
 * (または`IncomeDeduction`と同様にDB登録した値)をそのまま「その年に適用される控除額」
 * として受け取り、本モジュール側では所得税額・住民税所得割額の限度判定(住民税へ
 * 繰り越す額の算出、外国税額控除の3限度額の判定)を再計算しない。自治体公式サイトで
 * 確認できる住民税の税額控除の適用順序(調整控除→配当控除→住宅借入金等特別税額控除→
 * 寄附金税額控除→外国税額控除)と、確定申告書第一表の税額控除欄の記載順序
 * (配当控除→住宅借入金等特別控除→政党等寄附金等特別控除→住宅耐震改修特別控除等→
 * 外国税額控除等)に基づき、調整控除→住宅ローン控除→寄附金特別控除→住宅耐震改修
 * 特別控除→省エネ改修工事の住宅特定改修特別税額控除→外国税額控除の順に適用する
 * (調整控除は住民税所得割のみが対象)。寄附金特別控除は
 * `donationTaxCreditJpy`(所得税分。政党等・認定NPO法人等・公益社団法人等寄附金特別控除)と
 * `donationTaxCreditResidentTaxJpy`(住民税分。認定NPO法人等・公益社団法人等への寄附のうち
 * 条例指定を受けている分の住民税の寄附金控除(基本控除)のみが対象。政党等寄附金は
 * 条例指定寄附金の対象外のため住民税分は常に0円)をそれぞれ所得税額・住民税所得割額から
 * 差し引く。いずれも控除額が残りの税額を上回る場合は0円が下限(還付は生じない)。
 * 住宅耐震改修特別控除(`earthquakeRenovationDeductionJpy`)・省エネ改修工事の住宅
 * 特定改修特別税額控除(`energySavingRenovationDeductionJpy`)はいずれも住民税に
 * 相当する控除が無い所得税のみの制度のため、寄附金特別控除適用後(省エネ改修工事分は
 * 住宅耐震改修特別控除適用後)の所得税額からのみ差し引く。
 * 分配時調整外国税相当額控除(`distributionAdjustedForeignTaxCreditJpy`)は外国税額控除と
 * 制度が近いため外国税額控除の直後(合計税額から見て最後)に所得税額(復興特別所得税を
 * 含む)からのみ差し引く(住民税分は一次情報で条文・算式を確認できておらず対象外。
 * `investment/distributionAdjustedForeignTaxCredit.ts`参照)。
 *
 * 源泉徴収税額(`withheldNationalTaxJpy`/`withheldResidentTaxJpy`)は、給与の
 * 源泉徴収税額や、配当等・特定口座(源泉徴収あり)内の株式等譲渡益について
 * 既に源泉徴収(特別徴収)された金額をユーザーが入力すると、上記で求めた
 * 合計税額との差額(納付見込み額・還付見込み額)を追加で試算する任意項目。
 * 未入力(0円)の場合は従来通り年間の税額そのものの概算値のみを返す。
 *
 * 予定納税額(`estimatedTaxPrepaymentJpy`)は、前年の所得金額・税額を基準に
 * その年の7月・11月に前払いした所得税・復興特別所得税の合計額(国税庁から
 * 送付される「予定納税額の通知書」記載額、または実際に納付した合計額)を
 * ユーザーが入力すると、源泉徴収税額と同様に所得税・復興特別所得税の
 * 納付・還付見込み額からさらに差し引く任意項目。予定納税は所得税・復興特別
 * 所得税のみの制度で住民税には存在しないため、住民税の納付・還付見込み額には
 * 影響しない。
 *
 * 住民税の均等割(`residentTaxPerCapitaLeviesJpy`)は、所得金額にかかわらず定額で
 * 課される部分(標準税率は道府県民税・市町村民税・森林環境税(国税だが均等割と
 * あわせて市区町村が徴収)をあわせて年5,000円程度だが、自治体の超過課税により
 * 上乗せされる場合がある)。本ツールは住所情報を扱わず自治体ごとの金額を
 * 自動算出できないため、住民税決定通知書等でユーザー自身が確認した金額を
 * 入力する任意項目とする。所得割と異なり住宅ローン控除・外国税額控除等の
 * 税額控除の対象にならないため、それらの控除適用後の住民税所得割額に
 * そのまま加算する(ふるさと納税の上限額試算の基準となる住民税所得割額には含めない)。
 */

export interface TotalTaxEstimateInput {
  /** 給与所得等、暗号資産雑所得以外の総合課税分の課税所得金額(所得控除後) */
  otherComprehensiveIncomeJpy: Decimal.Value;
  /** 雑所得(暗号資産。現物取引+証拠金取引の決済損益の合計) */
  cryptoMiscIncomeJpy: Decimal.Value;
  /** 譲渡所得(上場株式等・申告分離課税、繰越控除適用後の課税対象額) */
  investmentTaxableGainJpy: Decimal.Value;
  /**
   * 譲渡所得等(一般株式等・非上場株式・申告分離課税)。上場株式等とは
   * 別プールで損益通算はできず、繰越控除制度(措置法37の12の2)は上場株式等
   * のみのため対象外(赤字の場合は0円に切り捨てた課税対象額を入力する前提)
   */
  nonListedInvestmentTaxableGainJpy?: Decimal.Value;
  /** 雑所得等(先物取引・FX、申告分離課税、繰越控除適用後の課税対象額) */
  futuresTaxableGainJpy: Decimal.Value;
  /** 配当所得金額(源泉徴収前の年間合計) */
  dividendIncomeJpy: Decimal.Value;
  /** 配当所得の課税方式。未指定の場合は最も税負担が軽い方式を自動選択する */
  dividendMethod?: DividendTaxMethod;
  /** 配当所得(申告分離課税時)と損益通算できる上場株式等の譲渡損失額 */
  availableListedStockLossForDividendJpy?: Decimal.Value;
  /**
   * 住民税の調整控除(税額控除)額。税源移譲に伴う所得税・住民税の人的控除額の差を
   * 調整する住民税所得割のみの制度で、所得税に対応する控除は無いため、住民税額から
   * のみ控除する。`/resident-tax-adjustment-deduction`の試算結果(または登録済みの値)を
   * 住宅ローン控除・外国税額控除より先に住民税所得割額から差し引く
   */
  residentTaxAdjustmentDeductionJpy?: Decimal.Value;
  /** 住宅ローン控除(税額控除)のうち、その年の所得税額から控除する額 */
  mortgageDeductionNationalTaxCreditJpy?: Decimal.Value;
  /** 住宅ローン控除(税額控除)のうち、その年の住民税額から控除する額 */
  mortgageDeductionResidentTaxCreditJpy?: Decimal.Value;
  /**
   * 政党等・認定NPO法人等・公益社団法人等寄附金特別控除(税額控除)額のうち、
   * 所得税額から控除する額。住宅ローン控除後・外国税額控除前の所得税額から
   * 控除する。`/donation-tax-credit`の試算結果(または登録済みの値)をそのまま
   * 「その年に適用される控除額」として受け取る
   */
  donationTaxCreditJpy?: Decimal.Value;
  /**
   * 政党等・認定NPO法人等・公益社団法人等寄附金特別控除のうち、住民税の
   * 寄附金控除(基本控除)として住民税所得割額から控除する額。認定NPO法人等・
   * 公益社団法人等への寄附のうち、寄附先が条例指定を受けている分のみが対象
   * (政党等寄附金は条例指定寄附金の対象外のため常に0円)。住宅ローン控除後・
   * 外国税額控除前の住民税額から控除する
   */
  donationTaxCreditResidentTaxJpy?: Decimal.Value;
  /**
   * 住宅耐震改修特別控除(税額控除)額。住民税に相当する控除が無い所得税のみの
   * 制度のため、寄附金特別控除適用後の所得税額からのみ控除する。
   * `/earthquake-renovation-deduction`の試算結果(または登録済みの値)を
   * そのまま「その年に適用される控除額」として受け取る
   */
  earthquakeRenovationDeductionJpy?: Decimal.Value;
  /**
   * 省エネ改修工事の住宅特定改修特別税額控除(税額控除)額。住宅耐震改修特別控除と
   * 同様、住民税に相当する控除が無い所得税のみの制度のため、住宅耐震改修特別控除
   * 適用後の所得税額からのみ控除する。`/energy-saving-renovation-deduction`の
   * 試算結果(または登録済みの値)をそのまま「その年に適用される控除額」として受け取る
   */
  energySavingRenovationDeductionJpy?: Decimal.Value;
  /** 外国税額控除(税額控除)のうち、その年の所得税額・復興特別所得税額から控除する額 */
  foreignTaxCreditNationalTaxCreditJpy?: Decimal.Value;
  /** 外国税額控除(税額控除)のうち、その年の住民税額から控除する額 */
  foreignTaxCreditResidentTaxCreditJpy?: Decimal.Value;
  /**
   * 分配時調整外国税相当額控除(税額控除)額。外国税額控除適用後の所得税額
   * (復興特別所得税を含む)から控除する(限度額計算・繰越は無く、住民税分は
   * 対象外。`/distribution-adjusted-foreign-tax-credit`の試算結果を前提とする)
   */
  distributionAdjustedForeignTaxCreditJpy?: Decimal.Value;
  /**
   * 既に源泉徴収された所得税及び復興特別所得税の合計額(給与の源泉徴収税額・
   * 配当等の源泉徴収税額・特定口座(源泉徴収あり)内の株式等譲渡益の
   * 源泉徴収税額等)。入力すると合計税額との差額(納付・還付見込み額)を試算する
   */
  withheldNationalTaxJpy?: Decimal.Value;
  /**
   * 既に特別徴収された住民税相当額の合計額(特定口座(源泉徴収あり)内の
   * 株式等譲渡益・配当等について証券会社が徴収した住民税相当額(通常5%)等)
   */
  withheldResidentTaxJpy?: Decimal.Value;
  /**
   * その年に納付済みの予定納税額(所得税・復興特別所得税の第1期分・第2期分の
   * 合計)。入力すると源泉徴収税額と合わせて所得税・復興特別所得税の
   * 納付・還付見込み額から差し引く(住民税には予定納税の制度が無いため
   * 住民税分には影響しない)
   */
  estimatedTaxPrepaymentJpy?: Decimal.Value;
  /**
   * 住民税の均等割(定額部分)。標準税率は年5,000円程度(道府県民税・
   * 市町村民税・森林環境税の合計)だが自治体の超過課税により異なる場合があるため、
   * 住民税決定通知書等でユーザー自身が確認した金額を入力する任意項目。
   * 所得割と異なり税額控除の対象にならないため、控除適用後の住民税所得割額に
   * そのまま加算する
   */
  residentTaxPerCapitaLeviesJpy?: Decimal.Value;
}

export interface TotalTaxEstimateResult {
  /** 総合課税分の課税所得金額(配当所得を除く。給与所得等+暗号資産の雑所得) */
  comprehensiveTaxableIncomeExcludingDividendJpy: Decimal;
  /** 配当所得の課税方式シミュレーション結果(3方式の比較) */
  dividend: DividendTaxSimulationResult;
  /** 合計税額の計算に採用した配当所得の課税方式 */
  dividendMethodUsed: DividendTaxMethod;
  /** `dividend`のうち、`dividendMethodUsed`に対応する結果(呼び出し側の分岐を避けるための参照) */
  dividendResultUsed: DividendTaxMethodResult;
  /** 総合課税分(配当所得を除く)の所得税額(復興特別所得税を含む) */
  comprehensiveNationalTaxJpy: Decimal;
  /** 総合課税分(配当所得を除く)の住民税額 */
  comprehensiveResidentTaxJpy: Decimal;
  /** 株式等の譲渡所得(申告分離課税)の所得税額(復興特別所得税を含む) */
  investmentNationalTaxJpy: Decimal;
  /** 株式等の譲渡所得(申告分離課税)の住民税額 */
  investmentResidentTaxJpy: Decimal;
  /** 譲渡所得等(一般株式等・非上場株式・申告分離課税)の所得税額(復興特別所得税を含む) */
  nonListedInvestmentNationalTaxJpy: Decimal;
  /** 譲渡所得等(一般株式等・非上場株式・申告分離課税)の住民税額 */
  nonListedInvestmentResidentTaxJpy: Decimal;
  /** 先物取引に係る雑所得等(申告分離課税)の所得税額(復興特別所得税を含む) */
  futuresNationalTaxJpy: Decimal;
  /** 先物取引に係る雑所得等(申告分離課税)の住民税額 */
  futuresResidentTaxJpy: Decimal;
  /** 調整控除適用前の合計の住民税額(所得税には調整控除に対応する控除が無いため所得税分は無い) */
  totalResidentTaxBeforeAdjustmentDeductionJpy: Decimal;
  /** 入力された住民税の調整控除額 */
  residentTaxAdjustmentDeductionJpy: Decimal;
  /** 実際に適用された住民税の調整控除額(入力値と調整控除適用前の住民税額のいずれか少ない方) */
  residentTaxAdjustmentDeductionAppliedJpy: Decimal;
  /** 住宅ローン控除適用前(調整控除適用後)の合計の所得税額(復興特別所得税を含む) */
  totalNationalTaxBeforeMortgageDeductionJpy: Decimal;
  /** 住宅ローン控除適用前(調整控除適用後)の合計の住民税額 */
  totalResidentTaxBeforeMortgageDeductionJpy: Decimal;
  /** 実際に適用された住宅ローン控除額(所得税分。入力値と適用前の所得税額のいずれか少ない方) */
  mortgageDeductionNationalTaxAppliedJpy: Decimal;
  /** 実際に適用された住宅ローン控除額(住民税分。入力値と適用前の住民税額のいずれか少ない方) */
  mortgageDeductionResidentTaxAppliedJpy: Decimal;
  /** 住宅ローン控除適用後・寄附金特別控除適用前の所得税額(復興特別所得税を含む) */
  totalNationalTaxAfterMortgageDeductionJpy: Decimal;
  /** 住宅ローン控除適用後・外国税額控除適用前の住民税額 */
  totalResidentTaxAfterMortgageDeductionJpy: Decimal;
  /**
   * 実際に適用された政党等・認定NPO法人等・公益社団法人等寄附金特別控除額
   * (所得税分。入力値と住宅ローン控除適用後の所得税額のいずれか少ない方)
   */
  donationTaxCreditAppliedJpy: Decimal;
  /**
   * 実際に適用された寄附金特別控除額(住民税の寄附金控除(基本控除)分。入力値と
   * 住宅ローン控除適用後の住民税額のいずれか少ない方)
   */
  donationTaxCreditResidentTaxAppliedJpy: Decimal;
  /** 寄附金特別控除適用後・住宅耐震改修特別控除適用前の所得税額(復興特別所得税を含む) */
  totalNationalTaxAfterDonationTaxCreditJpy: Decimal;
  /** 寄附金特別控除(住民税の寄附金控除(基本控除)分)適用後・外国税額控除適用前の住民税額 */
  totalResidentTaxAfterDonationTaxCreditJpy: Decimal;
  /**
   * 実際に適用された住宅耐震改修特別控除額(所得税分のみ。入力値と寄附金特別控除
   * 適用後の所得税額のいずれか少ない方。住民税に相当する控除は無い)
   */
  earthquakeRenovationDeductionAppliedJpy: Decimal;
  /** 住宅耐震改修特別控除適用後・省エネ改修工事の住宅特定改修特別税額控除適用前の所得税額(復興特別所得税を含む) */
  totalNationalTaxAfterEarthquakeRenovationDeductionJpy: Decimal;
  /**
   * 実際に適用された省エネ改修工事の住宅特定改修特別税額控除額(所得税分のみ。
   * 入力値と住宅耐震改修特別控除適用後の所得税額のいずれか少ない方。住民税に
   * 相当する控除は無い)
   */
  energySavingRenovationDeductionAppliedJpy: Decimal;
  /** 省エネ改修工事の住宅特定改修特別税額控除適用後・外国税額控除適用前の所得税額(復興特別所得税を含む) */
  totalNationalTaxAfterEnergySavingRenovationDeductionJpy: Decimal;
  /** 実際に適用された外国税額控除額(所得税・復興特別所得税分。入力値と省エネ改修工事の住宅特定改修特別税額控除適用後の所得税額のいずれか少ない方) */
  foreignTaxCreditNationalTaxAppliedJpy: Decimal;
  /** 実際に適用された外国税額控除額(住民税分。入力値と寄附金特別控除適用後の住民税額のいずれか少ない方) */
  foreignTaxCreditResidentTaxAppliedJpy: Decimal;
  /**
   * 実際に適用された分配時調整外国税相当額控除額(入力値と外国税額控除適用後の
   * 所得税額のいずれか少ない方。限度額計算・繰越は無く、住民税分は対象外)
   */
  distributionAdjustedForeignTaxCreditAppliedJpy: Decimal;
  /** 合計の所得税額(復興特別所得税を含む。住宅ローン控除・外国税額控除・分配時調整外国税相当額控除適用後) */
  totalNationalTaxJpy: Decimal;
  /** 入力された住民税の均等割額(所得割とは別に合計住民税額に加算) */
  residentTaxPerCapitaLeviesJpy: Decimal;
  /** 合計の住民税額(所得割は住宅ローン控除・外国税額控除適用後。均等割を含む) */
  totalResidentTaxJpy: Decimal;
  /** 合計税額(所得税・復興特別所得税・住民税の合計。住宅ローン控除・外国税額控除適用後) */
  totalTaxJpy: Decimal;
  /** ふるさと納税(寄附金控除)の年間上限額の試算(自己負担2,000円になる目安) */
  furusatoNozei: FurusatoNozeiLimitResult;
  /** 入力された源泉徴収税額(所得税・復興特別所得税分) */
  withheldNationalTaxJpy: Decimal;
  /** 入力された源泉徴収税額(住民税相当分) */
  withheldResidentTaxJpy: Decimal;
  /** 入力された予定納税額(所得税・復興特別所得税分。住民税には制度が無い) */
  estimatedTaxPrepaymentJpy: Decimal;
  /** 所得税・復興特別所得税の納付見込み額(正の場合は納付、負の場合は還付) */
  nationalTaxBalanceJpy: Decimal;
  /** 住民税の納付(追加徴収)見込み額(正の場合は追加徴収、負の場合は減額) */
  residentTaxBalanceJpy: Decimal;
  /** 所得税・住民税を合算した納付見込み額(正の場合は納付、負の場合は還付) */
  totalTaxBalanceJpy: Decimal;
  notes: string[];
}

function requireNonNegative(value: Decimal, label: string): void {
  if (value.isNegative()) {
    throw new Error(`${label}は0以上である必要があります`);
  }
}

export function estimateTotalTax(input: TotalTaxEstimateInput): TotalTaxEstimateResult {
  const otherComprehensiveIncomeJpy = new Decimal(input.otherComprehensiveIncomeJpy);
  const cryptoMiscIncomeJpy = new Decimal(input.cryptoMiscIncomeJpy);
  const investmentTaxableGainJpy = new Decimal(input.investmentTaxableGainJpy);
  const nonListedInvestmentTaxableGainJpy = input.nonListedInvestmentTaxableGainJpy
    ? new Decimal(input.nonListedInvestmentTaxableGainJpy)
    : new Decimal(0);
  const futuresTaxableGainJpy = new Decimal(input.futuresTaxableGainJpy);
  const dividendIncomeJpy = new Decimal(input.dividendIncomeJpy);
  const availableListedStockLossForDividendJpy = input.availableListedStockLossForDividendJpy
    ? new Decimal(input.availableListedStockLossForDividendJpy)
    : new Decimal(0);

  requireNonNegative(otherComprehensiveIncomeJpy, "給与所得等の課税所得金額");
  requireNonNegative(cryptoMiscIncomeJpy, "雑所得(暗号資産)");
  requireNonNegative(investmentTaxableGainJpy, "譲渡所得(株式等)");
  requireNonNegative(nonListedInvestmentTaxableGainJpy, "譲渡所得等(一般株式等・非上場株式)");
  requireNonNegative(futuresTaxableGainJpy, "雑所得等(先物取引・FX)");
  requireNonNegative(dividendIncomeJpy, "配当所得金額");
  requireNonNegative(availableListedStockLossForDividendJpy, "損益通算可能な譲渡損失額");

  // 暗号資産の雑所得は他の総合課税所得(給与所得等)と合算した上で
  // 累進税率を適用するため、配当所得のシミュレーションにもこの合算後の
  // 金額を「配当以外の課税所得金額」として渡す(配当を上乗せした場合の
  // 限界税率を正しく計算するため)。
  const comprehensiveTaxableIncomeExcludingDividendJpy =
    otherComprehensiveIncomeJpy.plus(cryptoMiscIncomeJpy);

  const comprehensiveNationalTaxJpy = nationalIncomeTaxWithSurtaxJpy(
    comprehensiveTaxableIncomeExcludingDividendJpy,
  );
  const comprehensiveResidentTaxJpy = comprehensiveTaxableIncomeExcludingDividendJpy.times(
    RESIDENT_TAX_RATE,
  );

  const dividend = simulateDividendTaxation({
    dividendIncomeJpy,
    otherTaxableIncomeJpy: comprehensiveTaxableIncomeExcludingDividendJpy,
    availableListedStockLossJpy: availableListedStockLossForDividendJpy,
  });
  const dividendMethodUsed = input.dividendMethod ?? dividend.recommendedMethod;
  const dividendResult =
    dividendMethodUsed === "COMPREHENSIVE"
      ? dividend.comprehensive
      : dividendMethodUsed === "SEPARATE"
        ? dividend.separate
        : dividend.noFiling;

  const investmentNationalTaxJpy = investmentTaxableGainJpy.times(SEPARATE_NATIONAL_TAX_RATE);
  const investmentResidentTaxJpy = investmentTaxableGainJpy.times(SEPARATE_RESIDENT_TAX_RATE);
  const nonListedInvestmentNationalTaxJpy = nonListedInvestmentTaxableGainJpy.times(
    SEPARATE_NATIONAL_TAX_RATE,
  );
  const nonListedInvestmentResidentTaxJpy = nonListedInvestmentTaxableGainJpy.times(
    SEPARATE_RESIDENT_TAX_RATE,
  );
  const futuresNationalTaxJpy = futuresTaxableGainJpy.times(SEPARATE_NATIONAL_TAX_RATE);
  const futuresResidentTaxJpy = futuresTaxableGainJpy.times(SEPARATE_RESIDENT_TAX_RATE);

  const totalNationalTaxBeforeMortgageDeductionJpy = comprehensiveNationalTaxJpy
    .plus(dividendResult.nationalTaxJpy)
    .plus(investmentNationalTaxJpy)
    .plus(nonListedInvestmentNationalTaxJpy)
    .plus(futuresNationalTaxJpy);
  const totalResidentTaxBeforeAdjustmentDeductionJpy = comprehensiveResidentTaxJpy
    .plus(dividendResult.residentTaxJpy)
    .plus(investmentResidentTaxJpy)
    .plus(nonListedInvestmentResidentTaxJpy)
    .plus(futuresResidentTaxJpy);

  const residentTaxAdjustmentDeductionJpy = input.residentTaxAdjustmentDeductionJpy
    ? new Decimal(input.residentTaxAdjustmentDeductionJpy)
    : new Decimal(0);
  requireNonNegative(residentTaxAdjustmentDeductionJpy, "住民税の調整控除額");
  const residentTaxAdjustmentDeductionAppliedJpy = Decimal.min(
    residentTaxAdjustmentDeductionJpy,
    totalResidentTaxBeforeAdjustmentDeductionJpy,
  );
  const totalResidentTaxBeforeMortgageDeductionJpy = totalResidentTaxBeforeAdjustmentDeductionJpy.minus(
    residentTaxAdjustmentDeductionAppliedJpy,
  );

  const mortgageDeductionNationalTaxCreditJpy = input.mortgageDeductionNationalTaxCreditJpy
    ? new Decimal(input.mortgageDeductionNationalTaxCreditJpy)
    : new Decimal(0);
  const mortgageDeductionResidentTaxCreditJpy = input.mortgageDeductionResidentTaxCreditJpy
    ? new Decimal(input.mortgageDeductionResidentTaxCreditJpy)
    : new Decimal(0);
  requireNonNegative(mortgageDeductionNationalTaxCreditJpy, "住宅ローン控除額(所得税分)");
  requireNonNegative(mortgageDeductionResidentTaxCreditJpy, "住宅ローン控除額(住民税分)");

  const mortgageDeductionNationalTaxAppliedJpy = Decimal.min(
    mortgageDeductionNationalTaxCreditJpy,
    totalNationalTaxBeforeMortgageDeductionJpy,
  );
  const mortgageDeductionResidentTaxAppliedJpy = Decimal.min(
    mortgageDeductionResidentTaxCreditJpy,
    totalResidentTaxBeforeMortgageDeductionJpy,
  );
  const totalNationalTaxAfterMortgageDeductionJpy = totalNationalTaxBeforeMortgageDeductionJpy.minus(
    mortgageDeductionNationalTaxAppliedJpy,
  );
  const totalResidentTaxAfterMortgageDeductionJpy = totalResidentTaxBeforeMortgageDeductionJpy.minus(
    mortgageDeductionResidentTaxAppliedJpy,
  );

  const donationTaxCreditJpy = input.donationTaxCreditJpy
    ? new Decimal(input.donationTaxCreditJpy)
    : new Decimal(0);
  const donationTaxCreditResidentTaxJpy = input.donationTaxCreditResidentTaxJpy
    ? new Decimal(input.donationTaxCreditResidentTaxJpy)
    : new Decimal(0);
  requireNonNegative(donationTaxCreditJpy, "寄附金特別控除額(所得税分)");
  requireNonNegative(donationTaxCreditResidentTaxJpy, "寄附金特別控除額(住民税分)");
  const donationTaxCreditAppliedJpy = Decimal.min(
    donationTaxCreditJpy,
    totalNationalTaxAfterMortgageDeductionJpy,
  );
  const donationTaxCreditResidentTaxAppliedJpy = Decimal.min(
    donationTaxCreditResidentTaxJpy,
    totalResidentTaxAfterMortgageDeductionJpy,
  );
  const totalNationalTaxAfterDonationTaxCreditJpy = totalNationalTaxAfterMortgageDeductionJpy.minus(
    donationTaxCreditAppliedJpy,
  );
  const totalResidentTaxAfterDonationTaxCreditJpy = totalResidentTaxAfterMortgageDeductionJpy.minus(
    donationTaxCreditResidentTaxAppliedJpy,
  );

  const earthquakeRenovationDeductionJpy = input.earthquakeRenovationDeductionJpy
    ? new Decimal(input.earthquakeRenovationDeductionJpy)
    : new Decimal(0);
  requireNonNegative(earthquakeRenovationDeductionJpy, "住宅耐震改修特別控除額");
  const earthquakeRenovationDeductionAppliedJpy = Decimal.min(
    earthquakeRenovationDeductionJpy,
    totalNationalTaxAfterDonationTaxCreditJpy,
  );
  const totalNationalTaxAfterEarthquakeRenovationDeductionJpy =
    totalNationalTaxAfterDonationTaxCreditJpy.minus(earthquakeRenovationDeductionAppliedJpy);

  const energySavingRenovationDeductionJpy = input.energySavingRenovationDeductionJpy
    ? new Decimal(input.energySavingRenovationDeductionJpy)
    : new Decimal(0);
  requireNonNegative(energySavingRenovationDeductionJpy, "省エネ改修工事の住宅特定改修特別税額控除額");
  const energySavingRenovationDeductionAppliedJpy = Decimal.min(
    energySavingRenovationDeductionJpy,
    totalNationalTaxAfterEarthquakeRenovationDeductionJpy,
  );
  const totalNationalTaxAfterEnergySavingRenovationDeductionJpy =
    totalNationalTaxAfterEarthquakeRenovationDeductionJpy.minus(
      energySavingRenovationDeductionAppliedJpy,
    );

  const foreignTaxCreditNationalTaxCreditJpy = input.foreignTaxCreditNationalTaxCreditJpy
    ? new Decimal(input.foreignTaxCreditNationalTaxCreditJpy)
    : new Decimal(0);
  const foreignTaxCreditResidentTaxCreditJpy = input.foreignTaxCreditResidentTaxCreditJpy
    ? new Decimal(input.foreignTaxCreditResidentTaxCreditJpy)
    : new Decimal(0);
  requireNonNegative(foreignTaxCreditNationalTaxCreditJpy, "外国税額控除額(所得税・復興特別所得税分)");
  requireNonNegative(foreignTaxCreditResidentTaxCreditJpy, "外国税額控除額(住民税分)");

  const foreignTaxCreditNationalTaxAppliedJpy = Decimal.min(
    foreignTaxCreditNationalTaxCreditJpy,
    totalNationalTaxAfterEnergySavingRenovationDeductionJpy,
  );
  const foreignTaxCreditResidentTaxAppliedJpy = Decimal.min(
    foreignTaxCreditResidentTaxCreditJpy,
    totalResidentTaxAfterDonationTaxCreditJpy,
  );
  const totalNationalTaxAfterForeignTaxCreditJpy =
    totalNationalTaxAfterEnergySavingRenovationDeductionJpy.minus(foreignTaxCreditNationalTaxAppliedJpy);

  const distributionAdjustedForeignTaxCreditJpy = input.distributionAdjustedForeignTaxCreditJpy
    ? new Decimal(input.distributionAdjustedForeignTaxCreditJpy)
    : new Decimal(0);
  requireNonNegative(distributionAdjustedForeignTaxCreditJpy, "分配時調整外国税相当額控除額");
  const distributionAdjustedForeignTaxCreditAppliedJpy = Decimal.min(
    distributionAdjustedForeignTaxCreditJpy,
    totalNationalTaxAfterForeignTaxCreditJpy,
  );
  const totalNationalTaxJpy = totalNationalTaxAfterForeignTaxCreditJpy.minus(
    distributionAdjustedForeignTaxCreditAppliedJpy,
  );
  const residentTaxPerCapitaLeviesJpy = input.residentTaxPerCapitaLeviesJpy
    ? new Decimal(input.residentTaxPerCapitaLeviesJpy)
    : new Decimal(0);
  requireNonNegative(residentTaxPerCapitaLeviesJpy, "住民税の均等割額");
  const totalResidentTaxJpy = totalResidentTaxAfterDonationTaxCreditJpy
    .minus(foreignTaxCreditResidentTaxAppliedJpy)
    .plus(residentTaxPerCapitaLeviesJpy);

  const withheldNationalTaxJpy = input.withheldNationalTaxJpy
    ? new Decimal(input.withheldNationalTaxJpy)
    : new Decimal(0);
  const withheldResidentTaxJpy = input.withheldResidentTaxJpy
    ? new Decimal(input.withheldResidentTaxJpy)
    : new Decimal(0);
  requireNonNegative(withheldNationalTaxJpy, "源泉徴収税額(所得税・復興特別所得税分)");
  requireNonNegative(withheldResidentTaxJpy, "源泉徴収税額(住民税相当分)");
  const estimatedTaxPrepaymentJpy = input.estimatedTaxPrepaymentJpy
    ? new Decimal(input.estimatedTaxPrepaymentJpy)
    : new Decimal(0);
  requireNonNegative(estimatedTaxPrepaymentJpy, "予定納税額");
  const nationalTaxBalanceJpy = totalNationalTaxJpy
    .minus(withheldNationalTaxJpy)
    .minus(estimatedTaxPrepaymentJpy);
  const residentTaxBalanceJpy = totalResidentTaxJpy.minus(withheldResidentTaxJpy);
  const totalTaxBalanceJpy = nationalTaxBalanceJpy.plus(residentTaxBalanceJpy);

  const notes: string[] = [
    "給与所得等の課税所得金額は所得控除後の金額を入力する前提であり、本ツールは所得控除額を計算しない。",
    "住民税所得割は10%固定の概算値であり、税源移譲による人的控除額の差の調整(調整控除)は入力された場合のみ税額控除として反映する。",
    "上場株式等の譲渡所得・一般株式等(非上場株式)の譲渡所得等・先物取引に係る雑所得等はそれぞれ別プールの申告分離課税のため、損益通算はできない。",
  ];
  if (nonListedInvestmentTaxableGainJpy.greaterThan(0)) {
    notes.push(
      "一般株式等(非上場株式)の譲渡所得等には譲渡損失の繰越控除制度(措置法37の12の2)が無いため、赤字の場合は当年限りで切り捨てる前提の金額を入力すること(繰越控除は上場株式等のみの制度)。",
    );
  }
  if (residentTaxPerCapitaLeviesJpy.greaterThan(0)) {
    notes.push(
      "住民税の均等割は入力された金額をそのまま合計住民税額に加算しており、税額控除の対象外(住宅ローン控除・外国税額控除後の所得割額に加算)である。ふるさと納税の上限額試算の基準となる住民税所得割額には含めていない。",
    );
  } else {
    notes.push(
      "住民税の均等割(自治体ごとに定額で課される部分。標準税率は年5,000円程度)は未入力のため合計住民税額に含めていない。",
    );
  }
  if (
    withheldNationalTaxJpy.greaterThan(0) ||
    withheldResidentTaxJpy.greaterThan(0) ||
    estimatedTaxPrepaymentJpy.greaterThan(0)
  ) {
    notes.push(
      "納付・還付見込み額は入力された源泉徴収税額・予定納税額を単純に差し引いた概算であり、延滞税・加算税等は含まない。",
    );
    notes.push(
      "特定口座(源泉徴収あり)内の株式等譲渡益・配当等の住民税相当額(通常5%)は、所得税と異なり確定申告時にその場で還付されるものではなく、翌年度の住民税(特別徴収・普通徴収)の額に反映される形で精算される。住民税分の納付・還付見込み額はその概算値であり、実際の精算時期・方法とは異なる。",
    );
    if (estimatedTaxPrepaymentJpy.greaterThan(0)) {
      notes.push(
        "予定納税額は所得税・復興特別所得税のみの制度で住民税には存在しないため、住民税の納付・還付見込み額には反映していない。",
      );
    }
  } else {
    notes.push(
      "源泉徴収税額・予定納税額を入力していないため、納付・還付見込み額は年間の税額そのものの概算値と一致する。",
    );
  }
  if (dividendMethodUsed !== dividend.recommendedMethod) {
    notes.push(
      `配当所得の課税方式に指定された「${dividendMethodUsed}」は、最も税負担が軽い「${dividend.recommendedMethod}」と異なる。`,
    );
  }
  if (residentTaxAdjustmentDeductionJpy.greaterThan(0)) {
    notes.push(
      "住民税の調整控除(税額控除)は住民税所得割額からのみ差し引き(所得税には対応する控除が無い)、住宅ローン控除・外国税額控除より先に適用する(自治体公式サイトで確認できる適用順序に基づく)。`/resident-tax-adjustment-deduction`の試算結果を前提とする。",
    );
    if (residentTaxAdjustmentDeductionAppliedJpy.lessThan(residentTaxAdjustmentDeductionJpy)) {
      notes.push(
        "住民税の調整控除額がその年の住民税所得割額を上回ったため、超過分は切り捨てて0円を下限とした(還付は生じない)。",
      );
    }
  }
  if (mortgageDeductionNationalTaxCreditJpy.greaterThan(0) || mortgageDeductionResidentTaxCreditJpy.greaterThan(0)) {
    notes.push(
      "住宅ローン控除(税額控除)は入力された控除額をそのまま合計税額(調整控除適用後)から差し引いており、所得税額・住民税所得割額の限度判定(住民税へ繰り越す額の算出)は`/mortgage-deduction`の試算結果を前提とする。",
    );
    if (
      mortgageDeductionNationalTaxAppliedJpy.lessThan(mortgageDeductionNationalTaxCreditJpy) ||
      mortgageDeductionResidentTaxAppliedJpy.lessThan(mortgageDeductionResidentTaxCreditJpy)
    ) {
      notes.push(
        "住宅ローン控除額がその年の所得税額・住民税額を上回ったため、超過分は切り捨てて0円を下限とした(還付は生じない)。",
      );
    }
  }
  if (donationTaxCreditJpy.greaterThan(0) || donationTaxCreditResidentTaxJpy.greaterThan(0)) {
    notes.push(
      "政党等・認定NPO法人等・公益社団法人等寄附金特別控除(税額控除)は、所得税分を住宅ローン控除適用後の所得税額から、住民税の寄附金控除(基本控除)分(認定NPO法人等・公益社団法人等への寄附のうち条例指定を受けている分のみ)を住宅ローン控除適用後の住民税額からそれぞれ差し引いており、`/donation-tax-credit`の試算結果を前提とする。",
    );
    if (
      donationTaxCreditAppliedJpy.lessThan(donationTaxCreditJpy) ||
      donationTaxCreditResidentTaxAppliedJpy.lessThan(donationTaxCreditResidentTaxJpy)
    ) {
      notes.push(
        "寄附金特別控除額が住宅ローン控除適用後の所得税額・住民税額を上回ったため、超過分は切り捨てて0円を下限とした(還付は生じない)。",
      );
    }
  }
  if (earthquakeRenovationDeductionJpy.greaterThan(0)) {
    notes.push(
      "住宅耐震改修特別控除(税額控除)は寄附金特別控除適用後の所得税額からのみ差し引く(住民税に相当する控除は無い)。`/earthquake-renovation-deduction`の試算結果を前提とする。",
    );
    if (earthquakeRenovationDeductionAppliedJpy.lessThan(earthquakeRenovationDeductionJpy)) {
      notes.push(
        "住宅耐震改修特別控除額が控除適用後の所得税額を上回ったため、超過分は切り捨てて0円を下限とした(繰越・還付は生じない)。",
      );
    }
  }
  if (energySavingRenovationDeductionJpy.greaterThan(0)) {
    notes.push(
      "省エネ改修工事の住宅特定改修特別税額控除(税額控除)は住宅耐震改修特別控除適用後の所得税額からのみ差し引く(住民税に相当する控除は無い)。`/energy-saving-renovation-deduction`の試算結果を前提とする。",
    );
    if (energySavingRenovationDeductionAppliedJpy.lessThan(energySavingRenovationDeductionJpy)) {
      notes.push(
        "省エネ改修工事の住宅特定改修特別税額控除額が控除適用後の所得税額を上回ったため、超過分は切り捨てて0円を下限とした(繰越・還付は生じない)。",
      );
    }
  }
  if (foreignTaxCreditNationalTaxCreditJpy.greaterThan(0) || foreignTaxCreditResidentTaxCreditJpy.greaterThan(0)) {
    notes.push(
      "外国税額控除(税額控除)は省エネ改修工事の住宅特定改修特別税額控除適用後の所得税額・寄附金特別控除適用後の住民税額から差し引いており、所得税・復興特別所得税・住民税それぞれの控除限度額の判定は`/foreign-tax-credit`の試算結果を前提とする。",
    );
    if (
      foreignTaxCreditNationalTaxAppliedJpy.lessThan(foreignTaxCreditNationalTaxCreditJpy) ||
      foreignTaxCreditResidentTaxAppliedJpy.lessThan(foreignTaxCreditResidentTaxCreditJpy)
    ) {
      notes.push(
        "外国税額控除額が控除適用後の所得税額・住民税額を上回ったため、超過分は切り捨てて0円を下限とした(還付は生じない)。",
      );
    }
  }
  if (distributionAdjustedForeignTaxCreditJpy.greaterThan(0)) {
    notes.push(
      "分配時調整外国税相当額控除(税額控除)は外国税額控除適用後の所得税額(復興特別所得税を含む)からのみ差し引く。外国税額控除と異なり控除限度額の計算・繰越は無く、住民税分は一次情報で条文・算式を確認できていないため対象外(`/distribution-adjusted-foreign-tax-credit`の試算結果を前提とする)。",
    );
    if (distributionAdjustedForeignTaxCreditAppliedJpy.lessThan(distributionAdjustedForeignTaxCreditJpy)) {
      notes.push(
        "分配時調整外国税相当額控除額が控除適用後の所得税額を上回ったため、超過分は切り捨てて0円を下限とした(繰越・還付は生じない)。",
      );
    }
  }

  // ふるさと納税の上限額計算で使う所得税の限界税率は、超過累進税率が適用される
  // 総合課税分の課税所得金額(配当所得を総合課税で選んだ場合はそれも上乗せした金額)に
  // 対応する速算表の税率を用いる(申告分離課税分は税率が別建てのため含めない)。
  // また上限額の算出自体は調整控除適用後・住宅ローン控除適用前の住民税所得割額を
  // 基準とする(実際のふるさと納税上限額の速算式も調整控除後の所得割額を基準とするため。
  // 住宅ローン控除・外国税額控除等それ以外の税額控除による変動はふるさと納税上限額の
  // 試算に含めない、既存の簡略化を維持する)。
  const comprehensiveTaxableIncomeForMarginalRateJpy =
    dividendMethodUsed === "COMPREHENSIVE"
      ? comprehensiveTaxableIncomeExcludingDividendJpy.plus(dividendResult.taxableDividendJpy)
      : comprehensiveTaxableIncomeExcludingDividendJpy;
  const totalTaxJpy = totalNationalTaxJpy.plus(totalResidentTaxJpy);
  const furusatoNozei = estimateFurusatoNozeiLimit({
    residentTaxIncomeLeviedJpy: totalResidentTaxBeforeMortgageDeductionJpy,
    marginalIncomeTaxRate: marginalIncomeTaxRate(comprehensiveTaxableIncomeForMarginalRateJpy),
  });

  return {
    comprehensiveTaxableIncomeExcludingDividendJpy,
    dividend,
    dividendMethodUsed,
    dividendResultUsed: dividendResult,
    comprehensiveNationalTaxJpy,
    comprehensiveResidentTaxJpy,
    investmentNationalTaxJpy,
    investmentResidentTaxJpy,
    nonListedInvestmentNationalTaxJpy,
    nonListedInvestmentResidentTaxJpy,
    futuresNationalTaxJpy,
    futuresResidentTaxJpy,
    totalResidentTaxBeforeAdjustmentDeductionJpy,
    residentTaxAdjustmentDeductionJpy,
    residentTaxAdjustmentDeductionAppliedJpy,
    totalNationalTaxBeforeMortgageDeductionJpy,
    totalResidentTaxBeforeMortgageDeductionJpy,
    mortgageDeductionNationalTaxAppliedJpy,
    mortgageDeductionResidentTaxAppliedJpy,
    donationTaxCreditAppliedJpy,
    donationTaxCreditResidentTaxAppliedJpy,
    totalNationalTaxAfterDonationTaxCreditJpy,
    totalResidentTaxAfterDonationTaxCreditJpy,
    totalNationalTaxAfterMortgageDeductionJpy,
    totalResidentTaxAfterMortgageDeductionJpy,
    earthquakeRenovationDeductionAppliedJpy,
    totalNationalTaxAfterEarthquakeRenovationDeductionJpy,
    energySavingRenovationDeductionAppliedJpy,
    totalNationalTaxAfterEnergySavingRenovationDeductionJpy,
    foreignTaxCreditNationalTaxAppliedJpy,
    foreignTaxCreditResidentTaxAppliedJpy,
    distributionAdjustedForeignTaxCreditAppliedJpy,
    totalNationalTaxJpy,
    residentTaxPerCapitaLeviesJpy,
    totalResidentTaxJpy,
    totalTaxJpy,
    furusatoNozei,
    withheldNationalTaxJpy,
    withheldResidentTaxJpy,
    estimatedTaxPrepaymentJpy,
    nationalTaxBalanceJpy,
    residentTaxBalanceJpy,
    totalTaxBalanceJpy,
    notes,
  };
}
