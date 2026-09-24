import Link from "next/link";
import { buildYearReport } from "@/lib/reporting";
import { buildTaxFilingSummary } from "@/lib/etax/summary";
import { listTaxYears } from "@/lib/taxYear";
import { isAuthEnabled } from "@/lib/auth/session";
import { logout } from "./login/actions";
import { setCryptoCostMethod } from "./actions";

const CRYPTO_COST_METHOD_LABEL: Record<string, string> = {
  AVERAGE: "総平均法",
  MOVING_AVERAGE: "移動平均法",
};

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
  // calculateNisaLifetimeQuotaUsage は byType に TSUMITATE/GROWTH を必ず両方含める
  const nisaLifetimeGrowth = report?.nisaLifetimeQuota.byType.find(
    (t) => t.nisaType === "GROWTH",
  );
  const summary = report
    ? buildTaxFilingSummary(
        year,
        report.crypto,
        report.investment,
        report.lossCarryforward,
        report.cryptoMargin,
        report.futures,
        report.futuresLossCarryforward,
        undefined,
        undefined,
        report.investmentNonListed,
      )
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
        {isAuthEnabled() && (
          <form action={logout}>
            <button
              type="submit"
              className="text-sm text-neutral-500 hover:underline"
            >
              ログアウト
            </button>
          </form>
        )}
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="雑所得(暗号資産)"
          value={summary ? yen(summary.cryptoMiscIncomeJpy) : "¥0"}
          hint={
            summary && !summary.cryptoMarginIncomeJpy.isZero()
              ? `現物(${CRYPTO_COST_METHOD_LABEL[report?.cryptoCostMethod ?? "AVERAGE"]})${yen(summary.cryptoSpotIncomeJpy)} + 証拠金取引決済損益${yen(summary.cryptoMarginIncomeJpy)}`
              : `${CRYPTO_COST_METHOD_LABEL[report?.cryptoCostMethod ?? "AVERAGE"]}による年間損益`
          }
        />
        <SummaryCard
          title="譲渡所得(株式等)"
          value={summary ? yen(summary.investmentLossCarryforward.taxableGainJpy) : "¥0"}
          hint={
            summary && summary.investmentLossCarryforward.totalUsedJpy.greaterThan(0)
              ? `繰越損失控除${yen(summary.investmentLossCarryforward.totalUsedJpy)}適用後・課税口座分・申告分離課税`
              : "移動平均法・課税口座分・申告分離課税"
          }
        />
        <SummaryCard
          title="配当所得"
          value={summary ? yen(summary.investmentDividendJpy) : "¥0"}
          hint="課税口座分(NISA分は非課税のため除外)"
        />
        <SummaryCard
          title="先物取引に係る雑所得等(FX・先物)"
          value={report ? yen(report.futuresLossCarryforward.taxableGainJpy) : "¥0"}
          hint={
            report && report.futuresLossCarryforward.totalUsedJpy.greaterThan(0)
              ? `繰越損失控除${yen(report.futuresLossCarryforward.totalUsedJpy)}適用後・申告分離課税(株式等・暗号資産とは別プール)`
              : "申告分離課税(株式等・暗号資産とは別プール)"
          }
        />
        {report && !report.investmentNonListed.totalRealizedGainJpy.isZero() && (
          <SummaryCard
            title="譲渡所得等(一般株式等・非上場株式)"
            value={yen(report.nonListedInvestmentTaxableGainJpy)}
            hint="上場株式等とは別プールの申告分離課税・繰越控除制度なし(赤字は当年限りで切り捨て)"
          />
        )}
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
        <Link
          href={`/dividend-simulation?year=${year}`}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          配当所得の課税方式をシミュレーションする
        </Link>
        <Link
          href={`/foreign-tax-credit?year=${year}`}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          外国税額控除を試算する
        </Link>
        <Link
          href={`/distribution-adjusted-foreign-tax-credit?year=${year}`}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          分配時調整外国税相当額控除を試算する
        </Link>
        <Link
          href={`/tax-estimate?year=${year}`}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          所得税・住民税の概算合計税額を試算する
        </Link>
        <Link
          href={`/unrealized-gain?year=${year}`}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          含み損益をシミュレーションする
        </Link>
        <Link
          href={`/medical-expense-deduction?year=${year}`}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          医療費控除額を試算する
        </Link>
        <Link
          href={`/life-insurance-deduction?year=${year}`}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          生命保険料控除額を試算する
        </Link>
        <Link
          href={`/earthquake-insurance-deduction?year=${year}`}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          地震保険料控除額を試算する
        </Link>
        <Link
          href={`/small-business-mutual-aid-deduction?year=${year}`}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          小規模企業共済等掛金控除(iDeCo等)を試算する
        </Link>
        <Link
          href={`/social-insurance-deduction?year=${year}`}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          社会保険料控除額を試算する
        </Link>
        <Link
          href={`/specific-expense-deduction?year=${year}`}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          特定支出控除額を試算する
        </Link>
        <Link
          href={`/income-amount-adjustment-deduction?year=${year}`}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          所得金額調整控除額を試算する
        </Link>
        <Link
          href={`/dependent-deduction?year=${year}`}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          配偶者控除・扶養控除を試算する
        </Link>
        <Link
          href={`/basic-deduction?year=${year}`}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          基礎控除額を試算する
        </Link>
        <Link
          href={`/disability-deduction?year=${year}`}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          障害者控除額を試算する
        </Link>
        <Link
          href={`/widow-single-parent-deduction?year=${year}`}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          寡婦・ひとり親・勤労学生控除額を試算する
        </Link>
        <Link
          href={`/casualty-loss-deduction?year=${year}`}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          雑損控除額を試算する
        </Link>
        <Link
          href={`/donation-deduction?year=${year}`}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          寄附金控除(ふるさと納税等)額を試算する
        </Link>
        <Link
          href={`/donation-tax-credit?year=${year}`}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          政党等・認定NPO法人等寄附金特別控除(税額控除)を試算する
        </Link>
        <Link
          href={`/mortgage-deduction?year=${year}`}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          住宅ローン控除額を試算する
        </Link>
        <Link
          href={`/resident-tax-adjustment-deduction?year=${year}`}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          住民税の調整控除額を試算する
        </Link>
      </section>

      <section className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <form action={setCryptoCostMethod} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="year" value={year} />
          <label htmlFor="cryptoCostMethod" className="text-sm text-neutral-500">
            暗号資産の評価方法({year}年分)
          </label>
          <select
            id="cryptoCostMethod"
            name="cryptoCostMethod"
            defaultValue={report?.cryptoCostMethod ?? "AVERAGE"}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          >
            <option value="AVERAGE">総平均法(届出不要・法定算出方法)</option>
            <option value="MOVING_AVERAGE">移動平均法(税務署への届出が必要)</option>
          </select>
          <button
            type="submit"
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            変更
          </button>
        </form>
      </section>

      {summary && summary.investmentLossCarryforward.newLossJpy.greaterThan(0) && (
        <p className="rounded-md border border-dashed border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          {year}年分は上場株式等の譲渡損失が
          {yen(summary.investmentLossCarryforward.newLossJpy)}発生しています。
          確定申告で繰越控除の適用を受ける場合は申告書第四表の提出を忘れずに行い、
          「データを取り込む」の繰越控除セクションから翌年分に繰り越してください。
        </p>
      )}

      {summary && summary.investmentLossCarryforward.expiredByOriginYear.length > 0 && (
        <p className="rounded-md border border-dashed border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          控除期限(3年)を超えて繰り越せなかった譲渡損失があります:{" "}
          {summary.investmentLossCarryforward.expiredByOriginYear
            .map((e) => `${e.originYear}年分 ${yen(e.expiredAmountJpy)}`)
            .join(" / ")}
        </p>
      )}

      {report && report.futuresLossCarryforward.newLossJpy.greaterThan(0) && (
        <p className="rounded-md border border-dashed border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          {year}年分は先物取引に係る雑所得等(FX・先物)の損失が
          {yen(report.futuresLossCarryforward.newLossJpy)}発生しています。
          確定申告で繰越控除の適用を受ける場合は申告書第四表の提出を忘れずに行い、
          「データを取り込む」の先物取引の繰越控除セクションから翌年分に繰り越してください。
        </p>
      )}

      {report &&
        (() => {
          const missingInstitutions = report.assetBalanceReconciliation.filter(
            (r) => r.status === "MISSING_APP_TRADES",
          );
          return (
            missingInstitutions.length > 0 && (
              <p className="rounded-md border border-dashed border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
                マネーフォワードの資産残高はあるのに、アプリに取引明細が登録されていない
                金融機関があります(計上漏れの疑い・参考情報):{" "}
                {missingInstitutions.map((r) => r.institution).join(" / ")}
                。「データを取り込む」の「マネーフォワード資産残高との突合」欄で確認してください。
              </p>
            )
          );
        })()}

      {report && report.futuresLossCarryforward.expiredByOriginYear.length > 0 && (
        <p className="rounded-md border border-dashed border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          控除期限(3年)を超えて繰り越せなかった先物取引に係る雑所得等の損失があります:{" "}
          {report.futuresLossCarryforward.expiredByOriginYear
            .map((e) => `${e.originYear}年分 ${yen(e.expiredAmountJpy)}`)
            .join(" / ")}
        </p>
      )}

      {report &&
        (report.nisaQuota.tsumitateUsedJpy.greaterThan(0) ||
          report.nisaQuota.growthUsedJpy.greaterThan(0) ||
          report.nisaQuota.unclassifiedBuyJpy.greaterThan(0)) && (
          <section>
            <h2 className="mb-2 text-lg font-semibold">NISA年間投資枠の使用状況(試算)</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NisaQuotaCard
                title="つみたて投資枠"
                limitJpy={report.nisaQuota.tsumitateLimitJpy}
                usedJpy={report.nisaQuota.tsumitateUsedJpy}
                remainingJpy={report.nisaQuota.tsumitateRemainingJpy}
              />
              <NisaQuotaCard
                title="成長投資枠"
                limitJpy={report.nisaQuota.growthLimitJpy}
                usedJpy={report.nisaQuota.growthUsedJpy}
                remainingJpy={report.nisaQuota.growthRemainingJpy}
              />
            </div>
            <p className="mt-2 text-xs text-neutral-400">
              その年にアプリへ登録したNISA口座の買付(取得価額ベース)のみを集計した年間投資枠の試算。
            </p>
            {report.nisaQuota.unclassifiedBuyJpy.greaterThan(0) && (
              <p className="mt-2 rounded-md border border-dashed border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                NISA枠区分(つみたて/成長)が未入力の買付が
                {yen(report.nisaQuota.unclassifiedBuyJpy)}あります。上記の集計に含まれていないため、
                「データを取り込む」で該当取引を削除し、NISA枠区分を指定して登録し直してください。
              </p>
            )}
          </section>
        )}

      {report &&
        nisaLifetimeGrowth &&
        report.nisaLifetimeQuota.totalOpeningUsedJpy
          .plus(report.nisaLifetimeQuota.totalBuyJpy)
          .greaterThan(0) && (
          <section>
            <h2 className="mb-2 text-lg font-semibold">NISA生涯投資枠の使用状況(試算)</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NisaQuotaCard
                title="生涯投資枠(総枠)"
                limitJpy={report.nisaLifetimeQuota.lifetimeLimitJpy}
                usedJpy={report.nisaLifetimeQuota.totalClosingUsedJpy}
                remainingJpy={report.nisaLifetimeQuota.lifetimeLimitJpy.minus(
                  report.nisaLifetimeQuota.totalClosingUsedJpy,
                )}
              />
              <NisaQuotaCard
                title="うち成長投資枠"
                limitJpy={report.nisaLifetimeQuota.growthLifetimeLimitJpy}
                usedJpy={nisaLifetimeGrowth.closingUsedJpy}
                remainingJpy={report.nisaLifetimeQuota.growthLifetimeLimitJpy.minus(
                  nisaLifetimeGrowth.closingUsedJpy,
                )}
              />
            </div>
            <p className="mt-2 text-xs text-neutral-400">
              {year}年末時点の使用額(年始使用額+当年買付-当年売却分の簿価)。年始時点の使用額・
              当年の売却分(簿価)は「データを取り込む」の「NISA生涯投資枠」セクションで手入力する。
            </p>
            {report.nisaLifetimeQuota.exceededOverallJpy.greaterThan(0) && (
              <p className="mt-2 rounded-md border border-dashed border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
                年始時点の残り生涯投資枠(総枠)を超える買付があります: 超過額{" "}
                {yen(report.nisaLifetimeQuota.exceededOverallJpy)}
              </p>
            )}
            {report.nisaLifetimeQuota.exceededGrowthJpy.greaterThan(0) && (
              <p className="mt-2 rounded-md border border-dashed border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
                年始時点の残り成長投資枠(生涯上限1,200万円分)を超える成長投資枠での買付があります:
                超過額 {yen(report.nisaLifetimeQuota.exceededGrowthJpy)}
              </p>
            )}
          </section>
        )}

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

      {report && report.cryptoMargin.bySymbol.length > 0 && (
        <DetailTable
          title="暗号資産 証拠金(レバレッジ)取引 銘柄別内訳"
          columns={["銘柄", "決済件数", "決済損益", "手数料", "スワップ", "雑所得算入額"]}
          rows={report.cryptoMargin.bySymbol.map((r) => [
            r.symbol,
            r.settlementCount,
            yen(r.grossPnlJpy),
            yen(r.feeJpy),
            yen(r.swapJpy),
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

      {report && report.investmentNonListed.bySymbol.length > 0 && (
        <DetailTable
          title="一般株式等(非上場株式) 銘柄別内訳"
          columns={["銘柄", "買付数量", "売却数量", "譲渡損益", "配当"]}
          rows={report.investmentNonListed.bySymbol.map((r) => [
            r.symbol,
            r.buyQuantity.toString(),
            r.sellQuantity.toString(),
            yen(r.realizedGainJpy),
            yen(r.dividendJpy),
          ])}
        />
      )}

      {report && report.futures.bySymbol.length > 0 && (
        <DetailTable
          title="先物取引・FX 銘柄別内訳(先物取引に係る雑所得等)"
          columns={["銘柄", "決済件数", "決済損益", "手数料", "スワップ", "雑所得算入額"]}
          rows={report.futures.bySymbol.map((r) => [
            r.symbol,
            r.settlementCount,
            yen(r.grossPnlJpy),
            yen(r.feeJpy),
            yen(r.swapJpy),
            yen(r.realizedGainJpy),
          ])}
        />
      )}

      {report &&
        report.crypto.bySymbol.length === 0 &&
        report.cryptoMargin.bySymbol.length === 0 &&
        report.investment.bySymbol.length === 0 &&
        report.investmentNonListed.bySymbol.length === 0 &&
        report.futures.bySymbol.length === 0 && (
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

function NisaQuotaCard({
  title,
  limitJpy,
  usedJpy,
  remainingJpy,
}: {
  title: string;
  limitJpy: { toString(): string };
  usedJpy: { toString(): string };
  remainingJpy: { toString(): string };
}) {
  const exceeded = Number(remainingJpy.toString()) < 0;
  return (
    <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <p className="text-sm text-neutral-500">
        {title}(年間上限{yen(limitJpy)})
      </p>
      <p className="mt-1 text-2xl font-semibold">{yen(usedJpy)}</p>
      <p
        className={`mt-1 text-xs ${exceeded ? "font-medium text-red-600 dark:text-red-400" : "text-neutral-400"}`}
      >
        {exceeded ? `上限超過 ${yen(remainingJpy)}` : `残枠 ${yen(remainingJpy)}`}
      </p>
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
