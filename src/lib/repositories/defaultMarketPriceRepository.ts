// 自宅サーバー版の既定実装。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)では
// next.config.tsのresolveAlias設定により`defaultMarketPriceRepository.standalone.ts`
// に差し替えられ、このファイル(と依存先の`marketPriceRepository.prisma.ts`・
// `@prisma/client`)はビルド対象に含まれない(フェーズ5-1-3b。
// `defaultTaxYearRepository.ts`と同種のパターン)。
//
// 各モジュールはこれまで個別に`createPrismaMarketPriceRepository()`を
// 呼び出していたが、ビルドターゲットで切り替えられるようにするため、この
// `marketPriceRepository`シングルトンを
// `@/lib/repositories/defaultMarketPriceRepository`経由で参照する形に統一する
// (importはresolveAliasが拾える絶対パス表記にすること。相対パスでは差し替えが
// 効かない)。
import { createPrismaMarketPriceRepository } from "./marketPriceRepository.prisma";
import type { MarketPriceRepository } from "./marketPriceRepository";

export const marketPriceRepository: MarketPriceRepository =
  createPrismaMarketPriceRepository();
