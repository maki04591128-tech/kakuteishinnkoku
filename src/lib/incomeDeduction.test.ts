import { describe, expect, it } from "vitest";
import { findIncomeDeductionEntry, summarizeIncomeDeductions } from "./incomeDeduction";

describe("summarizeIncomeDeductions", () => {
  it("区分ごとのエントリを合算する", () => {
    const summary = summarizeIncomeDeductions([
      { type: "MEDICAL_EXPENSE", incomeTaxAmountJpy: 150_000, residentTaxAmountJpy: 150_000 },
      {
        type: "LIFE_INSURANCE",
        incomeTaxAmountJpy: 100_000,
        residentTaxAmountJpy: 70_000,
      },
      {
        type: "SOCIAL_INSURANCE",
        incomeTaxAmountJpy: 300_000,
        residentTaxAmountJpy: 300_000,
      },
    ]);

    expect(summary.totalIncomeTaxAmountJpy.toNumber()).toBe(550_000);
    expect(summary.totalResidentTaxAmountJpy.toNumber()).toBe(520_000);
    expect(summary.entries).toHaveLength(3);
    expect(summary.notes).toHaveLength(0);
  });

  it("エントリが無い場合は合計0を返す", () => {
    const summary = summarizeIncomeDeductions([]);

    expect(summary.totalIncomeTaxAmountJpy.toNumber()).toBe(0);
    expect(summary.totalResidentTaxAmountJpy.toNumber()).toBe(0);
    expect(summary.entries).toHaveLength(0);
  });

  it("医療費控除とセルフメディケーション税制が両方登録されている場合は有利な方のみ合計に含める", () => {
    const summary = summarizeIncomeDeductions([
      { type: "MEDICAL_EXPENSE", incomeTaxAmountJpy: 150_000, residentTaxAmountJpy: 150_000 },
      { type: "SELF_MEDICATION", incomeTaxAmountJpy: 28_000, residentTaxAmountJpy: 28_000 },
      {
        type: "SOCIAL_INSURANCE",
        incomeTaxAmountJpy: 300_000,
        residentTaxAmountJpy: 300_000,
      },
    ]);

    // 両方のエントリは表示のため保持するが、合計には医療費控除150,000円のみ加算する
    expect(summary.entries).toHaveLength(3);
    expect(summary.totalIncomeTaxAmountJpy.toNumber()).toBe(450_000);
    expect(summary.totalResidentTaxAmountJpy.toNumber()).toBe(450_000);
    expect(summary.notes.join("")).toContain("医療費控除");
  });
});

describe("findIncomeDeductionEntry", () => {
  it("指定した区分のエントリを返す", () => {
    const entries = [
      { type: "MEDICAL_EXPENSE" as const, incomeTaxAmountJpy: 150_000, residentTaxAmountJpy: 150_000 },
    ];

    expect(findIncomeDeductionEntry(entries, "MEDICAL_EXPENSE")?.incomeTaxAmountJpy).toBe(150_000);
    expect(findIncomeDeductionEntry(entries, "SOCIAL_INSURANCE")).toBeNull();
  });
});
