import Link from "next/link";
import { buildYearReport } from "@/lib/reporting";
import { buildTaxFilingSummary } from "@/lib/etax/summary";
import { listTaxYears } from "@/lib/taxYear";

function yen(value: { toString(): string }): string {
  const n = Number(value.toString());
  return `¥${n.toLocaleString("ja-JP")}`;
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const params = await searchParams;
  const availableYears = await listTaxYears();
  const currentCalendarYear = new Date().getFullYear();
  const year = Number(params.year) || availableYears[0] || currentCalendarYear;

  const report = await buildYearReport(year);
  const summary = report
    ? buildTaxFilingSummary(year, report.crypto, report.investment)
    : null;

  const yearOptions = Array.from(
    new Set([currentCalendarYear, currentCalendarYear - 1, ...availableYears]),
  ).sort((a, b) => b - a);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">確定申告ダッシュボード</h1>
          <p className="text-sm text-neutral-500">
            暗号資産・投資・マネーフォワード連携をまとめて管理します
          </p>
        </div>
        <form className="flex items-center gap-2" action="/">
          <label htmlFor="year" className="text-sm text-neutral-500">
            対象年分
          </label>
          <select
            id="year"
            name="year"
            defaultValue={year}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}年分
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white dark:bg-white dark:text-neutral-900"
          >
            表示
          </button>
        </form>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard
          title="雑所得(暗号資産)"
          value={summary ? yen(summary.cryptoMiscIncomeJpy) : "¥0"}
          hint="総平均法による年間損益"
        />
        <SummaryCard
          title="譲渡所得(株式等)"
          value={summary ? yen(summary.investmentCapitalGainJpy) : "¥0"}
          hint="移動平均法・課税口座分・申告分離課税"
        />
        <SummaryCard
          title="配当所得"
          value={summary ? yen(summary.investmentDividendJpy) : "¥0"}
          hint="課税口座分(NISA分は非課税のため除外)"
        />
      </section>

      <section className="flex flex-wrap gap-3">
        <Link
          href="/import"
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          データを取り込む / 手入力する
        </Link>
        <a
          href={`/api/export?year=${year}`}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
        >
          申告書作成コーナー用の下書きCSVをダウンロード
        </a>
      </section>

      {report && report.crypto.bySymbol.length > 0 && (
        <DetailTable
          title="暗号資産 銘柄別内訳"
          columns={["銘柄", "取得数量", "平均単価", "譲渡数量", "損益"]}
          rows={report.crypto.bySymbol.map((r) => [
            r.symbol,
            r.acquiredQuantity.toString(),
            yen(r.averageUnitCostJpy.toDecimalPlaces(0)),
            r.disposedQuantity.toString(),
            yen(r.realizedGainJpy),
          ])}
        />
      )}

      {report && report.investment.bySymbol.length > 0 && (
        <DetailTable
          title="株式等 銘柄別内訳"
          columns={["銘柄", "買付数量", "売却数量", "譲渡損益", "配当"]}
          rows={report.investment.bySymbol.map((r) => [
            r.symbol,
            r.buyQuantity.toString(),
            r.sellQuantity.toString(),
            yen(r.realizedGainJpy),
            yen(r.dividendJpy),
          ])}
        />
      )}

      {report &&
        report.crypto.bySymbol.length === 0 &&
        report.investment.bySymbol.length === 0 && (
          <p className="rounded-md border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500 dark:border-neutral-700">
            {year}年分の取引データがまだありません。「データを取り込む / 手入力する」から登録してください。
          </p>
        )}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <p className="text-sm text-neutral-500">{title}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-neutral-400">{hint}</p>
    </div>
  );
}

function DetailTable({
  title,
  columns,
  rows,
}: {
  title: string;
  columns: string[];
  rows: (string | number)[][];
}) {
  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold">{title}</h2>
      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="w-full min-w-max text-left text-sm">
          <thead className="bg-neutral-50 dark:bg-neutral-900">
            <tr>
              {columns.map((c) => (
                <th key={c} className="px-3 py-2 font-medium text-neutral-500">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t border-neutral-100 dark:border-neutral-800">
                {row.map((cell, j) => (
                  <td key={j} className="px-3 py-2">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
