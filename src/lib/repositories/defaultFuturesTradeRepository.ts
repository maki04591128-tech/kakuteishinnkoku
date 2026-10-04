// 自宅サーバー版の既定実装。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)では
// next.config.tsのresolveAlias設定により
// `defaultFuturesTradeRepository.standalone.ts`に差し替えられ、この
// ファイル(と依存先の`futuresTradeRepository.prisma.ts`・`@prisma/client`)は
// ビルド対象に含まれない(フェーズ5-1-3b。`defaultCryptoTradeRepository.ts`と
// 同種のパターン)。
//
// 各モジュールはこれまで個別に`createPrismaFuturesTradeRepository()`を呼び出して
// いたが、ビルドターゲットで切り替えられるようにするため、この
// `futuresTradeRepository`シングルトンを
// `@/lib/repositories/defaultFuturesTradeRepository`経由で参照する形に統一する
// (importはresolveAliasが拾える絶対パス表記にすること。相対パスでは差し替えが効かない)。
import { createPrismaFuturesTradeRepository } from "./futuresTradeRepository.prisma";
import type { FuturesTradeRepository } from "./futuresTradeRepository";

export const futuresTradeRepository: FuturesTradeRepository =
  createPrismaFuturesTradeRepository();
