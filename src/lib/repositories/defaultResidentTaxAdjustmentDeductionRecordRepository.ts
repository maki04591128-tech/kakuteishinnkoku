// 自宅サーバー版の既定実装。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)では
// next.config.tsのresolveAlias設定により
// `defaultResidentTaxAdjustmentDeductionRecordRepository.standalone.ts`に差し替えられ、
// このファイル(と依存先の`residentTaxAdjustmentDeductionRecordRepository.prisma.ts`・
// `@prisma/client`)はビルド対象に含まれない(フェーズ5-1-3b。
// `defaultTaxYearRepository.ts`と同種のパターン)。
//
// 各モジュールはこれまで個別に
// `createPrismaResidentTaxAdjustmentDeductionRecordRepository()`を呼び出していたが、
// ビルドターゲットで切り替えられるようにするため、この
// `residentTaxAdjustmentDeductionRecordRepository`シングルトンを
// `@/lib/repositories/defaultResidentTaxAdjustmentDeductionRecordRepository`経由で
// 参照する形に統一する(importはresolveAliasが拾える絶対パス表記にすること。
// 相対パスでは差し替えが効かない)。
import { createPrismaResidentTaxAdjustmentDeductionRecordRepository } from "./residentTaxAdjustmentDeductionRecordRepository.prisma";
import type { ResidentTaxAdjustmentDeductionRecordRepository } from "./residentTaxAdjustmentDeductionRecordRepository";

export const residentTaxAdjustmentDeductionRecordRepository: ResidentTaxAdjustmentDeductionRecordRepository =
  createPrismaResidentTaxAdjustmentDeductionRecordRepository();
