import { describe, expect, it } from "vitest";
import { estimateEmploymentIncome } from "./employmentIncome";

describe("estimateEmploymentIncome", () => {
  it("給与収入500万円(年分未指定・令和6年分以前の速算表)は控除144万円・所得356万円", () => {
    const result = estimateEmploymentIncome({ grossSalaryJpy: 5_000_000 });

    expect(result.employmentIncomeDeductionJpy.toNumber()).toBe(1_440_000);
    expect(result.employmentIncomeJpy.toNumber()).toBe(3_560_000);
  });

  it("給与収入0円は控除・所得ともに0円(控除は収入額でクランプされる)", () => {
    const result = estimateEmploymentIncome({ grossSalaryJpy: 0 });

    expect(result.employmentIncomeDeductionJpy.toNumber()).toBe(0);
    expect(result.employmentIncomeJpy.toNumber()).toBe(0);
  });

  it("給与収入1000万円(令和6年分以前)は控除195万円で頭打ち", () => {
    const result = estimateEmploymentIncome({ grossSalaryJpy: 10_000_000 });

    expect(result.employmentIncomeDeductionJpy.toNumber()).toBe(1_950_000);
    expect(result.employmentIncomeJpy.toNumber()).toBe(8_050_000);
  });

  it("令和7年分・給与収入100万円は最低保障額65万円が適用される", () => {
    const result = estimateEmploymentIncome({ year: 2025, grossSalaryJpy: 1_000_000 });

    expect(result.employmentIncomeDeductionJpy.toNumber()).toBe(650_000);
    expect(result.employmentIncomeJpy.toNumber()).toBe(350_000);
  });

  it("給与収入がマイナスの場合はエラー", () => {
    expect(() => estimateEmploymentIncome({ grossSalaryJpy: -1 })).toThrow();
  });
});
