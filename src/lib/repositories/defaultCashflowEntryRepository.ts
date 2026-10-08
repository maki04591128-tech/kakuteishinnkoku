// 自宅サーバー版の既定実装。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)では
// next.config.tsのresolveAlias設定により
// `defaultCashflowEntryRepository.standalone.ts`に差し替えられ、この
// ファイル(と依存先の`cashflowEntryRepository.ts`内のPrisma実装・`@prisma/client`)は
// ビルド対象に含まれない(フェーズ5-1-3b。`defaultFuturesTradeRepository.ts`と
// 同種のパターン)。
//
// 他の26モデルと異なり`CashflowEntryRepository`はPrisma実装・クライアントDB実装を
// 別ファイル(`xxxRepository.prisma.ts`)に分けていないが、この
// `cashflowEntryRepository`シングルトンを
// `@/lib/repositories/defaultCashflowEntryRepository`経由で参照する形に統一する点は
// 他モデルと同じ(importはresolveAliasが拾える絶対パス表記にすること。相対パスでは
// 差し替えが効かない。5-1-3d-45)。
import { createPrismaCashflowEntryRepository } from "./cashflowEntryRepository";
import type { CashflowEntryRepository } from "./cashflowEntryRepository";

export const cashflowEntryRepository: CashflowEntryRepository =
  createPrismaCashflowEntryRepository();
