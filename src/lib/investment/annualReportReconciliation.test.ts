import { describe, expect, it } from "vitest";
import {
  reconcileBrokerAnnualReport,
  reconcileBrokerAnnualReports,
  type BrokerAnnualReportEntry,
  type ReconciliationTradeInput,
} from "./annualReportReconciliation";

describe("reconcileBrokerAnnualReport", () => {
  const report: BrokerAnnualReportEntry = {
    broker: "SBI証券",
    accountType: "SPECIFIC_WITHHOLDING",
    proceedsJpy: 500000,
    acquisitionCostJpy: 400000,
    dividendJpy: 10000,
  };

  it("一致する場合は差額0・不一致なしと判定する", () => {
    const trades: ReconciliationTradeInput[] = [
      {
        broker: "SBI証券",
        accountType: "SPECIFIC_WITHHOLDING",
        type: "SELL",
        quantity: 100,
        unitPriceJpy: 5001,
        feeJpy: 100,
      },
      {
        broker: "SBI証券",
        accountType: "SPECIFIC_WITHHOLDING",
        type: "DIVIDEND",
        quantity: 1,
        unitPriceJpy: 10000,
      },
    ];

    const result = reconcileBrokerAnnualReport(report, trades);

    expect(result.calculatedProceedsJpy.toString()).toBe("500000");
    expect(result.calculatedDividendJpy.toString()).toBe("10000");
    expect(result.proceedsDiffJpy.toString()).toBe("0");
    expect(result.dividendDiffJpy.toString()).toBe("0");
    expect(result.reportGainJpy.toString()).toBe("100000");
    expect(result.matchedTradeCount).toBe(2);
    expect(result.hasDiscrepancy).toBe(false);
  });

  it("売却取引が計上漏れの場合は収入金額の差額で検知する", () => {
    const trades: ReconciliationTradeInput[] = [
      {
        broker: "SBI証券",
        accountType: "SPECIFIC_WITHHOLDING",
        type: "SELL",
        quantity: 50,
        unitPriceJpy: 5001,
        feeJpy: 50,
      },
      {
        broker: "SBI証券",
        accountType: "SPECIFIC_WITHHOLDING",
        type: "DIVIDEND",
        quantity: 1,
        unitPriceJpy: 10000,
      },
    ];

    const result = reconcileBrokerAnnualReport(report, trades);

    expect(result.calculatedProceedsJpy.toString()).toBe("250000");
    expect(result.proceedsDiffJpy.toString()).toBe("250000");
    expect(result.hasDiscrepancy).toBe(true);
  });

  it("配当の計上漏れも差額で検知する", () => {
    const trades: ReconciliationTradeInput[] = [
      {
        broker: "SBI証券",
        accountType: "SPECIFIC_WITHHOLDING",
        type: "SELL",
        quantity: 100,
        unitPriceJpy: 5001,
        feeJpy: 100,
      },
    ];

    const result = reconcileBrokerAnnualReport(report, trades);

    expect(result.calculatedDividendJpy.toString()).toBe("0");
    expect(result.dividendDiffJpy.toString()).toBe("10000");
    expect(result.hasDiscrepancy).toBe(true);
  });

  it("1円未満の端数差は不一致として扱わない", () => {
    const nearReport: BrokerAnnualReportEntry = {
      ...report,
      proceedsJpy: 500000.4,
    };
    const trades: ReconciliationTradeInput[] = [
      {
        broker: "SBI証券",
        accountType: "SPECIFIC_WITHHOLDING",
        type: "SELL",
        quantity: 100,
        unitPriceJpy: 5001,
        feeJpy: 100,
      },
      {
        broker: "SBI証券",
        accountType: "SPECIFIC_WITHHOLDING",
        type: "DIVIDEND",
        quantity: 1,
        unitPriceJpy: 10000,
      },
    ];

    const result = reconcileBrokerAnnualReport(nearReport, trades);

    expect(result.hasDiscrepancy).toBe(false);
  });

  it("証券会社・口座区分が異なる取引は突合対象から除外する", () => {
    const trades: ReconciliationTradeInput[] = [
      {
        broker: "楽天証券",
        accountType: "SPECIFIC_WITHHOLDING",
        type: "SELL",
        quantity: 100,
        unitPriceJpy: 5001,
        feeJpy: 100,
      },
      {
        broker: "SBI証券",
        accountType: "NISA",
        type: "SELL",
        quantity: 100,
        unitPriceJpy: 5001,
      },
      {
        broker: null,
        accountType: "SPECIFIC_WITHHOLDING",
        type: "SELL",
        quantity: 100,
        unitPriceJpy: 5001,
      },
    ];

    const result = reconcileBrokerAnnualReport(report, trades);

    expect(result.matchedTradeCount).toBe(0);
    expect(result.calculatedProceedsJpy.toString()).toBe("0");
  });

  it("買付取引は収入金額の計算に含めない", () => {
    const trades: ReconciliationTradeInput[] = [
      {
        broker: "SBI証券",
        accountType: "SPECIFIC_WITHHOLDING",
        type: "BUY",
        quantity: 100,
        unitPriceJpy: 5001,
        feeJpy: 100,
      },
    ];

    const result = reconcileBrokerAnnualReport(report, trades);

    expect(result.matchedTradeCount).toBe(0);
    expect(result.calculatedProceedsJpy.toString()).toBe("0");
  });
});

describe("reconcileBrokerAnnualReports", () => {
  it("複数の証券会社・口座区分をそれぞれ独立に突合する", () => {
    const reports: BrokerAnnualReportEntry[] = [
      {
        broker: "SBI証券",
        accountType: "SPECIFIC_WITHHOLDING",
        proceedsJpy: 100000,
        acquisitionCostJpy: 80000,
      },
      {
        broker: "楽天証券",
        accountType: "SPECIFIC_WITHHOLDING",
        proceedsJpy: 200000,
        acquisitionCostJpy: 150000,
      },
    ];
    const trades: ReconciliationTradeInput[] = [
      {
        broker: "SBI証券",
        accountType: "SPECIFIC_WITHHOLDING",
        type: "SELL",
        quantity: 10,
        unitPriceJpy: 10000,
      },
      {
        broker: "楽天証券",
        accountType: "SPECIFIC_WITHHOLDING",
        type: "SELL",
        quantity: 20,
        unitPriceJpy: 10000,
      },
    ];

    const results = reconcileBrokerAnnualReports(reports, trades);

    expect(results).toHaveLength(2);
    expect(results[0].hasDiscrepancy).toBe(false);
    expect(results[1].hasDiscrepancy).toBe(false);
  });
});
