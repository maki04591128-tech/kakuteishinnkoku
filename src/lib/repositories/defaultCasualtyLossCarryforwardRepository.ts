// 自宅サーバー版の既定実装。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)では
// next.config.tsのresolveAlias設定により
// `defaultCasualtyLossCarryforwardRepository.standalone.ts`に差し替えられ、
// このファイル(と依存先の`casualtyLossCarryforwardRepository.prisma.ts`・
// `@prisma/client`)はビルド対象に含まれない(フェーズ5-1-3d-14。
// `defaultTaxYearRepository.ts`と同種のパターン)。
//
// 各モジュールはこれまで個別に`createPrismaCasualtyLossCarryforwardRepository()`を
// 呼び出していたが、ビルドターゲットで切り替えられるようにするため、この
// `casualtyLossCarryforwardRepository`シングルトンを
// `@/lib/repositories/defaultCasualtyLossCarryforwardRepository`経由で参照する形に
// 統一する(importはresolveAliasが拾える絶対パス表記にすること。相対パスでは
// 差し替えが効かない)。
import { createPrismaCasualtyLossCarryforwardRepository } from "./casualtyLossCarryforwardRepository.prisma";
import type { CasualtyLossCarryforwardRepository } from "./casualtyLossCarryforwardRepository";

export const casualtyLossCarryforwardRepository: CasualtyLossCarryforwardRepository =
  createPrismaCasualtyLossCarryforwardRepository();
