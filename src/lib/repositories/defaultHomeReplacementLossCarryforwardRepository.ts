// 自宅サーバー版の既定実装。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)では
// next.config.tsのresolveAlias設定により
// `defaultHomeReplacementLossCarryforwardRepository.standalone.ts`に差し替えられ、
// このファイル(と依存先の`homeReplacementLossCarryforwardRepository.prisma.ts`・
// `@prisma/client`)はビルド対象に含まれない(フェーズ5-1-3d-18。
// `defaultHomeSaleLossCarryforwardRepository.ts`と同種のパターン)。
//
// 各モジュールはこれまで個別に`createPrismaHomeReplacementLossCarryforwardRepository()`を
// 呼び出していたが、ビルドターゲットで切り替えられるようにするため、この
// `homeReplacementLossCarryforwardRepository`シングルトンを
// `@/lib/repositories/defaultHomeReplacementLossCarryforwardRepository`経由で参照する形に
// 統一する(importはresolveAliasが拾える絶対パス表記にすること。相対パスでは
// 差し替えが効かない)。
import { createPrismaHomeReplacementLossCarryforwardRepository } from "./homeReplacementLossCarryforwardRepository.prisma";
import type { HomeReplacementLossCarryforwardRepository } from "./homeReplacementLossCarryforwardRepository";

export const homeReplacementLossCarryforwardRepository: HomeReplacementLossCarryforwardRepository =
  createPrismaHomeReplacementLossCarryforwardRepository();
