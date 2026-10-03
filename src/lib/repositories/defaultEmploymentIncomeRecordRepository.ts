// 自宅サーバー版の既定実装。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)では
// next.config.tsのresolveAlias設定により
// `defaultEmploymentIncomeRecordRepository.standalone.ts`に差し替えられ、このファイル
// (と依存先の`employmentIncomeRecordRepository.prisma.ts`・`@prisma/client`)は
// ビルド対象に含まれない(フェーズ5-1-3b。`defaultTaxYearRepository.ts`と同種の
// パターン)。
//
// 各モジュールはこれまで個別に`createPrismaEmploymentIncomeRecordRepository()`を
// 呼び出していたが、ビルドターゲットで切り替えられるようにするため、この
// `employmentIncomeRecordRepository`シングルトンを
// `@/lib/repositories/defaultEmploymentIncomeRecordRepository`経由で参照する形に
// 統一する(importはresolveAliasが拾える絶対パス表記にすること。相対パスでは
// 差し替えが効かない)。
import { createPrismaEmploymentIncomeRecordRepository } from "./employmentIncomeRecordRepository.prisma";
import type { EmploymentIncomeRecordRepository } from "./employmentIncomeRecordRepository";

export const employmentIncomeRecordRepository: EmploymentIncomeRecordRepository =
  createPrismaEmploymentIncomeRecordRepository();
