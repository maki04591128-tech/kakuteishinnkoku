import Link from "next/link";
import { getChildRearingRenovationDeductionRecord } from "@/lib/childRearingRenovationDeduction";
import { listTaxYears } from "@/lib/taxYear";
import { ChildRearingRenovationDeductionForm } from "./ChildRearingRenovationDeductionForm";

export default async function ChildRearingRenovationDeductionPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; saved?: string; deleted?: string }>;
}) {
  const params = await searchParams;
  const availableYears = await listTaxYears();
  const currentCalendarYear = new Date().getFullYear();
  const year = Number(params.year) || availableYears[0] || currentCalendarYear;

  const registeredRecord = await getChildRearingRenovationDeductionRecord(year);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <header>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← ダッシュボードに戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          子育て対応改修工事の住宅特定改修特別税額控除の試算({year}年分)
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          自己が所有する居住用家屋について子育てをしやすくするための改修工事を行った
          場合、
          <Link href={`/multi-household-renovation-deduction?year=${year}`} className="underline">
            多世帯同居改修工事
          </Link>
          や
          <Link
            href={`/durability-improvement-renovation-deduction?year=${year}`}
            className="underline"
          >
            耐久性向上改修工事
          </Link>
          の住宅特定改修特別税額控除と同様に借入金の有無を問わず、その年分の所得税額
          から控除できる(租税特別措置法41条の19の3)。他の類型と異なり、対象者が
          「特例対象個人」(19歳未満の扶養親族を有する者、または40歳未満の配偶者を
          有する者)に限られるほか、令和6年(2024年)4月1日から令和10年(2028年)
          12月31日までの間の居住分のみが対象の時限的な制度。単年で完結する控除で
          繰越制度は無い。
        </p>
      </header>

      {params.saved !== undefined && (
        <p className="rounded-md bg-green-50 px-4 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
          {year}年分の子育て対応改修工事の住宅特定改修特別税額控除を登録しました。下書き
          CSV(データ取り込み画面のエクスポート)の税額控除欄と、`/tax-estimate`の
          合計税額試算に自動反映されます。
        </p>
      )}
      {params.deleted !== undefined && (
        <p className="rounded-md bg-neutral-50 px-4 py-2 text-sm text-neutral-600 dark:bg-neutral-900 dark:text-neutral-300">
          {year}年分の子育て対応改修工事の住宅特定改修特別税額控除の登録を削除しました。
        </p>
      )}

      <ChildRearingRenovationDeductionForm
        year={year}
        registeredCreditJpy={registeredRecord ? registeredRecord.creditJpy.toNumber() : null}
      />

      <div className="flex flex-col gap-2 rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        <p>
          「子育て対応改修工事に係る標準的な費用の額」は、工事の内容に応じて政令で
          定められた単価表に基づき算出される金額で、実際の工事費用そのものではない。
          建築士等(一級・二級・木造建築士、指定確認検査機関、登録住宅性能評価機関、
          住宅瑕疵担保責任保険法人)が発行する「増改築等工事証明書」に記載された
          金額(国又は地方公共団体からの補助金等控除後)をそのまま入力する。
        </p>
        <p>
          対象者(特例対象個人)は、居住年の12月31日時点で19歳未満の扶養親族を有する者、
          または年齢40歳未満で配偶者を有する者もしくは年齢40歳以上で年齢40歳未満の
          配偶者を有する者のいずれかに限られる(国税庁タックスアンサーNo.1228)。
        </p>
        <p>
          対象となる子育て対応改修工事は、(1)子どもの事故防止工事、(2)対面式キッチンへの
          取替工事、(3)侵入防止対策を施した開口部の工事、(4)収納設備の増設工事、
          (5)開口部・界壁・界床の防音性能を向上させる工事、(6)間仕切壁の位置を変更する
          工事、のいずれか1つ以上に該当することが要件。
        </p>
        <p>
          住民税に相当する控除制度は存在しないため、所得税額からのみ控除する
          (他の住宅特定改修特別税額控除と同様)。この控除はバリアフリー改修・省エネ
          改修・住宅耐震改修特別控除・多世帯同居改修・耐久性向上改修の各制度といずれか
          1つの選択適用となり、選択替えはできない。これらとの選択適用・併用時の限度額の
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
