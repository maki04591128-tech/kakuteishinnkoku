import { createPrismaTaxYearRepository } from "./repositories/taxYearRepository";

const taxYearRepository = createPrismaTaxYearRepository();

export async function getOrCreateTaxYear(year: number) {
  return taxYearRepository.getOrCreateTaxYear(year);
}

export async function listTaxYears(): Promise<number[]> {
  return taxYearRepository.listTaxYears();
}
