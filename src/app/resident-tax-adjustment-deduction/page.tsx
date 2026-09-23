import Link from "next/link";
import { listTaxYears } from "@/lib/taxYear";
import { getResidentTaxAdjustmentDeductionRecord } from "@/lib/residentTaxAdjustmentDeduction";
import { ResidentTaxAdjustmentDeductionForm } from "./ResidentTaxAdjustmentDeductionForm";

export default async function ResidentTaxAdjustmentDeductionPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; residentTaxAdjustmentDeductionSaved?: string }>;
}) {
  const params = await searchParams;
  const availableYears = await listTaxYears();
  const currentCalendarYear = new Date().getFullYear();
  const year = Number(params.year) || availableYears[0] || currentCalendarYear;

  const record = await getResidentTaxAdjustmentDeductionRecord(year);
  const registeredRecord = record
    ? { taxYear: record.taxYear, adjustmentDeductionJpy: record.adjustmentDeductionJpy.toNumber() }
    : null;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <header>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← ダッシュボードに戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          住民税の調整控除の試算({year}年分)
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          税源移譲に伴い生じる所得税と住民税の人的控除額(基礎控除・配偶者控除・
          扶養控除・障害者控除・寡婦控除・ひとり親控除・勤労学生控除)の差に基づく
          負担増を調整する「調整控除」の額を試算する。他の所得控除試算画面と同様、
          暗号資産・投資の集計とは独立した単体の試算画面のため、この年分の取引データには
          依存しない。試算結果は「登録する」ボタンで年分ごとに保存でき、
          <Link href="/tax-estimate" className="underline">
            /tax-estimate
          </Link>
          の合計税額試算に住民税の税額控除として自動反映される(初期値のみで、
          手入力で上書き可能)。
        </p>
      </header>

      {params.residentTaxAdjustmentDeductionSaved !== undefined && (
        <p className="rounded-md bg-green-50 px-4 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
          {year}年分の住民税の調整控除を登録しました。`/tax-estimate`の合計税額試算に
          自動反映されます。
        </p>
      )}

      <ResidentTaxAdjustmentDeductionForm year={year} registeredRecord={registeredRecord} />

      <p className="rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        自治体公式サイト(洲本市「個人市県民税の税額控除(令和8年度課税以降適用)」等)で
        内容が確認できた人的控除額の差の速算表・計算式による概算値。配偶者特別控除・
        特定親族特別控除は人的控除額の差の対象外。市民税(町村民税)3%・道府県民税
        (都民税)2%の内訳は本アプリでは住民税分として合算して表示する。調整控除は
        住民税所得割のみの税額控除(所得税に対応する控除は無い)のため、
        `/tax-estimate`では住宅ローン控除・外国税額控除より先に住民税所得割額から
        差し引く(静岡市・石井町等の自治体公式サイトで確認できる税額控除の適用順序
        「調整控除→配当控除→住宅借入金等特別税額控除→寄附金税額控除→外国税額控除」
        に基づく)。
      </p>
    </div>
  );
}
