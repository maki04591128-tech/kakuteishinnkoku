// 自宅サーバー版の既定実装。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)では
// next.config.tsのresolveAlias設定により
// `defaultAssetBalanceSnapshotRepository.standalone.ts`に差し替えられ、この
// ファイル(と依存先の`assetBalanceSnapshotRepository.prisma.ts`・`@prisma/client`)は
// ビルド対象に含まれない(フェーズ5-1-3b。`defaultNisaLifetimeQuotaRepository.ts`と
// 同種のパターン)。
//
// 各モジュールはこれまで個別に`createPrismaAssetBalanceSnapshotRepository()`を
// 呼び出していたが、ビルドターゲットで切り替えられるようにするため、この
// `assetBalanceSnapshotRepository`シングルトンを
// `@/lib/repositories/defaultAssetBalanceSnapshotRepository`経由で参照する形に統一する
// (importはresolveAliasが拾える絶対パス表記にすること。相対パスでは差し替えが効かない)。
import { createPrismaAssetBalanceSnapshotRepository } from "./assetBalanceSnapshotRepository.prisma";
import type { AssetBalanceSnapshotRepository } from "./assetBalanceSnapshotRepository";

export const assetBalanceSnapshotRepository: AssetBalanceSnapshotRepository =
  createPrismaAssetBalanceSnapshotRepository();
