import {
  addCryptoMarginTrade,
  addCryptoTrade,
  addInvestmentTrade,
  carryForwardInvestmentLoss,
  carryForwardOpeningBalances,
  deleteAssetBalanceImportBatch,
  deleteAssetSymbolMapping,
  deleteBrokerAnnualReport,
  deleteCryptoMarginTrade,
  deleteCryptoTrade,
  deleteInvestmentTrade,
  deleteLossCarryforward,
  deleteOpeningBalance,
  importAssetBalanceCsv,
  importBrokerAnnualReportCsv,
  importCryptoExchangeCsv,
  importCryptoMarginCsv,
  importMoneyForwardCsv,
  setAssetSymbolMapping,
  setBrokerAnnualReport,
  setCryptoCostMethod,
  setLossCarryforward,
  setOpeningBalance,
} from "@/app/actions";
import { EXCHANGE_CSV_PRESETS } from "@/lib/crypto/exchangeCsv";
import { prisma } from "@/lib/db";
import { reconcileBrokerAnnualReports } from "@/lib/investment/annualReportReconciliation";
import {
  reconcileAssetBalances,
  reconcileAssetSymbolBalances,
} from "@/lib/moneyforward/assetBalanceReconciliation";
import { buildYearReport } from "@/lib/reporting";
import { getOrCreateTaxYear } from "@/lib/taxYear";

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  SPECIFIC_WITHHOLDING: "特定口座(源泉徴収あり)",
  SPECIFIC_NO_WITHHOLDING: "特定口座(源泉徴収なし)",
  GENERAL: "一般口座",
  NISA: "NISA口座",
};

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
    carried?: string;
    lossCarried?: string;
  }>;
}) {
  const params = await searchParams;
  const year = Number(params.year) || new Date().getFullYear();
  const taxYear = await getOrCreateTaxYear(year);

  const [
    cryptoTrades,
    cryptoMarginTrades,
    investmentTrades,
    openingBalances,
    lossCarryforwards,
    brokerAnnualReports,
    assetBalanceImportBatches,
    assetSymbolMappings,
    yearReport,
  ] = await Promise.all([
    prisma.cryptoTrade.findMany({
      where: { taxYearId: taxYear.id },
      orderBy: { tradedAt: "desc" },
    }),
    prisma.cryptoMarginTrade.findMany({
      where: { taxYearId: taxYear.id },
      orderBy: { settledAt: "desc" },
    }),
    prisma.investmentTrade.findMany({
      where: { taxYearId: taxYear.id },
      orderBy: { tradedAt: "desc" },
    }),
    prisma.openingBalance.findMany({
      where: { taxYearId: taxYear.id },
      orderBy: [{ assetClass: "asc" }, { symbol: "asc" }],
    }),
    prisma.investmentLossCarryforward.findMany({
      where: { taxYearId: taxYear.id },
      orderBy: { originYear: "asc" },
    }),
    prisma.brokerAnnualReport.findMany({
      where: { taxYearId: taxYear.id },
      orderBy: [{ broker: "asc" }, { accountType: "asc" }],
    }),
    prisma.importBatch.findMany({
      where: { taxYearId: taxYear.id, sourceType: "moneyforward_assets" },
      orderBy: { importedAt: "desc" },
      include: {
        assetBalanceSnapshots: {
          orderBy: [{ institution: "asc" }, { assetName: "asc" }],
        },
      },
    }),
    prisma.assetSymbolMapping.findMany({ orderBy: { assetName: "asc" } }),
    buildYearReport(year),
  ]);

  const assetBalanceSnapshots = assetBalanceImportBatches.flatMap(
    (b) => b.assetBalanceSnapshots,
  );
  const assetBalanceReconciliations = reconcileAssetBalances(
    assetBalanceSnapshots.map((s) => ({
      institution: s.institution,
      balanceJpy: s.balanceJpy.toString(),
    })),
    [
      ...cryptoTrades.map((t) => ({ institution: t.exchange })),
      ...investmentTrades.map((t) => ({ institution: t.broker })),
    ],
  );
  const assetSymbolReconciliations = reconcileAssetSymbolBalances(
    assetBalanceSnapshots.map((s) => ({
      institution: s.institution,
      assetName: s.assetName,
      balanceJpy: s.balanceJpy.toString(),
    })),
    assetSymbolMappings.map((m) => ({ assetName: m.assetName, symbol: m.symbol })),
    [
      ...cryptoTrades.map((t) => ({ institution: t.exchange, symbol: t.symbol })),
      ...investmentTrades.map((t) => ({ institution: t.broker, symbol: t.symbol })),
    ],
  );

  const brokerReconciliations = reconcileBrokerAnnualReports(
    brokerAnnualReports.map((r) => ({
      broker: r.broker,
      accountType: r.accountType,
      proceedsJpy: r.proceedsJpy.toString(),
      acquisitionCostJpy: r.acquisitionCostJpy.toString(),
      dividendJpy: r.dividendJpy.toString(),
    })),
    investmentTrades.map((t) => ({
      broker: t.broker,
      accountType: t.accountType,
      type: t.type,
      quantity: t.quantity.toString(),
      unitPriceJpy: t.unitPriceJpy.toString(),
      feeJpy: t.feeJpy.toString(),
    })),
  );
  const brokerReconciliationById = new Map(
    brokerAnnualReports.map((r, i) => [r.id, brokerReconciliations[i]]),
  );

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
        <h2 className="mb-3 text-lg font-semibold">
          マネーフォワード資産残高との突合(取引漏れ検出)
        </h2>
        <p className="mb-3 text-sm text-neutral-500">
          マネーフォワード ME の「資産の内訳」画面からダウンロードしたCSVを
          取り込むと、残高がある金融機関(取引所・証券会社)のうち、アプリに
          同じ名前の取引明細が1件も登録されていないものを「計上漏れの疑い」
          として一覧表示する。逆に、アプリには取引明細があるのにマネーフォワード
          側の資産残高に見当たらない金融機関も参考情報として表示する(資産の
          移管やマネーフォワード未連携の口座でも起こりうるため、こちらは
          計上漏れとは限らない)。銘柄ごとの数量・評価額までは自動比較しない
          (資産名と銘柄シンボルの対応判定・時価の扱いが自動化できないため)。
          金融機関名は、アプリ側の取引所名・証券会社名の入力(取引の
          「取引所」「証券会社」欄)と完全一致で突き合わせるため、表記を揃えて
          登録すること。CSVの列見出しは公開情報から確認できておらず未検証のため、
          列名を指定する汎用マッピング方式のみ提供する。
        </p>

        <form
          action={importAssetBalanceCsv}
          className="mb-6 grid grid-cols-2 gap-3 border-b border-dashed border-neutral-200 pb-6 dark:border-neutral-800 sm:grid-cols-3"
        >
          <input type="hidden" name="year" value={year} />
          <Field label="日付列名(任意)">
            <input type="text" name="dateColumn" className={inputClass} />
          </Field>
          <Field label="大分類列名(任意)">
            <input type="text" name="categoryColumn" className={inputClass} />
          </Field>
          <Field label="金融機関列名">
            <input type="text" name="institutionColumn" required className={inputClass} />
          </Field>
          <Field label="資産名列名">
            <input type="text" name="assetNameColumn" required className={inputClass} />
          </Field>
          <Field label="残高(評価額・円)列名">
            <input type="text" name="balanceColumn" required className={inputClass} />
          </Field>
          <div className="col-span-full flex flex-wrap items-center gap-3">
            <input type="file" name="file" accept=".csv,text/csv" required className="text-sm" />
            <button
              type="submit"
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
            >
              取り込む
            </button>
          </div>
        </form>

        {assetBalanceReconciliations.length > 0 && (
          <div className="mb-6 overflow-x-auto">
            <table className="w-full min-w-max text-left text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-900">
                <tr>
                  {["金融機関", "MF資産残高", "アプリの取引明細", "判定"].map((h) => (
                    <th key={h} className="px-3 py-2 font-medium text-neutral-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {assetBalanceReconciliations.map((r) => (
                  <tr key={r.institution} className="border-t border-neutral-100 dark:border-neutral-800">
                    <td className="px-3 py-2">{r.institution}</td>
                    <td className="px-3 py-2">
                      {r.moneyForwardBalanceJpy !== null ? yen(r.moneyForwardBalanceJpy) : "-"}
                    </td>
                    <td className="px-3 py-2">{r.hasAppTrades ? "あり" : "なし"}</td>
                    <td className="px-3 py-2">
                      {r.status === "OK" && (
                        <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950 dark:text-green-300">
                          一致
                        </span>
                      )}
                      {r.status === "MISSING_APP_TRADES" && (
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
                          計上漏れの疑い
                        </span>
                      )}
                      {r.status === "MISSING_IN_MONEYFORWARD" && (
                        <span className="rounded-full bg-yellow-50 px-2 py-0.5 text-xs font-medium text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300">
                          MF側に見当たらない(参考)
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mb-6 border-t border-dashed border-neutral-200 pt-6 dark:border-neutral-800">
          <h3 className="mb-2 text-sm font-semibold">
            銘柄マッピング(資産名 → 銘柄シンボル)
          </h3>
          <p className="mb-3 text-sm text-neutral-500">
            マネーフォワードの資産名(例:「ビットコイン」)とアプリの銘柄
            シンボル(例:「BTC」。取引入力時の「銘柄」欄と同じ表記)の対応を
            登録すると、下の「銘柄単位の突合」で金融機関だけでなく銘柄まで
            踏み込んだ計上漏れチェックができる。対応関係は年をまたいで
            変わらないマスタデータのため、登録は年を問わず共通で使われる。
            未登録の資産名は「未マッピング」として判定不能のまま表示される。
          </p>
          <form
            action={setAssetSymbolMapping}
            className="mb-4 flex flex-wrap items-end gap-3"
          >
            <input type="hidden" name="year" value={year} />
            <Field label="資産名(マネーフォワード側の表記)">
              <input type="text" name="assetName" required className={inputClass} />
            </Field>
            <Field label="銘柄シンボル">
              <input type="text" name="symbol" required className={inputClass} />
            </Field>
            <button
              type="submit"
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
            >
              登録
            </button>
          </form>

          {assetSymbolMappings.length > 0 && (
            <div className="mb-6 overflow-x-auto">
              <table className="w-full min-w-max text-left text-sm">
                <thead className="bg-neutral-50 dark:bg-neutral-900">
                  <tr>
                    {["資産名", "銘柄シンボル", ""].map((h) => (
                      <th key={h} className="px-3 py-2 font-medium text-neutral-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {assetSymbolMappings.map((m) => (
                    <tr key={m.id} className="border-t border-neutral-100 dark:border-neutral-800">
                      <td className="px-3 py-2">{m.assetName}</td>
                      <td className="px-3 py-2">{m.symbol}</td>
                      <td className="px-3 py-2">
                        <form action={deleteAssetSymbolMapping}>
                          <input type="hidden" name="id" value={m.id} />
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

          {assetSymbolReconciliations.length > 0 && (
            <div className="overflow-x-auto">
              <h4 className="mb-2 text-sm font-semibold">銘柄単位の突合</h4>
              <table className="w-full min-w-max text-left text-sm">
                <thead className="bg-neutral-50 dark:bg-neutral-900">
                  <tr>
                    {["金融機関", "資産名", "銘柄", "MF資産残高", "判定"].map((h) => (
                      <th key={h} className="px-3 py-2 font-medium text-neutral-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {assetSymbolReconciliations.map((r) => (
                    <tr
                      key={`${r.institution}:${r.assetName}`}
                      className="border-t border-neutral-100 dark:border-neutral-800"
                    >
                      <td className="px-3 py-2">{r.institution}</td>
                      <td className="px-3 py-2">{r.assetName}</td>
                      <td className="px-3 py-2">{r.symbol ?? "-"}</td>
                      <td className="px-3 py-2">{yen(r.moneyForwardBalanceJpy)}</td>
                      <td className="px-3 py-2">
                        {r.status === "OK" && (
                          <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950 dark:text-green-300">
                            一致
                          </span>
                        )}
                        {r.status === "MISSING_APP_TRADES" && (
                          <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
                            計上漏れの疑い
                          </span>
                        )}
                        {r.status === "UNMAPPED" && (
                          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                            未マッピング
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {assetBalanceImportBatches.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-max text-left text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-900">
                <tr>
                  {["取り込み日時", "ファイル名", "件数", ""].map((h) => (
                    <th key={h} className="px-3 py-2 font-medium text-neutral-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {assetBalanceImportBatches.map((b) => (
                  <tr key={b.id} className="border-t border-neutral-100 dark:border-neutral-800">
                    <td className="px-3 py-2">{dateInputValue(b.importedAt)}</td>
                    <td className="px-3 py-2">{b.fileName}</td>
                    <td className="px-3 py-2">{b.assetBalanceSnapshots.length}</td>
                    <td className="px-3 py-2">
                      <form action={deleteAssetBalanceImportBatch}>
                        <input type="hidden" name="importBatchId" value={b.id} />
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
        <h2 className="mb-3 text-lg font-semibold">暗号資産の計算方式</h2>
        <p className="mb-3 text-sm text-neutral-500">
          暗号資産の取得原価は、届出をしていない場合は法定算出方法である
          <strong>総平均法</strong>(その年の期首残高+年間取得分を合算した
          加重平均単価を、その年の全ての譲渡に適用)で計算する。届出により
          <strong>移動平均法</strong>(取得の都度、平均単価を更新し、
          譲渡時点の平均単価を取得原価とする)を選択している場合はこちらに
          切り替えられる。
          <strong className="text-neutral-700 dark:text-neutral-300">
            一度いずれかの方式で確定申告した後に方式を変更するには、原則として
            税務署への届出が必要
          </strong>
          なので、本設定はあくまで試算用途として扱うこと。
        </p>
        <form action={setCryptoCostMethod} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="year" value={year} />
          <input type="hidden" name="tab" value="opening" />
          <Field label="計算方式">
            <select
              name="cryptoCostMethod"
              defaultValue={taxYear.cryptoCostMethod}
              className={inputClass}
            >
              <option value="AVERAGE">総平均法(法定算出方法)</option>
              <option value="MOVING_AVERAGE">移動平均法(届出が必要)</option>
            </select>
          </Field>
          <button
            type="submit"
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
          >
            この年分に適用する
          </button>
        </form>
      </section>

      <section className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
        <h2 className="mb-3 text-lg font-semibold">暗号資産取引所CSVの取り込み</h2>
        <p className="mb-3 text-sm text-neutral-500">
          bitFlyer・Coincheck・GMOコイン・bitbank等、取引所からダウンロードした取引履歴CSVを
          取り込めます。既知の取引所はプリセットで取り込めますが、列見出しが一致しない
          場合やその他の取引所CSVは、下のマッピング欄にCSVのヘッダー名を入力してください。
          入出金や証拠金取引、税務上の性質が一意に決まらない明細は自動では取り込まず
          件数のみ表示します。取り込み後は必ず一覧で内容を確認してください。
        </p>
        <p className="mb-4 text-xs text-neutral-400">
          マッピング欄を1つでも入力した場合は、日付/銘柄/売買種別/「買い」を表す値/
          「売り」を表す値/数量/単価 の全項目を入力してください。例: Coincheckの
          「業界標準フォーマット」は 日付列=time / 銘柄列=trading_currency /
          売買種別列=operation(買い=buy, 売り=sell) / 数量列=amount / 単価列=price /
          手数料列=fee。bitFlyerの取引履歴CSVは 日付列=取引日時 / 銘柄列=通貨1 /
          売買種別列=取引種別(買い=買い, 売り=売り) / 数量列=通貨1数量 / 単価列=取引価格 /
          手数料列=手数料。取引所の仕様変更等で列名が異なる場合は、実際のCSVに合わせて入力してください。
        </p>
        <form
          action={importCryptoExchangeCsv}
          className="grid grid-cols-2 gap-3 sm:grid-cols-3"
        >
          <input type="hidden" name="year" value={year} />
          <Field label="プリセット">
            <select name="preset" className={inputClass} defaultValue="other">
              <option value="other">その他 / 手動マッピング</option>
              {EXCHANGE_CSV_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="取引所名(任意)">
            <input type="text" name="exchangeName" placeholder="bitFlyer" className={inputClass} />
          </Field>
          <Field label="日付列名(任意)">
            <input type="text" name="dateColumn" className={inputClass} />
          </Field>
          <Field label="銘柄列名(任意)">
            <input type="text" name="symbolColumn" className={inputClass} />
          </Field>
          <Field label="売買種別列名(任意)">
            <input type="text" name="typeColumn" className={inputClass} />
          </Field>
          <Field label="「買い」を表す値(任意)">
            <input type="text" name="buyValue" className={inputClass} />
          </Field>
          <Field label="「売り」を表す値(任意)">
            <input type="text" name="sellValue" className={inputClass} />
          </Field>
          <Field label="数量列名(任意)">
            <input type="text" name="quantityColumn" className={inputClass} />
          </Field>
          <Field label="単価(円)列名(任意)">
            <input type="text" name="unitPriceColumn" className={inputClass} />
          </Field>
          <Field label="手数料(円)列名(任意)">
            <input type="text" name="feeColumn" className={inputClass} />
          </Field>
          <div className="col-span-full flex flex-wrap items-center gap-3">
            <input type="file" name="file" accept=".csv,text/csv" required className="text-sm" />
            <button
              type="submit"
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
            >
              取り込む
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
        <h2 className="mb-3 text-lg font-semibold">期首残高(前年からの繰越)</h2>
        <p className="mb-3 text-sm text-neutral-500">
          総平均法・移動平均法による損益計算は複数年にまたがるため、年初時点で
          保有していた数量と取得価額の合計をここで登録する。{year}
          年より前から取引している場合は必ず登録すること。
        </p>

        {params.carried !== undefined && (
          <p className="mb-3 rounded-md bg-green-50 px-4 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
            {Number(params.carried) > 0
              ? `${params.carried}件の期首残高を${year - 1}年の期末残高から繰り越しました。`
              : `${year - 1}年の期末残高からの繰越候補はありませんでした(既に登録済みか、保有数量が0です)。`}
          </p>
        )}

        <form action={carryForwardOpeningBalances} className="mb-5">
          <input type="hidden" name="year" value={year} />
          <button
            type="submit"
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            {year - 1}年の期末残高から自動で繰り越す
          </button>
        </form>

        <form action={setOpeningBalance} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <input type="hidden" name="year" value={year} />
          <Field label="区分">
            <select name="assetClass" className={inputClass}>
              <option value="CRYPTO">暗号資産</option>
              <option value="INVESTMENT">株式・投資信託等</option>
            </select>
          </Field>
          <Field label="銘柄">
            <input type="text" name="symbol" placeholder="BTC / 7203" required className={inputClass} />
          </Field>
          <Field label="年初保有数量">
            <input type="number" step="any" name="quantity" required className={inputClass} />
          </Field>
          <Field label="年初取得価額合計(円)">
            <input type="number" step="any" name="costBasisJpy" required className={inputClass} />
          </Field>
          <label className="col-span-full flex items-center gap-2 text-sm">
            <input type="checkbox" name="isNisa" /> NISA口座分(株式等の場合のみ有効)
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

        {openingBalances.length > 0 && (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-max text-left text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-900">
                <tr>
                  {["区分", "銘柄", "数量", "取得価額合計", ""].map((h) => (
                    <th key={h} className="px-3 py-2 font-medium text-neutral-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {openingBalances.map((b) => (
                  <tr key={b.id} className="border-t border-neutral-100 dark:border-neutral-800">
                    <td className="px-3 py-2">
                      {b.assetClass === "CRYPTO" ? "暗号資産" : b.isNisa ? "株式等(NISA)" : "株式等"}
                    </td>
                    <td className="px-3 py-2">{b.symbol}</td>
                    <td className="px-3 py-2">{b.quantity.toString()}</td>
                    <td className="px-3 py-2">{yen(b.costBasisJpy)}</td>
                    <td className="px-3 py-2">
                      <form action={deleteOpeningBalance}>
                        <input type="hidden" name="id" value={b.id} />
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
        <h2 className="mb-3 text-lg font-semibold">
          上場株式等の譲渡損失の繰越控除(3年間)
        </h2>
        <p className="mb-3 text-sm text-neutral-500">
          確定申告により繰越控除の適用を受けた上場株式等の譲渡損失は、発生した
          年の翌年以後3年間、上場株式等の譲渡所得等の金額から控除できる
          (暗号資産の損失は雑所得のため対象外)。ここでは発生年ごとに、
          {year}年初時点でまだ使い切っていない繰越損失の残高を登録する
          (過去の申告書「株式等に係る譲渡所得等の金額の計算明細書」・第四表を参照)。
          控除は発生年の古いものから優先して適用される。
        </p>

        {params.lossCarried !== undefined && (
          <p className="mb-3 rounded-md bg-green-50 px-4 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
            {Number(params.lossCarried) > 0
              ? `${params.lossCarried}件の繰越損失を${year - 1}年分の計算結果から繰り越しました。`
              : `${year - 1}年分からの繰越候補はありませんでした(既に登録済みか、繰り越す損失がありません)。`}
          </p>
        )}

        <form action={carryForwardInvestmentLoss} className="mb-5">
          <input type="hidden" name="year" value={year} />
          <button
            type="submit"
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            {year - 1}年分の計算結果から自動で繰り越す
          </button>
        </form>

        <form
          action={setLossCarryforward}
          className="grid grid-cols-2 gap-3 sm:grid-cols-3"
        >
          <input type="hidden" name="year" value={year} />
          <Field label="損失の発生年">
            <input
              type="number"
              name="originYear"
              defaultValue={year - 1}
              required
              className={inputClass}
            />
          </Field>
          <Field label={`${year}年初時点の残高(円)`}>
            <input
              type="number"
              step="any"
              name="remainingAmountJpy"
              required
              className={inputClass}
            />
          </Field>
          <div className="col-span-full">
            <button
              type="submit"
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
            >
              登録・更新
            </button>
          </div>
        </form>

        {lossCarryforwards.length > 0 && (
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
                {lossCarryforwards.map((l) => (
                  <tr key={l.id} className="border-t border-neutral-100 dark:border-neutral-800">
                    <td className="px-3 py-2">{l.originYear}年分</td>
                    <td className="px-3 py-2">{yen(l.remainingAmountJpy)}</td>
                    <td className="px-3 py-2">{l.originYear + 3}年分まで</td>
                    <td className="px-3 py-2">
                      <form action={deleteLossCarryforward}>
                        <input type="hidden" name="id" value={l.id} />
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

        {yearReport && (
          <div className="mt-5 rounded-md bg-neutral-50 p-4 text-sm dark:bg-neutral-900">
            <p>
              {year}年分 譲渡損益(繰越控除前):{" "}
              {yen(yearReport.lossCarryforward.grossRealizedGainJpy)}
            </p>
            <p>繰越控除の使用額: {yen(yearReport.lossCarryforward.totalUsedJpy)}</p>
            <p>
              控除後の課税対象譲渡所得: {yen(yearReport.lossCarryforward.taxableGainJpy)}
            </p>
            {yearReport.lossCarryforward.newLossJpy.greaterThan(0) && (
              <p>
                {year}年分の新規譲渡損失(翌年以後3年間繰越可能):{" "}
                {yen(yearReport.lossCarryforward.newLossJpy)}
              </p>
            )}
            {yearReport.lossCarryforward.expiredByOriginYear.length > 0 && (
              <p className="text-red-600">
                控除期限切れで繰り越せなかった損失があります:{" "}
                {yearReport.lossCarryforward.expiredByOriginYear
                  .map((e) => `${e.originYear}年分 ${yen(e.expiredAmountJpy)}`)
                  .join(" / ")}
              </p>
            )}
          </div>
        )}
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
        <h2 className="mb-3 text-lg font-semibold">
          暗号資産の証拠金(レバレッジ)取引の決済損益
        </h2>
        <p className="mb-3 text-sm text-neutral-500">
          DMM Bitcoin・SBI VCトレード等の証拠金(レバレッジ)取引は、現物取引のように
          数量×単価で取得費を積み上げる総平均法/移動平均法の対象にはならず、
          決済(反対売買)のたびに確定する<strong>建玉損益</strong>
          がそのまま雑所得の収入・損失になる。ここに登録した決済損益は、上の
          「暗号資産の取引を追加」の現物取引分とは別に集計され、ダッシュボードでは
          合算した金額を雑所得(暗号資産)として表示する。取引所ごとのCSV仕様の
          差異が大きく未検証のため、専用プリセットは用意せず列名を指定する
          汎用マッピング方式のみで取り込む。
        </p>

        <div className="mb-6 border-b border-dashed border-neutral-200 pb-6 dark:border-neutral-800">
          <h3 className="mb-2 text-sm font-semibold">CSV取り込み(列名を指定)</h3>
          <form
            action={importCryptoMarginCsv}
            className="grid grid-cols-2 gap-3 sm:grid-cols-3"
          >
            <input type="hidden" name="year" value={year} />
            <Field label="取引所名(任意)">
              <input type="text" name="exchangeName" placeholder="DMM Bitcoin" className={inputClass} />
            </Field>
            <Field label="決済日時列名">
              <input type="text" name="dateColumn" required className={inputClass} />
            </Field>
            <Field label="銘柄列名">
              <input type="text" name="symbolColumn" required className={inputClass} />
            </Field>
            <Field label="決済損益(円)列名">
              <input type="text" name="pnlColumn" required className={inputClass} />
            </Field>
            <Field label="手数料(円)列名(任意)">
              <input type="text" name="feeColumn" className={inputClass} />
            </Field>
            <Field label="スワップ等(円)列名(任意)">
              <input type="text" name="swapColumn" className={inputClass} />
            </Field>
            <div className="col-span-full flex flex-wrap items-center gap-3">
              <input type="file" name="file" accept=".csv,text/csv" required className="text-sm" />
              <button
                type="submit"
                className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
              >
                取り込む
              </button>
            </div>
          </form>
        </div>

        <form
          action={addCryptoMarginTrade}
          className="grid grid-cols-2 gap-3 sm:grid-cols-3"
        >
          <input type="hidden" name="year" value={year} />
          <Field label="決済日時">
            <input type="datetime-local" name="settledAt" required className={inputClass} />
          </Field>
          <Field label="銘柄">
            <input type="text" name="symbol" placeholder="BTC" required className={inputClass} />
          </Field>
          <Field label="決済損益(円・損失は負の値)">
            <input type="number" step="any" name="realizedPnlJpy" required className={inputClass} />
          </Field>
          <Field label="手数料(円)">
            <input type="number" step="any" name="feeJpy" defaultValue={0} className={inputClass} />
          </Field>
          <Field label="スワップ等(円)">
            <input type="number" step="any" name="swapJpy" defaultValue={0} className={inputClass} />
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

        {cryptoMarginTrades.length > 0 && (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-max text-left text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-900">
                <tr>
                  {["決済日時", "銘柄", "決済損益", "手数料", "スワップ", ""].map((h) => (
                    <th key={h} className="px-3 py-2 font-medium text-neutral-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cryptoMarginTrades.map((t) => (
                  <tr key={t.id} className="border-t border-neutral-100 dark:border-neutral-800">
                    <td className="px-3 py-2">{dateInputValue(t.settledAt)}</td>
                    <td className="px-3 py-2">{t.symbol}</td>
                    <td className="px-3 py-2">{yen(t.realizedPnlJpy)}</td>
                    <td className="px-3 py-2">{yen(t.feeJpy)}</td>
                    <td className="px-3 py-2">{yen(t.swapJpy)}</td>
                    <td className="px-3 py-2">
                      <form action={deleteCryptoMarginTrade}>
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

        {yearReport && !yearReport.cryptoMargin.totalRealizedGainJpy.isZero() && (
          <p className="mt-4 rounded-md bg-neutral-50 p-3 text-sm dark:bg-neutral-900">
            {year}年分 証拠金取引の雑所得算入額(手数料控除・スワップ加算後):{" "}
            {yen(yearReport.cryptoMargin.totalRealizedGainJpy)}
          </p>
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

      <section className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
        <h2 className="mb-3 text-lg font-semibold">
          証券会社の特定口座年間取引報告書との突合
        </h2>
        <p className="mb-3 text-sm text-neutral-500">
          証券会社が発行する「特定口座年間取引報告書」の
          <strong>「譲渡の対価の額(収入金額)」</strong>と
          <strong>「配当等の額」</strong>
          をここに入力すると、同じ証券会社・口座区分でアプリに登録済みの
          売却・配当の取引明細から計算した金額と自動で突き合わせ、差額があれば
          表示する。差額がある場合、その証券会社の取引に計上漏れ・入力ミスがある
          可能性が高い。「取得費及び譲渡に要した費用の額等」は証券会社側が口座
          ごとに個別管理する取得原価であり、本ツールは銘柄単位・全口座合算の
          平均単価で計算するため前提が異なる(自動突合はせず、差引金額の参考
          表示のみ行う)。
        </p>

        <div className="mb-6 border-b border-dashed border-neutral-200 pb-6 dark:border-neutral-800">
          <h3 className="mb-2 text-sm font-semibold">CSV取り込み(列名を指定)</h3>
          <p className="mb-3 text-sm text-neutral-500">
            証券会社・口座区分ごとの年間サマリー数値を1行にまとめたCSVを取り込める。
            年間取引報告書自体はPDFで発行される証券会社が多く、CSVの様式は
            証券会社ごとに異なり未検証のため、専用プリセットは用意せず列名を
            指定する汎用マッピング方式のみで取り込む。同じ証券会社・口座区分の
            行は上書きされる。
          </p>
          <form
            action={importBrokerAnnualReportCsv}
            className="grid grid-cols-2 gap-3 sm:grid-cols-3"
          >
            <input type="hidden" name="year" value={year} />
            <Field label="証券会社列名">
              <input type="text" name="brokerColumn" required className={inputClass} />
            </Field>
            <Field label="口座区分列名">
              <input type="text" name="accountTypeColumn" required className={inputClass} />
            </Field>
            <Field label="譲渡の対価の額(収入金額)列名">
              <input type="text" name="proceedsColumn" required className={inputClass} />
            </Field>
            <Field label="取得費及び譲渡費用の額等列名">
              <input type="text" name="acquisitionCostColumn" required className={inputClass} />
            </Field>
            <Field label="配当等の額列名(任意)">
              <input type="text" name="dividendColumn" className={inputClass} />
            </Field>
            <div className="col-span-full flex flex-wrap items-center gap-3">
              <input type="file" name="file" accept=".csv,text/csv" required className="text-sm" />
              <button
                type="submit"
                className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
              >
                取り込む
              </button>
            </div>
          </form>
        </div>

        <form
          action={setBrokerAnnualReport}
          className="grid grid-cols-2 gap-3 sm:grid-cols-3"
        >
          <input type="hidden" name="year" value={year} />
          <Field label="証券会社">
            <input
              type="text"
              name="broker"
              placeholder="SBI証券"
              required
              className={inputClass}
            />
          </Field>
          <Field label="口座区分">
            <select name="accountType" className={inputClass}>
              <option value="SPECIFIC_WITHHOLDING">特定口座(源泉徴収あり)</option>
              <option value="SPECIFIC_NO_WITHHOLDING">特定口座(源泉徴収なし)</option>
              <option value="GENERAL">一般口座</option>
            </select>
          </Field>
          <Field label="譲渡の対価の額(収入金額・円)">
            <input
              type="number"
              step="any"
              name="proceedsJpy"
              required
              className={inputClass}
            />
          </Field>
          <Field label="取得費及び譲渡費用の額等(円)">
            <input
              type="number"
              step="any"
              name="acquisitionCostJpy"
              required
              className={inputClass}
            />
          </Field>
          <Field label="配当等の額(円・任意)">
            <input
              type="number"
              step="any"
              name="dividendJpy"
              defaultValue={0}
              className={inputClass}
            />
          </Field>
          <div className="col-span-full">
            <button
              type="submit"
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
            >
              登録・更新(同じ証券会社・口座区分は上書き)
            </button>
          </div>
        </form>

        {brokerAnnualReports.length > 0 && (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-max text-left text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-900">
                <tr>
                  {[
                    "証券会社",
                    "口座区分",
                    "収入金額(報告書/計算/差額)",
                    "配当等(報告書/計算/差額)",
                    "判定",
                    "",
                  ].map((h) => (
                    <th key={h} className="px-3 py-2 font-medium text-neutral-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {brokerAnnualReports.map((r) => {
                  const rec = brokerReconciliationById.get(r.id);
                  return (
                    <tr key={r.id} className="border-t border-neutral-100 dark:border-neutral-800">
                      <td className="px-3 py-2">{r.broker}</td>
                      <td className="px-3 py-2">
                        {ACCOUNT_TYPE_LABELS[r.accountType] ?? r.accountType}
                      </td>
                      <td className="px-3 py-2">
                        {rec && (
                          <>
                            {yen(rec.reportProceedsJpy)} / {yen(rec.calculatedProceedsJpy)}{" "}
                            <span
                              className={
                                rec.proceedsDiffJpy.abs().greaterThan(1)
                                  ? "text-red-600"
                                  : "text-neutral-400"
                              }
                            >
                              (差額 {yen(rec.proceedsDiffJpy)})
                            </span>
                          </>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {rec && (
                          <>
                            {yen(rec.reportDividendJpy)} / {yen(rec.calculatedDividendJpy)}{" "}
                            <span
                              className={
                                rec.dividendDiffJpy.abs().greaterThan(1)
                                  ? "text-red-600"
                                  : "text-neutral-400"
                              }
                            >
                              (差額 {yen(rec.dividendDiffJpy)})
                            </span>
                          </>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {rec?.hasDiscrepancy ? (
                          <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
                            不一致
                          </span>
                        ) : (
                          <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950 dark:text-green-300">
                            一致
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <form action={deleteBrokerAnnualReport}>
                          <input type="hidden" name="id" value={r.id} />
                          <input type="hidden" name="year" value={year} />
                          <button className="text-xs text-red-600 hover:underline">削除</button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-neutral-400">
              収入金額・配当等は「報告書の値 / アプリ計算値」の順に表示する。
              差額は報告書の値からアプリ計算値を引いた金額(プラスは計上漏れの
              可能性、マイナスは重複計上・入力額の誤りの可能性がある)。
            </p>
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
