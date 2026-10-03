import { taxYearRepository } from "@/lib/repositories/defaultTaxYearRepository";

export async function getOrCreateTaxYear(year: number) {
  return taxYearRepository.getOrCreateTaxYear(year);
}

export async function listTaxYears(): Promise<number[]> {
  return taxYearRepository.listTaxYears();
}
