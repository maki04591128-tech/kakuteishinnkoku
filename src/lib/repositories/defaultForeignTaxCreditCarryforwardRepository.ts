// 自宅サーバー版の既定実装。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)では
// next.config.tsのresolveAlias設定により
// `defaultForeignTaxCreditCarryforwardRepository.standalone.ts`に差し替えられ、
// このファイル(と依存先の`foreignTaxCreditCarryforwardRepository.prisma.ts`・
// `@prisma/client`)はビルド対象に含まれない(フェーズ5-1-3d-16。
// `defaultCasualtyLossCarryforwardRepository.ts`と同種のパターン)。
//
// 各モジュールはこれまで個別に
// `createPrismaForeignTaxCreditCarryforwardRepository()`を呼び出していたが、
// ビルドターゲットで切り替えられるようにするため、この
// `foreignTaxCreditCarryforwardRepository`シングルトンを
// `@/lib/repositories/defaultForeignTaxCreditCarryforwardRepository`経由で参照する形に
// 統一する(importはresolveAliasが拾える絶対パス表記にすること。相対パスでは
// 差し替えが効かない)。
import { createPrismaForeignTaxCreditCarryforwardRepository } from "./foreignTaxCreditCarryforwardRepository.prisma";
import type { ForeignTaxCreditCarryforwardRepository } from "./foreignTaxCreditCarryforwardRepository";

export const foreignTaxCreditCarryforwardRepository: ForeignTaxCreditCarryforwardRepository =
  createPrismaForeignTaxCreditCarryforwardRepository();
