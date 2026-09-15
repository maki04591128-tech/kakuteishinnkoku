import { Decimal } from "decimal.js";
import type { CryptoPortfolioYearResult } from "../crypto/calculator";
import type { InvestmentPortfolioYearResult } from "../investment/calculator";

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
  /** 雑所得(暗号資産) */
  cryptoMiscIncomeJpy: Decimal;
  /** 譲渡所得(上場株式等・申告分離課税) */
  investmentCapitalGainJpy: Decimal;
  /** 配当所得(申告分離課税を選択した場合の額。総合課税を選ぶ場合は別途税率適用が必要) */
  investmentDividendJpy: Decimal;
}

export function buildTaxFilingSummary(
  year: number,
  crypto: CryptoPortfolioYearResult,
  investment: InvestmentPortfolioYearResult,
): TaxFilingSummary {
  return {
    year,
    cryptoMiscIncomeJpy: crypto.totalRealizedGainJpy,
    investmentCapitalGainJpy: investment.totalRealizedGainJpy,
    investmentDividendJpy: investment.totalDividendJpy,
  };
}
