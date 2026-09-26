import Link from "next/link";
import { prisma } from "@/lib/db";
import { getOrCreateTaxYear, listTaxYears } from "@/lib/taxYear";
import { deleteAngelTaxLossCarryforward, setAngelTaxLossCarryforward } from "@/app/actions";
import { AngelTaxLossCarryforwardForm } from "./AngelTaxLossCarryforwardForm";

function yen(value: { toString(): string }): string {
  const n = Number(value.toString());
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

export default async function AngelTaxLossCarryforwardPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const params = await searchParams;
  const availableYears = await listTaxYears();
  const currentCalendarYear = new Date().getFullYear();
  const year = Number(params.year) || availableYears[0] || currentCalendarYear;

  const taxYear = await getOrCreateTaxYear(year);
  const carryforwards = await prisma.angelTaxLossCarryforward.findMany({
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
          エンジェル税制(特定投資株式に係る譲渡損失)の試算({year}年分)
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          エンジェル税制の対象となる特定株式・設立特定株式が価値を失った場合の
          みなし譲渡損失(国税庁タックスアンサーNo.1531)、その年の一般株式等→
          上場株式等の順の控除(No.1532)、控除しきれない金額の3年間の繰越控除
          (No.1533)を試算できる。取得価額を年内に譲渡益から控除する
          <Link href="/angel-tax-capital-gain-deduction" className="underline">
            譲渡益控除方式(優遇措置B)
          </Link>
          とは異なり、株式の売却・清算等による損失を扱う別制度。暗号資産・投資の
          自動集計とは独立した単体の試算画面のため、この年分の取引データには
          依存しない。
        </p>
      </header>

      <AngelTaxLossCarryforwardForm year={year} carryforwardEntries={carryforwardEntries} />

      <section className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
        <h2 className="mb-3 text-lg font-semibold">繰越控除の残高({year}年初時点)</h2>
        <p className="mb-3 text-sm text-neutral-500">
          国税庁タックスアンサーNo.1533により、その年に控除しきれなかった金額は
          翌年以後3年間繰り越せる。上の試算結果に翌年以後へ繰り越す額が表示された
          場合、その金額をここから翌年分として登録すること(他の繰越控除機能と
          異なり、この試算に必要な当年の特定株式の損失額・一般株式等の譲渡所得等の
          金額はDBに保存されないため、前年分の計算結果からの自動繰り越しには
          対応しない)。
        </p>

        <form
          action={setAngelTaxLossCarryforward}
          className="grid grid-cols-2 gap-3 sm:grid-cols-3"
        >
          <input type="hidden" name="year" value={year} />
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-neutral-500">損失の発生年</span>
            <input
              type="number"
              name="originYear"
              defaultValue={year - 1}
              required
              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-neutral-500">{year}年初時点の残高(円)</span>
            <input
              type="number"
              step="any"
              name="remainingAmountJpy"
              required
              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
            />
          </label>
          <div className="col-span-full">
            <button
              type="submit"
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
            >
              登録・更新
            </button>
          </div>
        </form>

        {carryforwards.length > 0 && (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-max text-left text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-900">
                <tr>
                  {["発生年", `${year}年初残高`, "控除期限", ""].map((h) => (
                    <th key={h} className="px-3 py-2 font-medium text-neutral-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {carryforwards.map((c) => (
                  <tr key={c.id} className="border-t border-neutral-100 dark:border-neutral-800">
                    <td className="px-3 py-2">{c.originYear}年分</td>
                    <td className="px-3 py-2">{yen(c.remainingAmountJpy)}</td>
                    <td className="px-3 py-2">{c.originYear + 3}年分まで</td>
                    <td className="px-3 py-2">
                      <form action={deleteAngelTaxLossCarryforward}>
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="year" value={year} />
                        <button className="text-xs text-red-600 hover:underline">削除</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        特定中小会社・特定新規中小会社の要件充足の確認、適用に必要な添付書類の
        準備はユーザー自身の確認事項とする。この繰越控除の適用を受けるには、
        損失が生じた年分以後、株式の譲渡がなかった年分も含めて一定の書類を
        添付した確定申告書を連続して提出する必要がある(国税庁タックスアンサー
        No.1533)。この試算結果を直接DBへ登録する機能は持たない(繰越控除の残高を
        除く)ため、実際の申告では
        <Link href="/tax-estimate" className="underline">
          /tax-estimate
        </Link>
        へ手入力で反映すること。
      </p>
    </div>
  );
}
