import {
  addCryptoTrade,
  addInvestmentTrade,
  deleteCryptoTrade,
  deleteInvestmentTrade,
  importMoneyForwardCsv,
} from "@/app/actions";
import { prisma } from "@/lib/db";
import { getOrCreateTaxYear } from "@/lib/taxYear";

function yen(value: { toString(): string }): string {
  return `¥${Number(value.toString()).toLocaleString("ja-JP")}`;
}

function dateInputValue(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{
    year?: string;
    imported?: string;
    skipped?: string;
  }>;
}) {
  const params = await searchParams;
  const year = Number(params.year) || new Date().getFullYear();
  const taxYear = await getOrCreateTaxYear(year);

  const [cryptoTrades, investmentTrades] = await Promise.all([
    prisma.cryptoTrade.findMany({
      where: { taxYearId: taxYear.id },
      orderBy: { tradedAt: "desc" },
    }),
    prisma.investmentTrade.findMany({
      where: { taxYearId: taxYear.id },
      orderBy: { tradedAt: "desc" },
    }),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 p-6 sm:p-10">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">データ取り込み({year}年分)</h1>
        <p className="text-sm text-neutral-500">
          マネーフォワードのCSV取り込み、または暗号資産・株式等の取引を手入力できます
        </p>
      </header>

      {params.imported !== undefined && (
        <p className="rounded-md bg-green-50 px-4 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
          {params.imported}件のデータを取り込みました。
          {params.skipped ? ` (${params.skipped}件は形式不正のためスキップしました)` : ""}
        </p>
      )}

      <section className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
        <h2 className="mb-3 text-lg font-semibold">マネーフォワード ME CSV取り込み</h2>
        <p className="mb-3 text-sm text-neutral-500">
          マネーフォワード ME の「家計簿」→ CSVエクスポート機能で書き出したファイルをそのまま取り込めます。
        </p>
        <form action={importMoneyForwardCsv} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="year" value={year} />
          <input
            type="file"
            name="file"
            accept=".csv,text/csv"
            required
            className="text-sm"
          />
          <button
            type="submit"
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
          >
            取り込む
          </button>
        </form>
      </section>

      <section className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
        <h2 className="mb-3 text-lg font-semibold">暗号資産の取引を追加</h2>
        <form action={addCryptoTrade} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <input type="hidden" name="year" value={year} />
          <Field label="取引日時">
            <input type="datetime-local" name="tradedAt" required className={inputClass} />
          </Field>
          <Field label="銘柄">
            <input type="text" name="symbol" placeholder="BTC" required className={inputClass} />
          </Field>
          <Field label="種別">
            <select name="type" className={inputClass}>
              <option value="BUY">購入</option>
              <option value="SELL">売却</option>
              <option value="TRADE_IN">交換で取得</option>
              <option value="TRADE_OUT">交換で譲渡</option>
              <option value="INCOME">マイニング等収入</option>
              <option value="FEE">暗号資産建て手数料</option>
            </select>
          </Field>
          <Field label="数量">
            <input type="number" step="any" name="quantity" required className={inputClass} />
          </Field>
          <Field label="単価(円)">
            <input type="number" step="any" name="unitPriceJpy" required className={inputClass} />
          </Field>
          <Field label="手数料(円)">
            <input type="number" step="any" name="feeJpy" defaultValue={0} className={inputClass} />
          </Field>
          <Field label="取引所">
            <input type="text" name="exchange" className={inputClass} />
          </Field>
          <Field label="メモ">
            <input type="text" name="memo" className={inputClass} />
          </Field>
          <div className="col-span-full">
            <button
              type="submit"
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
            >
              追加
            </button>
          </div>
        </form>

        {cryptoTrades.length > 0 && (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-max text-left text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-900">
                <tr>
                  {["日時", "銘柄", "種別", "数量", "単価", "手数料", ""].map((h) => (
                    <th key={h} className="px-3 py-2 font-medium text-neutral-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cryptoTrades.map((t) => (
                  <tr key={t.id} className="border-t border-neutral-100 dark:border-neutral-800">
                    <td className="px-3 py-2">{dateInputValue(t.tradedAt)}</td>
                    <td className="px-3 py-2">{t.symbol}</td>
                    <td className="px-3 py-2">{t.type}</td>
                    <td className="px-3 py-2">{t.quantity.toString()}</td>
                    <td className="px-3 py-2">{yen(t.unitPriceJpy)}</td>
                    <td className="px-3 py-2">{yen(t.feeJpy)}</td>
                    <td className="px-3 py-2">
                      <form action={deleteCryptoTrade}>
                        <input type="hidden" name="id" value={t.id} />
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

      <section className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
        <h2 className="mb-3 text-lg font-semibold">株式・投資信託等の取引を追加</h2>
        <form action={addInvestmentTrade} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <input type="hidden" name="year" value={year} />
          <Field label="取引日時">
            <input type="datetime-local" name="tradedAt" required className={inputClass} />
          </Field>
          <Field label="銘柄コード">
            <input type="text" name="symbol" placeholder="7203" required className={inputClass} />
          </Field>
          <Field label="銘柄名">
            <input type="text" name="name" className={inputClass} />
          </Field>
          <Field label="資産種別">
            <select name="assetType" className={inputClass}>
              <option value="STOCK">株式</option>
              <option value="ETF">ETF</option>
              <option value="MUTUAL_FUND">投資信託</option>
              <option value="BOND">債券</option>
              <option value="FX">FX</option>
              <option value="OTHER">その他</option>
            </select>
          </Field>
          <Field label="種別">
            <select name="type" className={inputClass}>
              <option value="BUY">買付</option>
              <option value="SELL">売却</option>
              <option value="DIVIDEND">配当・分配金</option>
            </select>
          </Field>
          <Field label="数量">
            <input type="number" step="any" name="quantity" required className={inputClass} />
          </Field>
          <Field label="単価(円)">
            <input type="number" step="any" name="unitPriceJpy" required className={inputClass} />
          </Field>
          <Field label="手数料(円)">
            <input type="number" step="any" name="feeJpy" defaultValue={0} className={inputClass} />
          </Field>
          <Field label="口座区分">
            <select name="accountType" className={inputClass}>
              <option value="SPECIFIC_WITHHOLDING">特定口座(源泉徴収あり)</option>
              <option value="SPECIFIC_NO_WITHHOLDING">特定口座(源泉徴収なし)</option>
              <option value="GENERAL">一般口座</option>
              <option value="NISA">NISA口座</option>
            </select>
          </Field>
          <Field label="証券会社">
            <input type="text" name="broker" className={inputClass} />
          </Field>
          <label className="col-span-full flex items-center gap-2 text-sm">
            <input type="checkbox" name="isNisa" /> NISA口座での取引(非課税として損益計算から除外)
          </label>
          <div className="col-span-full">
            <button
              type="submit"
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
            >
              追加
            </button>
          </div>
        </form>

        {investmentTrades.length > 0 && (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-max text-left text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-900">
                <tr>
                  {["日時", "銘柄", "種別", "数量", "単価", "口座", ""].map((h) => (
                    <th key={h} className="px-3 py-2 font-medium text-neutral-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {investmentTrades.map((t) => (
                  <tr key={t.id} className="border-t border-neutral-100 dark:border-neutral-800">
                    <td className="px-3 py-2">{dateInputValue(t.tradedAt)}</td>
                    <td className="px-3 py-2">{t.symbol}</td>
                    <td className="px-3 py-2">{t.type}</td>
                    <td className="px-3 py-2">{t.quantity.toString()}</td>
                    <td className="px-3 py-2">{yen(t.unitPriceJpy)}</td>
                    <td className="px-3 py-2">{t.isNisa ? "NISA" : t.accountType}</td>
                    <td className="px-3 py-2">
                      <form action={deleteInvestmentTrade}>
                        <input type="hidden" name="id" value={t.id} />
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
    </div>
  );
}

const inputClass =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-neutral-500">{label}</span>
      {children}
    </label>
  );
}
