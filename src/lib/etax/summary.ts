import { Decimal } from "decimal.js";
import type { CryptoPortfolioYearResult } from "../crypto/calculator";
import type { CryptoMarginPortfolioYearResult } from "../crypto/marginCalculator";
import type { InvestmentPortfolioYearResult } from "../investment/calculator";
import type { FuturesPortfolioYearResult } from "../investment/futuresIncome";
import {
  calculateLossCarryforward,
  type LossCarryforwardResult,
} from "../investment/lossCarryforward";

/**
 * 確定申告の主要な所得区分に対応した年間サマリー。
 *
 * 注意: このモジュールは e-Tax への直接送信は行わない。
 * 個人が e-Tax で電子申告を行うには、マイナンバーカードの電子署名
 * (ICカードリーダライタ or スマホ読み取り)を用いて
 * 「確定申告書等作成コーナー」または「e-Taxソフト」から送信する必要があり、
 * これは国税庁が提供する公式クライアントを介してのみ可能。
 * 第三者ツールが認証情報を代行してe-Taxへ送信することは想定されておらず、
 * 本ツールもそれを行わない。
 *
 * 本ツールが提供するのは、「確定申告書等作成コーナー」の該当入力欄
 * (暗号資産:雑所得の内訳、株式等:譲渡所得の内訳書 等)に入力する際の
 * 下書き・集計を助けるCSV/サマリーの生成である。
 */
export interface TaxFilingSummary {
  year: number;
  /** 雑所得(暗号資産。現物取引+証拠金取引の決済損益の合計) */
  cryptoMiscIncomeJpy: Decimal;
  /** 雑所得(暗号資産)のうち現物取引分 */
  cryptoSpotIncomeJpy: Decimal;
  /** 雑所得(暗号資産)のうち証拠金(レバレッジ)取引の決済損益分 */
  cryptoMarginIncomeJpy: Decimal;
  /** 譲渡所得(上場株式等・申告分離課税、繰越控除適用前の金額) */
  investmentCapitalGainJpy: Decimal;
  /** 配当所得(申告分離課税を選択した場合の額。総合課税を選ぶ場合は別途税率適用が必要) */
  investmentDividendJpy: Decimal;
  /** 上場株式等の譲渡損失の繰越控除(3年間)の適用結果 */
  investmentLossCarryforward: LossCarryforwardResult;
  /**
   * 譲渡所得等(一般株式等・非上場株式・申告分離課税)。上場株式等とは別プール
   * で損益通算はできず、繰越控除制度(措置法37の12の2)も上場株式等のみのため
   * 対象外(機能54参照)。
   */
  nonListedInvestmentCapitalGainJpy: Decimal;
  /** 一般株式等(非上場株式)の配当等(参考値。総合課税・少額配当の申告不要以外の課税方式は選べない点が上場株式等と異なる) */
  nonListedInvestmentDividendJpy: Decimal;
  /**
   * 先物取引に係る雑所得等(FX・先物・CFD等)の繰越控除(3年間)の適用結果。
   * 上場株式等の譲渡所得・暗号資産の雑所得とは別区分の申告分離課税のため、
   * 損益通算・繰越控除は別プールで管理される。
   */
  futuresLossCarryforward: LossCarryforwardResult;
  /**
   * `/mortgage-deduction`で登録済みの住宅ローン控除(税額控除)。未登録の場合はundefined。
   */
  mortgageDeduction?: {
    nationalTaxCreditJpy: Decimal;
    residentTaxCreditJpy: Decimal;
  };
  /**
   * `/foreign-tax-credit`で登録済みの外国税額控除(税額控除)の合計控除額。
   * 未登録の場合はundefined(控除の計算に必要な所得税額・所得総額等はDBに保存
   * されない都度入力のため、登録するまでは自動反映されない)。
   */
  foreignTaxCredit?: {
    totalCreditJpy: Decimal;
  };
  /**
   * `/donation-tax-credit`で登録済みの政党等・認定NPO法人等・公益社団法人等
   * 寄附金特別控除(税額控除)の合計控除額(所得税分)と、認定NPO法人等・
   * 公益社団法人等への寄附のうち条例指定を受けている分の住民税の寄附金控除
   * (基本控除)額。未登録の場合はundefined。
   */
  donationTaxCredit?: {
    totalCreditJpy: Decimal;
    residentTaxBasicDeductionJpy: Decimal;
  };
  /**
   * `/distribution-adjusted-foreign-tax-credit`で登録済みの分配時調整外国税相当額
   * 控除(税額控除・所得税分のみ)。未登録の場合はundefined。
   */
  distributionAdjustedForeignTaxCredit?: {
    creditJpy: Decimal;
  };
  /**
   * `/resident-tax-adjustment-deduction`で登録済みの住民税の調整控除(税額控除・
   * 住民税所得割分のみ)。所得税に対応する控除は無いため所得税額には影響しない。
   * 未登録の場合はundefined。
   */
  residentTaxAdjustmentDeduction?: {
    adjustmentDeductionJpy: Decimal;
  };
  /**
   * `/earthquake-renovation-deduction`で登録済みの住宅耐震改修特別控除(税額控除・
   * 所得税分のみ)。住民税に相当する控除は存在しないため住民税額には影響しない。
   * 未登録の場合はundefined。
   */
  earthquakeRenovationDeduction?: {
    creditJpy: Decimal;
  };
  /**
   * `/energy-saving-renovation-deduction`で登録済みの省エネ改修工事の住宅特定
   * 改修特別税額控除(税額控除・所得税分のみ)。住民税に相当する控除は存在しないため
   * 住民税額には影響しない。未登録の場合はundefined。
   */
  energySavingRenovationDeduction?: {
    creditJpy: Decimal;
  };
  /**
   * `/barrier-free-renovation-deduction`で登録済みのバリアフリー改修工事の住宅特定
   * 改修特別税額控除(税額控除・所得税分のみ)。住民税に相当する控除は存在しないため
   * 住民税額には影響しない。未登録の場合はundefined。
   */
  barrierFreeRenovationDeduction?: {
    creditJpy: Decimal;
  };
  /**
   * `/multi-household-renovation-deduction`で登録済みの多世帯同居改修工事の住宅特定
   * 改修特別税額控除(税額控除・所得税分のみ)。住民税に相当する控除は存在しないため
   * 住民税額には影響しない。未登録の場合はundefined。
   */
  multiHouseholdRenovationDeduction?: {
    creditJpy: Decimal;
  };
  /**
   * `/durability-improvement-renovation-deduction`で登録済みの耐久性向上改修工事の
   * 住宅特定改修特別税額控除(税額控除・所得税分のみ)。住民税に相当する控除は存在しないため
   * 住民税額には影響しない。未登録の場合はundefined。
   */
  durabilityImprovementRenovationDeduction?: {
    creditJpy: Decimal;
  };
  /**
   * `/child-rearing-renovation-deduction`で登録済みの子育て対応改修工事の
   * 住宅特定改修特別税額控除(税額控除・所得税分のみ)。住民税に相当する控除は存在しないため
   * 住民税額には影響しない。未登録の場合はundefined。
   */
  childRearingRenovationDeduction?: {
    creditJpy: Decimal;
  };
}

