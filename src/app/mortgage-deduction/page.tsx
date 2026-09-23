import Link from "next/link";
import { listTaxYears } from "@/lib/taxYear";
import { getMortgageDeductionRecord } from "@/lib/mortgageDeduction";
import { MortgageDeductionForm } from "./MortgageDeductionForm";

export default async function MortgageDeductionPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const params = await searchParams;
  const availableYears = await listTaxYears();
  const currentCalendarYear = new Date().getFullYear();
  const year = Number(params.year) || availableYears[0] || currentCalendarYear;

  const mortgageDeductionRecord = await getMortgageDeductionRecord(year);
  const registeredRecord = mortgageDeductionRecord
    ? {
        taxYear: mortgageDeductionRecord.taxYear,
        nationalTaxCreditJpy: mortgageDeductionRecord.nationalTaxCreditJpy.toNumber(),
        residentTaxCreditJpy: mortgageDeductionRecord.residentTaxCreditJpy.toNumber(),
      }
    : null;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <header>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← ダッシュボードに戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          住宅借入金等特別控除(住宅ローン控除)の試算({year}年分)
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          居住開始年・住宅の区分・年末借入金残高を入力すると、その年分の所得税額から
          控除できる住宅ローン控除額(税額控除)を試算する。令和4年(2022年)〜令和7年
          (2025年)に居住の用に供した場合のみ対応する。試算結果は「登録する」ボタンで
          年分ごとに保存でき、<Link href="/tax-estimate" className="underline">
            /tax-estimate
          </Link>
          の合計税額試算に税額控除として自動反映される(初期値のみで、手入力で上書き可能)。
        </p>
      </header>

      <MortgageDeductionForm defaultTaxYear={year} registeredRecord={registeredRecord} />

      <p className="rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        本シミュレーターは国税庁タックスアンサーNo.1211-1・国土交通省の公表資料に
        基づく概算値であり、床面積40㎡以上50㎡未満の特例や新築「その他の住宅」の
        経過措置(令和5年末までの建築確認等)、連帯債務・共有名義の持分按分等は
        考慮していない。初めて控除の適用を受ける年は確定申告書に加えて(特定増改築等)
        住宅借入金等特別控除額の計算明細書・登記事項証明書・住宅取得資金に係る
        借入金の年末残高等証明書等の添付が必要になる。実際の適用要件・控除額は
        必ず国税庁の最新情報・税理士等の専門家に確認すること。
      </p>
    </div>
  );
}
