// `@/lib/taxEstimatePageData`(自宅サーバー版・`"use server"`)と
// `@/lib/taxEstimatePageData.standalone`(スタンドアロン版)の両方から
// 共有される戻り値の型。`"use server"`を付けたファイルは非同期関数以外を
// exportできない制約があるため、型だけをこの共有ファイルに切り出す。
export interface TaxEstimatePageData {
  year: number;
  availableYears: number[];
  defaultOtherComprehensiveIncomeJpy: number;
  defaultCryptoMiscIncomeJpy: number;
  defaultInvestmentTaxableGainJpy: number;
  defaultNonListedInvestmentTaxableGainJpy: number;
  defaultFuturesTaxableGainJpy: number;
  defaultDividendIncomeJpy: number;
  defaultAvailableListedStockLossForDividendJpy: number;
  registeredIncomeDeductions: { label: string; incomeTaxAmountJpy: number; residentTaxAmountJpy: number }[];
  totalRegisteredIncomeTaxDeductionJpy: number;
  incomeDeductionNotes: string[];
  registeredEmploymentIncome: { grossSalaryJpy: number; employmentIncomeJpy: number } | null;
  registeredResidentTaxAdjustmentDeductionJpy: number | null;
  registeredMortgageDeduction: { nationalTaxCreditJpy: number; residentTaxCreditJpy: number } | null;
  registeredDonationTaxCreditJpy: number | null;
  registeredDonationTaxCreditResidentTaxJpy: number | null;
  registeredForeignTaxCredit: { nationalTaxCreditJpy: number; residentTaxCreditJpy: number } | null;
  registeredDistributionAdjustedForeignTaxCreditJpy: number | null;
  registeredEarthquakeRenovationDeductionJpy: number | null;
  registeredEnergySavingRenovationDeductionJpy: number | null;
  registeredBarrierFreeRenovationDeductionJpy: number | null;
  registeredMultiHouseholdRenovationDeductionJpy: number | null;
  registeredDurabilityImprovementRenovationDeductionJpy: number | null;
  registeredChildRearingRenovationDeductionJpy: number | null;
  registeredCertifiedHousingConstructionCreditJpy: number | null;
}
