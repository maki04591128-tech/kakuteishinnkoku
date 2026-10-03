// 自宅サーバー版の既定実装。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)では
// next.config.tsのresolveAlias設定により`defaultTaxYearRepository.standalone.ts`に
// 差し替えられ、このファイル(と依存先の`taxYearRepository.prisma.ts`・`@prisma/client`)
// はビルド対象に含まれない(フェーズ5-1-3b。`@/lib/authUi`と同種のパターン)。
//
// 各モジュールはこれまで個別に`createPrismaTaxYearRepository()`を呼び出していたが、
// ビルドターゲットで切り替えられるようにするため、この`taxYearRepository`
// シングルトンを`@/lib/repositories/defaultTaxYearRepository`経由で参照する形に
// 統一する(importはresolveAliasが拾える絶対パス表記にすること。相対パスでは
// 差し替えが効かない)。
import { createPrismaTaxYearRepository } from "./taxYearRepository.prisma";
import type { TaxYearRepository } from "./taxYearRepository";

export const taxYearRepository: TaxYearRepository = createPrismaTaxYearRepository();
