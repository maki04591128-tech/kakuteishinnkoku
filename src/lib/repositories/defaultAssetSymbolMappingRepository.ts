// 自宅サーバー版の既定実装。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)では
// next.config.tsのresolveAlias設定により
// `defaultAssetSymbolMappingRepository.standalone.ts`に差し替えられ、このファイル
// (と依存先の`assetSymbolMappingRepository.prisma.ts`・`@prisma/client`)は
// ビルド対象に含まれない(フェーズ5-1-3b。`defaultTaxYearRepository.ts`と同種の
// パターン)。
//
// 各モジュールはこれまで個別に`createPrismaAssetSymbolMappingRepository()`を
// 呼び出していたが、ビルドターゲットで切り替えられるようにするため、この
// `assetSymbolMappingRepository`シングルトンを
// `@/lib/repositories/defaultAssetSymbolMappingRepository`経由で参照する形に
// 統一する(importはresolveAliasが拾える絶対パス表記にすること。相対パスでは
// 差し替えが効かない)。
import { createPrismaAssetSymbolMappingRepository } from "./assetSymbolMappingRepository.prisma";
import type { AssetSymbolMappingRepository } from "./assetSymbolMappingRepository";

export const assetSymbolMappingRepository: AssetSymbolMappingRepository =
  createPrismaAssetSymbolMappingRepository();
