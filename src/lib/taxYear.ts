// ビルドターゲットに応じた既定実装の切り替え(next.config.tsのresolveAlias経由)
// のため、相対パスではなく`@/`エイリアス経由でimportする必要がある
// (README「現在の最優先事項」フェーズ5-1-3b参照)。
import { createDefaultTaxYearRepository } from "@/lib/repositories/defaultTaxYearRepository";

const taxYearRepository = createDefaultTaxYearRepository();

export async function getOrCreateTaxYear(year: number) {
  return taxYearRepository.getOrCreateTaxYear(year);
}

export async function listTaxYears(): Promise<number[]> {
  return taxYearRepository.listTaxYears();
}
