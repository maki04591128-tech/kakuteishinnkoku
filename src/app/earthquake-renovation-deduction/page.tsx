import Link from "next/link";
import { getEarthquakeRenovationDeductionRecord } from "@/lib/earthquakeRenovationDeduction";
import { listTaxYears } from "@/lib/taxYear";
import { EarthquakeRenovationDeductionForm } from "./EarthquakeRenovationDeductionForm";

export default async function EarthquakeRenovationDeductionPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; saved?: string; deleted?: string }>;
}) {
  const params = await searchParams;
  const availableYears = await listTaxYears();
  const currentCalendarYear = new Date().getFullYear();
  const year = Number(params.year) || availableYears[0] || currentCalendarYear;

  const registeredRecord = await getEarthquakeRenovationDeductionRecord(year);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <header>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← ダッシュボードに戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          住宅耐震改修特別控除の試算({year}年分)
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          自己の居住の用に供する家屋(昭和56年5月31日以前に建築されたもの)について
          現行の耐震基準に適合させる耐震改修を行った場合、
          <Link href={`/mortgage-deduction?year=${year}`} className="underline">
            住宅ローン控除
          </Link>
          と異なり借入金の有無を問わず、その年分の所得税額から控除できる(租税特別
          措置法41条の19の2)。単年で完結する控除で繰越制度は無い。
        </p>
      </header>

      {params.saved !== undefined && (
        <p className="rounded-md bg-green-50 px-4 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
          {year}年分の住宅耐震改修特別控除を登録しました。下書きCSV(データ取り込み画面の
          エクスポート)の税額控除欄と、`/tax-estimate`の合計税額試算に自動反映されます。
        </p>
      )}
      {params.deleted !== undefined && (
        <p className="rounded-md bg-neutral-50 px-4 py-2 text-sm text-neutral-600 dark:bg-neutral-900 dark:text-neutral-300">
          {year}年分の住宅耐震改修特別控除の登録を削除しました。
        </p>
      )}

      <EarthquakeRenovationDeductionForm
        year={year}
        registeredCreditJpy={registeredRecord ? registeredRecord.creditJpy.toNumber() : null}
      />

      <div className="flex flex-col gap-2 rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        <p>
          「耐震改修に係る標準的な工事費用相当額」は、耐震改修の内容に応じて政令で
          定められた単価表に基づき算出される金額で、実際の工事費用そのものではない
          (実際の工事費用の方が少ない場合はその実額)。地方公共団体・指定確認検査機関・
          登録住宅性能評価機関・住宅瑕疵担保責任保険法人が発行する「増改築等工事証明書」に
          記載された金額(国又は地方公共団体からの補助金等控除後)をそのまま入力する。
        </p>
        <p>
          住民税に相当する控除制度は存在しないため、所得税額からのみ控除する
          (住宅ローン控除のような住民税への振替は無い)。バリアフリー改修・
          三世代同居改修・耐久性向上改修に対応する住宅特定改修特別税額控除(措置法
          41条の19の3)や、認定住宅新築等特別税額控除(投資型減税。措置法41条の19の4)は
          別制度のため本ツールでは試算しない(今後の課題)。
          <Link href={`/energy-saving-renovation-deduction?year=${year}`} className="underline">
            省エネ改修工事に係る住宅特定改修特別税額控除
          </Link>
          は別画面で試算できる。
        </p>
        <p>
          適用期限・対象家屋が耐震改修促進法に基づく耐震改修に該当するかどうかの
          判定はユーザー自身で確認すること。本ツールの計算結果は概算であり、実際の
          申告内容は国税庁「確定申告書等作成コーナー」の計算結果や税理士等の専門家の
          確認を受けること。
        </p>
      </div>
    </div>
  );
}
