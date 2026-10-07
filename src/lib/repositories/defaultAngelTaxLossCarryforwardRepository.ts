// 自宅サーバー版の既定実装。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)では
// next.config.tsのresolveAlias設定により
// `defaultAngelTaxLossCarryforwardRepository.standalone.ts`に差し替えられ、
// このファイル(と依存先の`angelTaxLossCarryforwardRepository.prisma.ts`・
// `@prisma/client`)はビルド対象に含まれない(フェーズ5-1-3d-15。
// `defaultCasualtyLossCarryforwardRepository.ts`と同種のパターン)。
//
// 各モジュールはこれまで個別に`createPrismaAngelTaxLossCarryforwardRepository()`を
// 呼び出していたが、ビルドターゲットで切り替えられるようにするため、この
// `angelTaxLossCarryforwardRepository`シングルトンを
// `@/lib/repositories/defaultAngelTaxLossCarryforwardRepository`経由で参照する形に
// 統一する(importはresolveAliasが拾える絶対パス表記にすること。相対パスでは
// 差し替えが効かない)。
import { createPrismaAngelTaxLossCarryforwardRepository } from "./angelTaxLossCarryforwardRepository.prisma";
import type { AngelTaxLossCarryforwardRepository } from "./angelTaxLossCarryforwardRepository";

export const angelTaxLossCarryforwardRepository: AngelTaxLossCarryforwardRepository =
  createPrismaAngelTaxLossCarryforwardRepository();
