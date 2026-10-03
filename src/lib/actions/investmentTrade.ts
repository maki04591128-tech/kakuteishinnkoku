/**
 * フェーズ3(Server Actions/Server Componentsの置き換え)。
 *
 * `src/app/actions.ts`の`addInvestmentTrade`/`deleteInvestmentTrade`から、Next.js
 * 固有のAPI(`revalidatePath`/`redirect`)に依存しない部分(入力検証・リポジトリ
 * 呼び出し・次の遷移先の決定)をコア関数として切り出した。3-26で扱った
 * `CryptoTrade`と同じ「取引記録1件ごとの追加・削除」パターンだが、こちらは
 * NISA口座と非上場株式の組み合わせ禁止・J-REIT/外貨建資産等の組入割合の
 * 指定は該当する資産種別の場合のみ、という`addInvestmentTrade`固有の
 * バリデーションを含む点が異なる(バリデーション内容は元の実装から変更していない)。
 */
import type { TaxYearRepository } from "@/lib/repositories/taxYearRepository";
import type { InvestmentTradeRepository } from "@/lib/repositories/investmentTradeRepository";

export interface AddInvestmentTradeInput {
  year: number;
  isNisa: boolean;
  isListed: boolean;
  assetType: string;
  isReit: boolean;
  mutualFundHighForeignRatio: boolean;
  mutualFundVeryHighForeignRatio: boolean;
  tradedAt: string;
  symbol: string;
  name: string | null;
  type: string;
  quantity: string;
  unitPriceJpy: string;
  feeJpy: string | null;
  accountType: string;
  nisaType: string | null;
  isForeign: boolean;
  foreignTaxWithheldJpy: string | null;
  distributionAdjustedForeignTaxJpy: string | null;
  broker: string | null;
  memo: string | null;
}

export interface DeleteInvestmentTradeInput {
  id: number;
  year: number;
}

export interface InvestmentTradeActionResult {
  /** 処理後に遷移すべきパス。 */
  redirectTo: string;
}

export async function addInvestmentTradeCore(
  taxYearRepository: TaxYearRepository,
  investmentTradeRepository: InvestmentTradeRepository,
  input: AddInvestmentTradeInput,
): Promise<InvestmentTradeActionResult> {
  const {
    year,
    isNisa,
    isListed,
    assetType,
    isReit,
    mutualFundHighForeignRatio,
    mutualFundVeryHighForeignRatio,
    tradedAt,
    symbol,
    name,
    type,
    quantity,
    unitPriceJpy,
    feeJpy,
    accountType,
    nisaType,
    isForeign,
    foreignTaxWithheldJpy,
    distributionAdjustedForeignTaxJpy,
    broker,
    memo,
  } = input;

  // NISA口座は上場株式等等のみが対象のため、非上場株式との組み合わせは拒否する。
  if (isNisa && !isListed) {
    throw new Error("一般株式等(非上場株式)はNISA口座の対象外です");
  }
  if (isReit && assetType !== "ETF") {
    throw new Error("J-REITは資産種別「ETF」の場合のみ指定できます");
  }
  if (mutualFundHighForeignRatio && assetType !== "MUTUAL_FUND") {
    throw new Error(
      "外貨建資産等の組入割合50%超75%以下は資産種別「投資信託」の場合のみ指定できます",
    );
  }
  if (mutualFundVeryHighForeignRatio && assetType !== "MUTUAL_FUND") {
    throw new Error(
      "外貨建資産等の組入割合75%超は資産種別「投資信託」の場合のみ指定できます",
    );
  }

  const taxYear = await taxYearRepository.getOrCreateTaxYear(year);
  await investmentTradeRepository.create({
    taxYearId: taxYear.id,
    tradedAt: new Date(tradedAt),
    symbol,
    name,
    assetType: assetType as never,
    isReit,
    mutualFundHighForeignRatio,
    mutualFundVeryHighForeignRatio,
    isListed,
    type: type as never,
    quantity,
    unitPriceJpy,
    feeJpy: feeJpy ?? "0",
    accountType: accountType as never,
    isNisa,
    nisaType: nisaType as never,
    isForeign,
    foreignTaxWithheldJpy: foreignTaxWithheldJpy ?? "0",
    distributionAdjustedForeignTaxJpy: distributionAdjustedForeignTaxJpy ?? "0",
    broker,
    memo,
    source: "manual",
  });

  return { redirectTo: `/import?year=${year}&tab=investment` };
}

export async function deleteInvestmentTradeCore(
  investmentTradeRepository: InvestmentTradeRepository,
  input: DeleteInvestmentTradeInput,
): Promise<InvestmentTradeActionResult> {
  const { id, year } = input;

  await investmentTradeRepository.delete(id);

  return { redirectTo: `/import?year=${year}&tab=investment` };
}
