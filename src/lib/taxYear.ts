// フェーズ5-1-3b: ビルドターゲット(自宅サーバー版/スタンドアロン版)に応じて
// `defaultTaxYearRepository`の実体が切り替わる(`@/`alias importが前提。
// `defaultTaxYearRepository.ts`のコメント参照)。
import { defaultTaxYearRepository } from "@/lib/repositories/defaultTaxYearRepository";

export async function getOrCreateTaxYear(year: number) {
  return defaultTaxYearRepository.getOrCreateTaxYear(year);
}

export async function listTaxYears(): Promise<number[]> {
  return defaultTaxYearRepository.listTaxYears();
}
