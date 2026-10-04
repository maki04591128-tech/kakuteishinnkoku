// 自宅サーバー版の既定実装。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)では
// next.config.tsのresolveAlias設定により
// `defaultCryptoCreditTradeRepository.standalone.ts`に差し替えられ、この
// ファイル(と依存先の`cryptoCreditTradeRepository.prisma.ts`・`@prisma/client`)は
// ビルド対象に含まれない(フェーズ5-1-3b。`defaultCryptoMarginTradeRepository.ts`と
// 同種のパターン)。
//
// 各モジュールはこれまで個別に`createPrismaCryptoCreditTradeRepository()`を呼び出して
// いたが、ビルドターゲットで切り替えられるようにするため、この
// `cryptoCreditTradeRepository`シングルトンを
// `@/lib/repositories/defaultCryptoCreditTradeRepository`経由で参照する形に統一する
// (importはresolveAliasが拾える絶対パス表記にすること。相対パスでは差し替えが効かない)。
import { createPrismaCryptoCreditTradeRepository } from "./cryptoCreditTradeRepository.prisma";
import type { CryptoCreditTradeRepository } from "./cryptoCreditTradeRepository";

export const cryptoCreditTradeRepository: CryptoCreditTradeRepository =
  createPrismaCryptoCreditTradeRepository();
