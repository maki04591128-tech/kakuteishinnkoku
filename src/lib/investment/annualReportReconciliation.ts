import { Decimal } from "decimal.js";

/**
 * 証券会社が発行する「特定口座年間取引報告書」との突合(取引の計上漏れ検出)。
 *
 * 年間取引報告書に記載される「譲渡の対価の額(収入金額)」と「配当等の額」は、
 * その口座の当年中の売却・配当の実績値そのものであり、取得費の平均単価計算
 * (前年繰越や複数口座の合算)に依存せず単純合計で再現できる。そのため、
 * この2項目に限ってアプリ内の InvestmentTrade から同じ証券会社・口座区分の
 * 取引を抽出して合計し、報告書の金額と突き合わせることで、入力漏れ・
 * 入力ミスを機械的に検知できる。
 *
 * 「取得費及び譲渡に要した費用の額等」は証券会社側が口座ごとに個別管理する
 * 取得原価であり、本ツールの譲渡所得計算(calculator.ts)は銘柄単位・
 * 全口座合算で平均単価を計算するため前提が異なる(同一銘柄を複数の証券会社・
 * 口座で保有している場合、口座ごとの取得費は一致しない)。したがって取得費・
 * 差引金額は自動突合の対象にはせず、報告書の値をそのまま参考表示するに留める。
 */

export type ReconciliationTradeType = "BUY" | "SELL" | "DIVIDEND";

export interface BrokerAnnualReportEntry {
  broker: string;
  accountType: string;
  /** 年間取引報告書「譲渡の対価の額(収入金額)」の合計 */
  proceedsJpy: Decimal.Value;
  /** 年間取引報告書「取得費及び譲渡に要した費用の額等」の合計(参考値) */
  acquisitionCostJpy: Decimal.Value;
  /** 年間取引報告書「配当等の額」の合計(任意) */
  dividendJpy?: Decimal.Value;
}

export interface ReconciliationTradeInput {
  broker: string | null | undefined;
  accountType: string;
  type: ReconciliationTradeType;
  quantity: Decimal.Value;
  unitPriceJpy: Decimal.Value;
  feeJpy?: Decimal.Value;
}

export interface BrokerReconciliationResult {
  broker: string;
  accountType: string;
  reportProceedsJpy: Decimal;
  /** 参考値。自動突合の対象外(コメント参照) */
  reportAcquisitionCostJpy: Decimal;
  /** 参考値。reportProceedsJpy - reportAcquisitionCostJpy */
  reportGainJpy: Decimal;
  reportDividendJpy: Decimal;
  /** アプリ内の取引明細から計算した、同じ証券会社・口座区分の売却収入金額の合計 */
  calculatedProceedsJpy: Decimal;
  /** アプリ内の取引明細から計算した、同じ証券会社・口座区分の配当等の額の合計 */
  calculatedDividendJpy: Decimal;
  proceedsDiffJpy: Decimal;
  dividendDiffJpy: Decimal;
  /** 突合対象になった取引明細の件数(売却+配当) */
  matchedTradeCount: number;
  /** 差額が端数処理の範囲(1円)を超えている場合 true */
  hasDiscrepancy: boolean;
}

const TOLERANCE_JPY = new Decimal(1);

function matchesReport(
  trade: ReconciliationTradeInput,
  report: Pick<BrokerAnnualReportEntry, "broker" | "accountType">,
): boolean {
  return (trade.broker ?? "") === report.broker && trade.accountType === report.accountType;
}

/**
 * 1件の年間取引報告書について、突合結果を計算する。DBに依存しない純粋関数。
 */
export function reconcileBrokerAnnualReport(
  report: BrokerAnnualReportEntry,
  trades: ReconciliationTradeInput[],
): BrokerReconciliationResult {
  const matching = trades.filter((t) => matchesReport(t, report) && t.type !== "BUY");

  let calculatedProceedsJpy = new Decimal(0);
  let calculatedDividendJpy = new Decimal(0);

  for (const trade of matching) {
    const quantity = new Decimal(trade.quantity);
    const unitPrice = new Decimal(trade.unitPriceJpy);
    const fee = trade.feeJpy !== undefined ? new Decimal(trade.feeJpy) : new Decimal(0);

    if (trade.type === "SELL") {
      calculatedProceedsJpy = calculatedProceedsJpy.plus(
        quantity.times(unitPrice).minus(fee),
      );
    } else if (trade.type === "DIVIDEND") {
      calculatedDividendJpy = calculatedDividendJpy.plus(quantity.times(unitPrice));
    }
  }

  const reportProceedsJpy = new Decimal(report.proceedsJpy);
  const reportAcquisitionCostJpy = new Decimal(report.acquisitionCostJpy);
  const reportDividendJpy = new Decimal(report.dividendJpy ?? 0);
  const reportGainJpy = reportProceedsJpy.minus(reportAcquisitionCostJpy);

  const proceedsDiffJpy = reportProceedsJpy.minus(calculatedProceedsJpy);
  const dividendDiffJpy = reportDividendJpy.minus(calculatedDividendJpy);

  const hasDiscrepancy =
    proceedsDiffJpy.abs().greaterThan(TOLERANCE_JPY) ||
    dividendDiffJpy.abs().greaterThan(TOLERANCE_JPY);

  return {
    broker: report.broker,
    accountType: report.accountType,
    reportProceedsJpy,
    reportAcquisitionCostJpy,
    reportGainJpy,
    reportDividendJpy,
    calculatedProceedsJpy,
    calculatedDividendJpy,
    proceedsDiffJpy,
    dividendDiffJpy,
    matchedTradeCount: matching.length,
    hasDiscrepancy,
  };
}

export function reconcileBrokerAnnualReports(
  reports: BrokerAnnualReportEntry[],
  trades: ReconciliationTradeInput[],
): BrokerReconciliationResult[] {
  return reports.map((report) => reconcileBrokerAnnualReport(report, trades));
}
