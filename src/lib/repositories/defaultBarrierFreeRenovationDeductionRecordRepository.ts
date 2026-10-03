// 自宅サーバー版の既定実装。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)では
// next.config.tsのresolveAlias設定により
// `defaultBarrierFreeRenovationDeductionRecordRepository.standalone.ts`に差し替えられ、この
// ファイル(と依存先の`barrierFreeRenovationDeductionRecordRepository.prisma.ts`・
// `@prisma/client`)はビルド対象に含まれない(フェーズ5-1-3b。
// `defaultTaxYearRepository.ts`と同種のパターン)。
//
// 各モジュールはこれまで個別に
// `createPrismaBarrierFreeRenovationDeductionRecordRepository()`を呼び出していたが、
// ビルドターゲットで切り替えられるようにするため、この
// `barrierFreeRenovationDeductionRecordRepository`シングルトンを
// `@/lib/repositories/defaultBarrierFreeRenovationDeductionRecordRepository`経由で参照する
// 形に統一する(importはresolveAliasが拾える絶対パス表記にすること。相対パスでは
// 差し替えが効かない)。
import { createPrismaBarrierFreeRenovationDeductionRecordRepository } from "./barrierFreeRenovationDeductionRecordRepository.prisma";
import type { BarrierFreeRenovationDeductionRecordRepository } from "./barrierFreeRenovationDeductionRecordRepository";

export const barrierFreeRenovationDeductionRecordRepository: BarrierFreeRenovationDeductionRecordRepository =
  createPrismaBarrierFreeRenovationDeductionRecordRepository();
