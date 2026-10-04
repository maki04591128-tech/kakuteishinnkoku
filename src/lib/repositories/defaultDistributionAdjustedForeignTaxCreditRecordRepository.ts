// 自宅サーバー版の既定実装。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)では
// next.config.tsのresolveAlias設定により
// `defaultDistributionAdjustedForeignTaxCreditRecordRepository.standalone.ts`に差し替えられ、
// このファイル(と依存先の
// `distributionAdjustedForeignTaxCreditRecordRepository.prisma.ts`・`@prisma/client`)は
// ビルド対象に含まれない(フェーズ5-1-3b。`defaultTaxYearRepository.ts`と同種のパターン)。
//
// `src/lib/investment/distributionAdjustedForeignTaxCredit.ts`はこれまで個別に
// `createPrismaDistributionAdjustedForeignTaxCreditRecordRepository()`を呼び出していたが、
// ビルドターゲットで切り替えられるようにするため、この
// `distributionAdjustedForeignTaxCreditRecordRepository`シングルトンを
// `@/lib/repositories/defaultDistributionAdjustedForeignTaxCreditRecordRepository`経由で
// 参照する形に統一する(importはresolveAliasが拾える絶対パス表記にすること。相対パスでは
// 差し替えが効かない)。
import { createPrismaDistributionAdjustedForeignTaxCreditRecordRepository } from "./distributionAdjustedForeignTaxCreditRecordRepository.prisma";
import type { DistributionAdjustedForeignTaxCreditRecordRepository } from "./distributionAdjustedForeignTaxCreditRecordRepository";

export const distributionAdjustedForeignTaxCreditRecordRepository: DistributionAdjustedForeignTaxCreditRecordRepository =
  createPrismaDistributionAdjustedForeignTaxCreditRecordRepository();
