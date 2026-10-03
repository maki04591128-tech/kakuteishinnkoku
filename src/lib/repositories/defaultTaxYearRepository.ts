// 自宅サーバー版のデフォルト実装。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)では
// next.config.tsのresolveAlias設定により`defaultTaxYearRepository.standalone.ts`に
// 差し替えられ、このファイル(とその依存先の`./taxYearRepository.prisma`・`../db`・
// `@prisma/client`の実体)はスタンドアロン版バンドルに含まれない。
// (README「現在の最優先事項」フェーズ5-1-3bで導入したパターン。`src/lib/authUi.tsx`/
// `authUi.standalone.tsx`と同種)
import { createPrismaTaxYearRepository } from "./taxYearRepository.prisma";
import type { TaxYearRepository } from "./taxYearRepository";

export function createDefaultTaxYearRepository(): TaxYearRepository {
  return createPrismaTaxYearRepository();
}