export function buildTaxFilingSummary(
  year: number,
  crypto: CryptoPortfolioYearResult,
  investment: InvestmentPortfolioYearResult,
  lossCarryforward?: LossCarryforwardResult,
  cryptoMargin?: CryptoMarginPortfolioYearResult,
  futures?: FuturesPortfolioYearResult,
  futuresLossCarryforward?: LossCarryforwardResult,
  mortgageDeduction?: { nationalTaxCreditJpy: Decimal; residentTaxCreditJpy: Decimal },
  foreignTaxCredit?: { totalCreditJpy: Decimal },
  investmentNonListed?: InvestmentPortfolioYearResult,
  donationTaxCredit?: { totalCreditJpy: Decimal; residentTaxBasicDeductionJpy: Decimal },
  distributionAdjustedForeignTaxCredit?: { creditJpy: Decimal },
  residentTaxAdjustmentDeduction?: { adjustmentDeductionJpy: Decimal },
  earthquakeRenovationDeduction?: { creditJpy: Decimal },
  energySavingRenovationDeduction?: { creditJpy: Decimal },
  barrierFreeRenovationDeduction?: { creditJpy: Decimal },
  multiHouseholdRenovationDeduction?: { creditJpy: Decimal },
  durabilityImprovementRenovationDeduction?: { creditJpy: Decimal },
  childRearingRenovationDeduction?: { creditJpy: Decimal },
): TaxFilingSummary {
  const cryptoMarginIncomeJpy = cryptoMargin?.totalRealizedGainJpy ?? new Decimal(0);
  const futuresRealizedGainJpy = futures?.totalRealizedGainJpy ?? new Decimal(0);
  return {
    year,
    cryptoMiscIncomeJpy: crypto.totalRealizedGainJpy.plus(cryptoMarginIncomeJpy),
    cryptoSpotIncomeJpy: crypto.totalRealizedGainJpy,
    cryptoMarginIncomeJpy,
    investmentCapitalGainJpy: investment.totalRealizedGainJpy,
    investmentDividendJpy: investment.totalDividendJpy,
    investmentLossCarryforward:
      lossCarryforward ??
      calculateLossCarryforward(year, investment.totalRealizedGainJpy, []),
    nonListedInvestmentCapitalGainJpy:
      investmentNonListed?.totalRealizedGainJpy ?? new Decimal(0),
    nonListedInvestmentDividendJpy: investmentNonListed?.totalDividendJpy ?? new Decimal(0),
    futuresLossCarryforward:
      futuresLossCarryforward ??
      calculateLossCarryforward(year, futuresRealizedGainJpy, []),
    mortgageDeduction,
    foreignTaxCredit,
    donationTaxCredit,
    distributionAdjustedForeignTaxCredit,
    residentTaxAdjustmentDeduction,
    earthquakeRenovationDeduction,
    energySavingRenovationDeduction,
    barrierFreeRenovationDeduction,
    multiHouseholdRenovationDeduction,
    durabilityImprovementRenovationDeduction,
    childRearingRenovationDeduction,
  };
}
