/**
 * フェーズ3(Server Actions/Server Componentsの置き換え)パイロット。
 *
 * `src/app/actions.ts`の`setCryptoCostMethod`から、Next.js固有のAPI
 * (`revalidatePath`/`redirect`)に依存しない部分(入力検証・リポジトリ呼び出し・
 * 次の遷移先の決定)をこの「コア関数」として切り出した。リポジトリは
 * `TaxYearRepository`インターフェース経由でDIするため、自宅サーバー版
 * (`createPrismaTaxYearRepository`)・スタンドアロン版
 * (`createClientTaxYearRepository`)のどちらからも同じ関数を呼び出せる。
 */
import type { CryptoCostMethod } from "@prisma/client";
import type { TaxYearRepository } from "@/lib/repositories/taxYearRepository";

export interface SetCryptoCostMethodInput {
  year: number;
  cryptoCostMethod: string;
  tab: string | null;
}

export interface SetCryptoCostMethodResult {
  /** 処理後に遷移すべきパス。 */
  redirectTo: string;
}

function isCryptoCostMethod(value: string): value is CryptoCostMethod {
  return value === "AVERAGE" || value === "MOVING_AVERAGE";
}

export async function setCryptoCostMethodCore(
  taxYearRepository: TaxYearRepository,
  input: SetCryptoCostMethodInput,
): Promise<SetCryptoCostMethodResult> {
  const { year, cryptoCostMethod, tab } = input;
  if (!isCryptoCostMethod(cryptoCostMethod)) {
    throw new Error(`未対応の評価方法です: ${cryptoCostMethod}`);
  }

  const taxYear = await taxYearRepository.getOrCreateTaxYear(year);
  await taxYearRepository.updateCryptoCostMethod(taxYear.id, cryptoCostMethod);

  return {
    redirectTo: tab ? `/import?year=${year}&tab=${tab}` : `/?year=${year}`,
  };
}
