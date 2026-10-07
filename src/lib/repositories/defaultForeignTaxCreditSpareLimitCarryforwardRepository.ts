// 自宅サーバー版の既定実装。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)では
// next.config.tsのresolveAlias設定により
// `defaultForeignTaxCreditSpareLimitCarryforwardRepository.standalone.ts`に差し替えられ、
// このファイル(と依存先の`foreignTaxCreditSpareLimitCarryforwardRepository.prisma.ts`・
// `@prisma/client`)はビルド対象に含まれない(フェーズ5-1-3d-16。
// `defaultForeignTaxCreditCarryforwardRepository.ts`と同種のパターン)。
//
// 各モジュールはこれまで個別に
// `createPrismaForeignTaxCreditSpareLimitCarryforwardRepository()`を呼び出していたが、
// ビルドターゲットで切り替えられるようにするため、この
// `foreignTaxCreditSpareLimitCarryforwardRepository`シングルトンを
// `@/lib/repositories/defaultForeignTaxCreditSpareLimitCarryforwardRepository`経由で
// 参照する形に統一する(importはresolveAliasが拾える絶対パス表記にすること。相対パス
// では差し替えが効かない)。
import { createPrismaForeignTaxCreditSpareLimitCarryforwardRepository } from "./foreignTaxCreditSpareLimitCarryforwardRepository.prisma";
import type { ForeignTaxCreditSpareLimitCarryforwardRepository } from "./foreignTaxCreditSpareLimitCarryforwardRepository";

export const foreignTaxCreditSpareLimitCarryforwardRepository: ForeignTaxCreditSpareLimitCarryforwardRepository =
  createPrismaForeignTaxCreditSpareLimitCarryforwardRepository();
