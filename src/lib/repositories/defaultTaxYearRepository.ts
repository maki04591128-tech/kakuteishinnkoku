/**
 * フェーズ5-1-3b: `TaxYearRepository`の既定実装をビルドターゲットで切り替える
 * 機構。自宅サーバー版(このファイル)はPrisma実装を使う。スタンドアロン版
 * ビルド(`BUILD_TARGET=standalone`)では、`next.config.ts`のresolveAlias設定
 * (`src/lib/authUi.tsx`/`authUi.standalone.tsx`と同じパターン)により
 * `defaultTaxYearRepository.standalone.ts`に差し替えられる。
 *
 * 呼び出し側(`src/lib/taxYear.ts`)は`@/lib/repositories/defaultTaxYearRepository`
 * という絶対パス(`@/`alias)でimportすること。相対パスでimportすると
 * resolveAliasが一致せず差し替えが効かない。
 */
import { createPrismaTaxYearRepository } from "./taxYearRepository.prisma";
import type { TaxYearRepository } from "./taxYearRepository";

export const defaultTaxYearRepository: TaxYearRepository = createPrismaTaxYearRepository();
