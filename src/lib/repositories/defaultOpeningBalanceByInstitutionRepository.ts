// 自宅サーバー版の既定実装。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)では
// next.config.tsのresolveAlias設定により
// `defaultOpeningBalanceByInstitutionRepository.standalone.ts`に差し替えられ、
// このファイル(と依存先の`openingBalanceByInstitutionRepository.prisma.ts`・
// `@prisma/client`)はビルド対象に含まれない(フェーズ5-1-3b。
// `defaultTaxYearRepository.ts`と同種のパターン)。
//
// 各モジュールはこれまで個別に
// `createPrismaOpeningBalanceByInstitutionRepository()`を呼び出していたが、
// ビルドターゲットで切り替えられるようにするため、この
// `openingBalanceByInstitutionRepository`シングルトンを
// `@/lib/repositories/defaultOpeningBalanceByInstitutionRepository`経由で
// 参照する形に統一する(importはresolveAliasが拾える絶対パス表記にすること。
// 相対パスでは差し替えが効かない)。
import { createPrismaOpeningBalanceByInstitutionRepository } from "./openingBalanceByInstitutionRepository.prisma";
import type { OpeningBalanceByInstitutionRepository } from "./openingBalanceByInstitutionRepository";

export const openingBalanceByInstitutionRepository: OpeningBalanceByInstitutionRepository =
  createPrismaOpeningBalanceByInstitutionRepository();
