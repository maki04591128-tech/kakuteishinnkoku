// 自宅サーバー版の既定実装。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)では
// next.config.tsのresolveAlias設定により
// `defaultHomeSaleLossCarryforwardRepository.standalone.ts`に差し替えられ、
// このファイル(と依存先の`homeSaleLossCarryforwardRepository.prisma.ts`・
// `@prisma/client`)はビルド対象に含まれない(フェーズ5-1-3d-17。
// `defaultCasualtyLossCarryforwardRepository.ts`と同種のパターン)。
//
// 各モジュールはこれまで個別に`createPrismaHomeSaleLossCarryforwardRepository()`を
// 呼び出していたが、ビルドターゲットで切り替えられるようにするため、この
// `homeSaleLossCarryforwardRepository`シングルトンを
// `@/lib/repositories/defaultHomeSaleLossCarryforwardRepository`経由で参照する形に
// 統一する(importはresolveAliasが拾える絶対パス表記にすること。相対パスでは
// 差し替えが効かない)。
import { createPrismaHomeSaleLossCarryforwardRepository } from "./homeSaleLossCarryforwardRepository.prisma";
import type { HomeSaleLossCarryforwardRepository } from "./homeSaleLossCarryforwardRepository";

export const homeSaleLossCarryforwardRepository: HomeSaleLossCarryforwardRepository =
  createPrismaHomeSaleLossCarryforwardRepository();
