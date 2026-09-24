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
  "EARTHQUAKE_INSURANCE",
  "SMALL_BUSINESS_MUTUAL_AID",
  "SOCIAL_INSURANCE",
  "SELF_MEDICATION",
  "SPOUSE",
  "DEPENDENT",
  "BASIC",
  "DISABILITY",
  "WIDOW_SINGLE_PARENT",
  "WORKING_STUDENT",
  "CASUALTY_LOSS",
  "DONATION",
  "SPECIFIC_EXPENSE",
  "INCOME_AMOUNT_ADJUSTMENT",
] as const;

export type IncomeDeductionType = (typeof INCOME_DEDUCTION_TYPES)[number];

export const INCOME_DEDUCTION_TYPE_LABELS: Record<IncomeDeductionType, string> = {
  MEDICAL_EXPENSE: "医療費控除",
  LIFE_INSURANCE: "生命保険料控除",
  EARTHQUAKE_INSURANCE: "地震保険料控除",
  SMALL_BUSINESS_MUTUAL_AID: "小規模企業共済等掛金控除(iDeCo等)",
  SOCIAL_INSURANCE: "社会保険料控除",
  SELF_MEDICATION: "セルフメディケーション税制",
  SPOUSE: "配偶者控除・配偶者特別控除",
  DEPENDENT: "扶養控除",
  BASIC: "基礎控除",
  DISABILITY: "障害者控除",
  WIDOW_SINGLE_PARENT: "寡婦控除・ひとり親控除",
  WORKING_STUDENT: "勤労学生控除",
  CASUALTY_LOSS: "雑損控除",
  DONATION: "寄附金控除(ふるさと納税等)",
  SPECIFIC_EXPENSE: "特定支出控除",
  INCOME_AMOUNT_ADJUSTMENT: "所得金額調整控除",
};

/**
 * 特定支出控除(所得税法57条の2)・所得金額調整控除(措置法41条の3の3)は、
 * 厳密には他の区分のような「所得控除」ではなく給与所得の計算上の控除
 * (申告書第一表の給与所得金額欄に反映)である。本ツールでは「給与所得等の
 * 課税所得金額」への影響という観点で他の所得控除と同様に合算して試算する
 * 簡略化としているため、登録されている場合はその旨を注記に含める。
 */
const NON_INCOME_DEDUCTION_TYPES: readonly IncomeDeductionType[] = [
  "SPECIFIC_EXPENSE",
  "INCOME_AMOUNT_ADJUSTMENT",
];

export function isIncomeDeductionType(value: string): value is IncomeDeductionType {
  return (INCOME_DEDUCTION_TYPES as readonly string[]).includes(value);
}

/**
 * 医療費控除とセルフメディケーション税制は選択制で併用できないため、
 * 合計額(`summarizeIncomeDeductions`)の算出では両方が登録されていても
 * 有利な方のみを1件分として合計に含める。
 */
const MUTUALLY_EXCLUSIVE_MEDICAL_TYPES: readonly IncomeDeductionType[] = [
  "MEDICAL_EXPENSE",
  "SELF_MEDICATION",
];

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
  /** 合計額の算出にあたっての注記(医療費控除とセルフメディケーション税制が両方登録されている場合等) */
  notes: string[];
}

/**
 * 登録済みの所得控除エントリ(区分ごとに最大1件)を合算する。
 * DBアクセスを含まない純粋関数のため、テストしやすいよう独立させている。
 *
 * 医療費控除とセルフメディケーション税制は選択制のため、両方が登録されている
 * 場合は`entries`にはどちらも含めて表示しつつ、合計額には所得税ベースの控除額が
 * 大きい方のみを1件分として反映する。
 */
export function summarizeIncomeDeductions(
  entries: IncomeDeductionEntry[],
): IncomeDeductionSummary {
  const normalized: IncomeDeductionSummaryEntry[] = entries.map((entry) => ({
    type: entry.type,
    incomeTaxAmountJpy: new Decimal(entry.incomeTaxAmountJpy),
    residentTaxAmountJpy: new Decimal(entry.residentTaxAmountJpy),
  }));

  const medicalEntries = normalized.filter((entry) =>
    MUTUALLY_EXCLUSIVE_MEDICAL_TYPES.includes(entry.type),
  );
  const otherEntries = normalized.filter(
    (entry) => !MUTUALLY_EXCLUSIVE_MEDICAL_TYPES.includes(entry.type),
  );

  const notes: string[] = [];
  let contributingMedicalEntry: IncomeDeductionSummaryEntry | null = medicalEntries[0] ?? null;
  if (medicalEntries.length > 1) {
    contributingMedicalEntry = medicalEntries.reduce((best, entry) =>
      entry.incomeTaxAmountJpy.greaterThan(best.incomeTaxAmountJpy) ? entry : best,
    );
    notes.push(
      `医療費控除とセルフメディケーション税制は選択制のため、合計額には有利な方(${
        INCOME_DEDUCTION_TYPE_LABELS[contributingMedicalEntry.type]
      })のみを反映した。`,
    );
  }

  const contributingEntries = contributingMedicalEntry
    ? [...otherEntries, contributingMedicalEntry]
    : otherEntries;

  const totalIncomeTaxAmountJpy = contributingEntries.reduce(
    (total, entry) => total.plus(entry.incomeTaxAmountJpy),
    new Decimal(0),
  );
  const totalResidentTaxAmountJpy = contributingEntries.reduce(
    (total, entry) => total.plus(entry.residentTaxAmountJpy),
    new Decimal(0),
  );

  const registeredNonIncomeDeductionTypes = normalized
    .filter((entry) => NON_INCOME_DEDUCTION_TYPES.includes(entry.type))
    .map((entry) => INCOME_DEDUCTION_TYPE_LABELS[entry.type]);
  if (registeredNonIncomeDeductionTypes.length > 0) {
    notes.push(
      `${registeredNonIncomeDeductionTypes.join("・")}は所得税法上「所得控除」ではなく給与所得の計算上の控除(申告書第一表の給与所得金額欄に反映)だが、本ツールでは他の所得控除と同様に合算して試算する簡略化としている。`,
    );
  }

  return { entries: normalized, totalIncomeTaxAmountJpy, totalResidentTaxAmountJpy, notes };
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
