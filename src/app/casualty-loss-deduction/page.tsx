import Link from "next/link";
import { prisma } from "@/lib/db";
import { getOrCreateTaxYear, listTaxYears } from "@/lib/taxYear";
import { findIncomeDeductionEntry, getIncomeDeductionEntries } from "@/lib/incomeDeduction";
import { CasualtyLossDeductionForm } from "./CasualtyLossDeductionForm";

export default async function CasualtyLossDeductionPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; lossCarried?: string }>;
}) {
  const params = await searchParams;
  const availableYears = await listTaxYears();
  const currentCalendarYear = new Date().getFullYear();
  const year = Number(params.year) || availableYears[0] || currentCalendarYear;

  const incomeDeductionEntries = await getIncomeDeductionEntries(year);
  const registeredEntry = findIncomeDeductionEntry(incomeDeductionEntries, "CASUALTY_LOSS");
  const registeredDeduction = registeredEntry
    ? {
        incomeTaxAmountJpy: Number(registeredEntry.incomeTaxAmountJpy),
        residentTaxAmountJpy: Number(registeredEntry.residentTaxAmountJpy),
      }
    : null;

  const taxYear = await getOrCreateTaxYear(year);
  const carryforwards = await prisma.casualtyLossCarryforward.findMany({
    where: { taxYearId: taxYear.id },
    orderBy: { originYear: "asc" },
  });
  const carryforwardEntries = carryforwards.map((c) => ({
    originYear: c.originYear,
    remainingAmountJpy: c.remainingAmountJpy.toString(),
  }));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <header>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← ダッシュボードに戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          雑損控除額の試算({year}年分)
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          災害・盗難・横領により住宅家財等の生活用資産に損害を受けた場合の雑損控除額を、
          国税庁の計算式に基づいて試算できる。暗号資産・投資の集計とは独立した単体の
          試算画面のため、この年分の取引データには依存しない。
        </p>
      </header>

      {params.lossCarried !== undefined && (
        <p className="rounded-md bg-green-50 px-4 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
          {Number(params.lossCarried) > 0
            ? `${params.lossCarried}件の繰越雑損失を${year + 1}年分として登録しました。`
            : `登録できる繰越雑損失はありませんでした(既に${year + 1}年分に登録済みか、控除しきれなかった金額がありません)。`}
        </p>
      )}

      <CasualtyLossDeductionForm
        year={year}
        registeredDeduction={registeredDeduction}
        carryforwardEntries={carryforwardEntries}
      />

      <div className="flex flex-col gap-2 rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        <p>
          国税庁タックスアンサーNo.1110の計算式による概算値であり、損害金額の算定方法や
          適用要件(災害・盗難・横領による損失であること等)は必ず自身で確認すること。
        </p>
        <p>
          「この年分の所得控除として登録する」ボタンで登録すると、繰越控除の使用額も
          合わせた実際にその年の所得から控除できた金額(所得税・住民税とも同額)が
          `/tax-estimate`の「給与所得等の課税所得金額」の初期値に自動反映される
          (登録後も入力欄は手入力で上書き可能)。
        </p>
        <p>
          雑損控除額がその年の総所得金額等を超えて控除しきれなかった場合、超過額
          (雑損失の金額)は翌年以後3年間繰り越して総所得金額等から控除できる
          (雑損失の繰越控除)。発生年ごとの繰越残高は
          <Link href={`/import?year=${year}&tab=casualtyLossCarryforward`} className="underline">
            データ取り込み画面
          </Link>
          で登録・確認でき、当年の試算結果に翌年以後へ繰り越す額が発生した場合は
          下のボタンから{year + 1}年分として一括登録できる。
        </p>
      </div>
    </div>
  );
}
