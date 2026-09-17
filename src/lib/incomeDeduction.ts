import { Decimal } from "decimal.js";
import { prisma } from "./db";

/**
 * 所得控除試算画面(医療費控除・生命保険料控除・小規模企業共済等掛金控除
 * (iDeCo等)・社会保険料控除)の計算結果を年分ごとにDB(`IncomeDeduction`)へ
 * 保存し、`/tax-estimate`の「給与所得等の課税所得金額」の初期値に自動反映する
 * ための集計ロジック。各試算画面自体の計算式(控除額そのものの算出)は
 * 従来通りそれぞれの専用モジュール(medicalExpenseDeduction.ts等)が担う。
 */

export const INCOME_DEDUCTION_TYPES = [
  "MEDICAL_EXPENSE",
  "LIFE_INSURANCE",
  "SMALL_BUSINESS_MUTUAL_AID",
  "SOCIAL_INSURANCE",
] as const;

export type IncomeDeductionType = (typeof INCOME_DEDUCTION_TYPES)[number];

export const INCOME_DEDUCTION_TYPE_LABELS: Record<IncomeDeductionType, string> = {
  MEDICAL_EXPENSE: "医療費控除",
  LIFE_INSURANCE: "生命保険料控除",
  SMALL_BUSINESS_MUTUAL_AID: "小規模企業共済等掛金控除(iDeCo等)",
  SOCIAL_INSURANCE: "社会保険料控除",
};

export function isIncomeDeductionType(value: string): value is IncomeDeductionType {
  return (INCOME_DEDUCTION_TYPES as readonly string[]).includes(value);
}

export interface IncomeDeductionEntry {
  type: IncomeDeductionType;
  /** 所得税の控除額 */
  incomeTaxAmountJpy: Decimal.Value;
  /** 住民税の控除額(生命保険料控除以外は incomeTaxAmountJpy と同額) */
  residentTaxAmountJpy: Decimal.Value;
}

export interface IncomeDeductionSummaryEntry {
  type: IncomeDeductionType;
  incomeTaxAmountJpy: Decimal;
  residentTaxAmountJpy: Decimal;
}

export interface IncomeDeductionSummary {
  entries: IncomeDeductionSummaryEntry[];
  /** 登録済みの所得控除の合計額(所得税ベース) */
  totalIncomeTaxAmountJpy: Decimal;
  /** 登録済みの所得控除の合計額(住民税ベース) */
  totalResidentTaxAmountJpy: Decimal;
}

/**
 * 登録済みの所得控除エントリ(区分ごとに最大1件)を合算する。
 * DBアクセスを含まない純粋関数のため、テストしやすいよう独立させている。
 */
export function summarizeIncomeDeductions(
  entries: IncomeDeductionEntry[],
): IncomeDeductionSummary {
  const normalized: IncomeDeductionSummaryEntry[] = entries.map((entry) => ({
    type: entry.type,
    incomeTaxAmountJpy: new Decimal(entry.incomeTaxAmountJpy),
    residentTaxAmountJpy: new Decimal(entry.residentTaxAmountJpy),
  }));

  const totalIncomeTaxAmountJpy = normalized.reduce(
    (total, entry) => total.plus(entry.incomeTaxAmountJpy),
    new Decimal(0),
  );
  const totalResidentTaxAmountJpy = normalized.reduce(
    (total, entry) => total.plus(entry.residentTaxAmountJpy),
    new Decimal(0),
  );

  return { entries: normalized, totalIncomeTaxAmountJpy, totalResidentTaxAmountJpy };
}

/**
 * 指定した年分に登録済みの所得控除エントリ(区分ごとに最大1件)をDBから読み出す。
 * まだ`TaxYear`が作成されていない年は登録が存在しないため空配列を返す。
 */
export async function getIncomeDeductionEntries(year: number): Promise<IncomeDeductionEntry[]> {
  const taxYear = await prisma.taxYear.findUnique({ where: { year } });
  if (!taxYear) return [];

  const records = await prisma.incomeDeduction.findMany({
    where: { taxYearId: taxYear.id },
  });

  return records.map((record) => ({
    type: record.type as IncomeDeductionType,
    incomeTaxAmountJpy: record.incomeTaxAmountJpy.toString(),
    residentTaxAmountJpy: record.residentTaxAmountJpy.toString(),
  }));
}

/** `getIncomeDeductionEntries`の結果から、指定した区分の登録済みエントリのみ取り出す */
export function findIncomeDeductionEntry(
  entries: IncomeDeductionEntry[],
  type: IncomeDeductionType,
): IncomeDeductionEntry | null {
  return entries.find((entry) => entry.type === type) ?? null;
}
