import Link from "next/link";
import { getDurabilityImprovementRenovationDeductionRecord } from "@/lib/durabilityImprovementRenovationDeduction";
import { listTaxYears } from "@/lib/taxYear";
import { DurabilityImprovementRenovationDeductionForm } from "./DurabilityImprovementRenovationDeductionForm";

export default async function DurabilityImprovementRenovationDeductionPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; saved?: string; deleted?: string }>;
}) {
  const params = await searchParams;
  const availableYears = await listTaxYears();
  const currentCalendarYear = new Date().getFullYear();
  const year = Number(params.year) || availableYears[0] || currentCalendarYear;

  const registeredRecord = await getDurabilityImprovementRenovationDeductionRecord(year);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <header>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← ダッシュボードに戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          耐久性向上改修工事の住宅特定改修特別税額控除の試算({year}年分)
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          自己が所有する居住用家屋について、
          <Link href={`/earthquake-renovation-deduction?year=${year}`} className="underline">
            住宅耐震改修
          </Link>
          または
          <Link href={`/energy-saving-renovation-deduction?year=${year}`} className="underline">
            一般省エネ改修工事
          </Link>
          のいずれか(または両方)と併せて耐久性向上改修工事を行った場合、借入金の有無を
          問わず、その年分の所得税額から控除できる(租税特別措置法41条の19の3)。他の
          住宅特定改修特別税額控除と異なり、耐久性向上改修工事は単独では適用できない
          (国税庁タックスアンサーNo.1227)。単年で完結する控除で繰越制度は無い。
        </p>
      </header>

      {params.saved !== undefined && (
        <p className="rounded-md bg-green-50 px-4 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
          {year}年分の耐久性向上改修工事の住宅特定改修特別税額控除を登録しました。下書きCSV
          (データ取り込み画面のエクスポート)の税額控除欄と、`/tax-estimate`の合計税額
          試算に自動反映されます。
        </p>
      )}
      {params.deleted !== undefined && (
        <p className="rounded-md bg-neutral-50 px-4 py-2 text-sm text-neutral-600 dark:bg-neutral-900 dark:text-neutral-300">
          {year}年分の耐久性向上改修工事の住宅特定改修特別税額控除の登録を削除しました。
        </p>
      )}

      <DurabilityImprovementRenovationDeductionForm
        year={year}
        registeredCreditJpy={registeredRecord ? registeredRecord.creditJpy.toNumber() : null}
      />

      <div className="flex flex-col gap-2 rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        <p>
          「標準的な費用の額」は、工事の内容に応じて政令で定められた単価表に基づき
          算出される金額で、実際の工事費用そのものではない。建築士等(一級・二級・
          木造建築士、指定確認検査機関、登録住宅性能評価機関、住宅瑕疵担保責任保険
          法人)が発行する「増改築等工事証明書」に記載された金額(国又は地方公共団体
          からの補助金等控除後)をそのまま入力する。
        </p>
        <p>
          耐久性向上改修工事とは、小屋裏・外壁・浴室・脱衣室・土台・軸組等・床下・
          基礎もしくは地盤に関する劣化対策工事または給排水管もしくは給湯管に関する
          維持管理・更新を容易にするための工事で、認定を受けた長期優良住宅建築等
          計画に基づくものであること等一定の要件を満たすものをいう
          (国税庁タックスアンサーNo.1227)。
        </p>
        <p>
          住民税に相当する控除制度は存在しないため、所得税額からのみ控除する
          (バリアフリー改修工事・省エネ改修工事・多世帯同居改修工事の住宅特定改修
          特別税額控除と同様)。この控除はバリアフリー改修・省エネ改修・多世帯同居
          改修・住宅耐震改修特別控除・子育て対応改修の各制度といずれか1つの選択
          適用となり、選択替えはできない。これらとの選択適用・併用時の限度額の
          合算判定は別制度・別計算のため本ツールでは試算しない(今後の課題)。
        </p>
        <p>
          適用要件(6か月以内の居住、工事費用の半分以上が自己居住用、前年以前3年内の
          重複適用の有無等)の該当性の最終確認はユーザー自身で行うこと。本ツールの
          計算結果は概算であり、実際の申告内容は国税庁「確定申告書等作成コーナー」の
          計算結果や税理士等の専門家の確認を受けること。
        </p>
      </div>
    </div>
  );
}
