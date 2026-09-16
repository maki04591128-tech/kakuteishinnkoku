import { Decimal } from "decimal.js";
import type { CryptoPortfolioYearResult } from "../crypto/calculator";
import type { CryptoMarginPortfolioYearResult } from "../crypto/marginCalculator";
import type { InvestmentPortfolioYearResult } from "../investment/calculator";
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
}

export function buildTaxFilingSummary(
  year: number,
  crypto: CryptoPortfolioYearResult,
  investment: InvestmentPortfolioYearResult,
  lossCarryforward?: LossCarryforwardResult,
  cryptoMargin?: CryptoMarginPortfolioYearResult,
): TaxFilingSummary {
  const cryptoMarginIncomeJpy = cryptoMargin?.totalRealizedGainJpy ?? new Decimal(0);
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
  };
}
