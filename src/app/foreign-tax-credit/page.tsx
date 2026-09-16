import Link from "next/link";
import { listTaxYears } from "@/lib/taxYear";
import { ForeignTaxCreditForm } from "./ForeignTaxCreditForm";

export default async function ForeignTaxCreditPage({
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
          外国税額控除の試算({year}年分)
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          米国株式等、国外で源泉徴収された配当等がある場合に、その年の所得税額・
          復興特別所得税額・住民税額から控除できる外国税額控除の限度額と控除額を試算する。
        </p>
      </header>

      <ForeignTaxCreditForm />

      <div className="flex flex-col gap-2 rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        <p>
          「所得税額」「所得総額(総所得金額等)」は、本ツールが集計する暗号資産・投資の
          損益だけでなく、給与所得など他のすべての所得を合算した確定申告書全体の金額を
          入力する必要がある(本ツールは給与所得等を管理していないため自動計算できない)。
        </p>
        <p>
          住民税の控除限度額は所得税の控除限度額の30%(道府県民税12%+市町村民税18%)の
          標準割合で概算しており、実際の控除は所得税→復興特別所得税→住民税の順に
          市区町村が計算する。繰越控除限度超過額・繰越控除余裕額は発生年から3年間のみ
          有効だが、本ツールは発生年ごとの自動期限管理を行わないため、期限内かどうかは
          利用者自身で管理すること。
        </p>
        <p>
          本ツールの計算結果は概算であり、実際の申告内容は国税庁「確定申告書等作成
          コーナー」の計算結果や税理士等の専門家の確認を受けること。
        </p>
      </div>
    </div>
  );
}
