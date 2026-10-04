// 自宅サーバー版の既定実装。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)では
// next.config.tsのresolveAlias設定により
// `defaultEarthquakeRenovationDeductionRecordRepository.standalone.ts`に差し替えられ、この
// ファイル(と依存先の`earthquakeRenovationDeductionRecordRepository.prisma.ts`・
// `@prisma/client`)はビルド対象に含まれない(フェーズ5-1-3b。
// `defaultTaxYearRepository.ts`と同種のパターン)。
//
// 各モジュールはこれまで個別に
// `createPrismaEarthquakeRenovationDeductionRecordRepository()`を呼び出していたが、
// ビルドターゲットで切り替えられるようにするため、この
// `earthquakeRenovationDeductionRecordRepository`シングルトンを
// `@/lib/repositories/defaultEarthquakeRenovationDeductionRecordRepository`経由で参照する
// 形に統一する(importはresolveAliasが拾える絶対パス表記にすること。相対パスでは
// 差し替えが効かない)。
import { createPrismaEarthquakeRenovationDeductionRecordRepository } from "./earthquakeRenovationDeductionRecordRepository.prisma";
import type { EarthquakeRenovationDeductionRecordRepository } from "./earthquakeRenovationDeductionRecordRepository";

export const earthquakeRenovationDeductionRecordRepository: EarthquakeRenovationDeductionRecordRepository =
  createPrismaEarthquakeRenovationDeductionRecordRepository();
