import Link from "next/link";
import { listTaxYears } from "@/lib/taxYear";
import { DonationTaxCreditForm } from "./DonationTaxCreditForm";

export default async function DonationTaxCreditPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const params = await searchParams;
  const availableYears = await listTaxYears();
  const currentCalendarYear = new Date().getFullYear();
  const year = Number(params.year) || availableYears[0] || currentCalendarYear;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <header>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← ダッシュボードに戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          政党等・認定NPO法人等・公益社団法人等寄附金特別控除の試算({year}年分)
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          政党等・認定NPO法人等・公益社団法人等への寄附は、通常の寄附金控除(所得控除。
          <Link href={`/donation-deduction?year=${year}`} className="underline">
            寄附金控除(ふるさと納税等)の試算
          </Link>
          )を受けるか、この特別控除(税額控除)を受けるか、所得税の計算上いずれか有利な方を
          選択できる。この画面では特別控除額そのものの試算に加え、通常の寄附金控除(所得控除)を
          選んだ場合との所得税軽減額の比較もできる。暗号資産・投資の集計とは独立した単体の
          試算画面のため、この年分の取引データには依存しない。
        </p>
      </header>

      <DonationTaxCreditForm />

      <p className="rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        租税特別措置法41条の18(政党等)・41条の18の2(認定NPO法人等)・41条の18の3
        (公益社団法人等)に基づく概算値。この選択はあくまで所得税の計算上の話であり、住民税の
        寄附金控除(基本控除)は寄附先が都道府県・市区町村の条例で指定されているかで別途決まる
        (全国一律の対象ではない)ため、住民税への影響は試算していない。「総所得金額等」・
        「特別控除適用前の所得税額」・「所得税の限界税率」は
        <Link href={`/tax-estimate?year=${year}`} className="underline">
          所得税・住民税の概算合計税額試算
        </Link>
        の結果を参考に入力すること。本ツールはこの試算結果のDB保存・
        `/tax-estimate`への自動反映には対応していない(今後の課題。試算結果は別途申告書へ
        転記すること)。
      </p>
    </div>
  );
}
