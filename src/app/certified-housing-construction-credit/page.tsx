import Link from "next/link";
import { getCertifiedHousingConstructionCreditRecord } from "@/lib/certifiedHousingConstructionCredit";
import { listTaxYears } from "@/lib/taxYear";
import { CertifiedHousingConstructionCreditForm } from "./CertifiedHousingConstructionCreditForm";

export default async function CertifiedHousingConstructionCreditPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; saved?: string; deleted?: string }>;
}) {
  const params = await searchParams;
  const availableYears = await listTaxYears();
  const currentCalendarYear = new Date().getFullYear();
  const year = Number(params.year) || availableYears[0] || currentCalendarYear;

  const registeredRecord = await getCertifiedHousingConstructionCreditRecord(year);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <header>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← ダッシュボードに戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          認定住宅等新築等特別税額控除の試算({year}年分)
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          認定長期優良住宅・認定低炭素住宅またはZEH水準省エネ住宅の新築・取得をして
          居住の用に供した場合、
          <Link href={`/mortgage-deduction?year=${year}`} className="underline">
            住宅ローン控除
          </Link>
          と異なり借入金の有無を問わず(自己資金のみの場合も対象)、認定基準に適合する
          ために必要となる標準的なかかり増し費用の10%相当額をその年分の所得税額から
          控除できる(租税特別措置法41条の19の4、いわゆる投資型減税)。住宅ローン控除
          との選択適用(選択替え不可)。
        </p>
      </header>

      {params.saved !== undefined && (
        <p className="rounded-md bg-green-50 px-4 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
          {year}年分の認定住宅等新築等特別税額控除を登録しました。下書きCSV(データ取り込み画面の
          エクスポート)の税額控除欄と、`/tax-estimate`の合計税額試算に自動反映されます。
        </p>
      )}
      {params.deleted !== undefined && (
        <p className="rounded-md bg-neutral-50 px-4 py-2 text-sm text-neutral-600 dark:bg-neutral-900 dark:text-neutral-300">
          {year}年分の認定住宅等新築等特別税額控除の登録を削除しました。
        </p>
      )}

      <CertifiedHousingConstructionCreditForm
        year={year}
        registeredCreditJpy={registeredRecord ? registeredRecord.creditJpy.toNumber() : null}
      />

      <div className="flex flex-col gap-2 rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        <p>
          「標準的なかかり増し費用」は、認定住宅等の構造の区分にかかわらず1平方メートル
          当たり45,300円に床面積を乗じて計算した金額(令和4年1月1日以後に居住の用に
          供した場合)であり、実際の工事費用・取得価額そのものではない。控除対象限度額
          (650万円)を超える部分は控除額の計算に反映されない。
        </p>
        <p>
          住民税に相当する控除制度は存在しないため、所得税額からのみ控除する
          (住宅耐震改修特別控除・住宅特定改修特別税額控除の各類型と同様)。
          居住年の所得税額から控除しきれない場合等に翌年分へ1年間繰り越せる制度が
          あるが、本ツールは居住年単独の控除額の試算のみを行い、繰越の計算・自動反映は
          行わない(今後の課題)。
          <Link href={`/earthquake-renovation-deduction?year=${year}`} className="underline">
            住宅耐震改修特別控除
          </Link>
          ・
          <Link href={`/energy-saving-renovation-deduction?year=${year}`} className="underline">
            住宅特定改修特別税額控除(5類型)
          </Link>
          は別画面で試算できる。
        </p>
        <p>
          適用期限・対象住宅の認定基準への適合(証明書の取得)・災害危険区域等の該当性の
          判定はユーザー自身で確認すること。本ツールの計算結果は概算であり、実際の
          申告内容は国税庁「確定申告書等作成コーナー」の計算結果や税理士等の専門家の
          確認を受けること。
        </p>
      </div>
    </div>
  );
}
