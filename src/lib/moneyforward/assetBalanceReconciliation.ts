import { Decimal } from "decimal.js";

/**
 * マネーフォワード ME の資産残高(AssetBalanceSnapshot)と、アプリ内に登録済みの
 * 暗号資産・投資取引の金融機関(CryptoTrade.exchange / InvestmentTrade.broker)
 * を突き合わせ、取引の計上漏れの疑いを検知する。
 *
 * 銘柄単位での数量・評価額の突合は、
 *  - マネーフォワード側の資産名の表記(例:「ビットコイン」)とアプリ側の
 *    銘柄シンボル(例:「BTC」)の対応が自動では判定できない
 *  - 評価額は時価に左右されるため、取得原価ベースの保有数量と単純比較できない
 * という理由で行わず、`annualReportReconciliation.ts`と同様に自動判定できる
 * 範囲(ここでは金融機関の突合)に限定する。そのため、この突合はあくまで
 * 「登録漏れの可能性がある金融機関」を洗い出すための参考情報であり、
 * 一致していても計上漏れが無いことを保証するものではない
 * (逆方向の不一致は、証券会社を跨いだ資産移管やMoneyForward未連携の
 * ウォレット・口座でも起こりうるため、こちらも参考情報に留める)。
 */

export interface AssetBalanceSnapshotEntry {
  institution: string;
  balanceJpy: Decimal.Value;
}

export interface AccountActivityEntry {
  institution: string | null | undefined;
}

export type AssetBalanceReconciliationStatus =
  | "OK"
  | "MISSING_APP_TRADES"
  | "MISSING_IN_MONEYFORWARD";

export interface AssetBalanceReconciliationResult {
  institution: string;
  /** マネーフォワードの資産残高(同一金融機関の複数行を合算)。未登録なら null */
  moneyForwardBalanceJpy: Decimal | null;
  /** アプリ内に当該金融機関の取引明細が1件以上あるか */
  hasAppTrades: boolean;
  status: AssetBalanceReconciliationStatus;
}

function normalizeInstitution(value: string): string {
  return value.trim();
}

/**
 * マネーフォワードの資産残高とアプリ内の取引明細の金融機関を突き合わせる。
 * DBに依存しない純粋関数。
 *
 * - マネーフォワード側で残高(合算)が0より大きい金融機関なのに、アプリ側に
 *   同名の取引明細が1件も無い -> MISSING_APP_TRADES(計上漏れの疑い)
 * - アプリ側に取引明細がある金融機関なのに、マネーフォワード側の資産残高に
 *   同名の行が見当たらない -> MISSING_IN_MONEYFORWARD(参考情報)
 * - 両方に存在する -> OK
 */
export function reconcileAssetBalances(
  snapshots: AssetBalanceSnapshotEntry[],
  activities: AccountActivityEntry[],
): AssetBalanceReconciliationResult[] {
  const mfBalanceByInstitution = new Map<string, Decimal>();
  for (const snapshot of snapshots) {
    const institution = normalizeInstitution(snapshot.institution);
    if (!institution) continue;
    const amount = new Decimal(snapshot.balanceJpy);
    mfBalanceByInstitution.set(
      institution,
      (mfBalanceByInstitution.get(institution) ?? new Decimal(0)).plus(amount),
    );
  }

  const appInstitutions = new Set<string>();
  for (const activity of activities) {
    const institution = activity.institution ? normalizeInstitution(activity.institution) : "";
    if (institution) appInstitutions.add(institution);
  }

  const results: AssetBalanceReconciliationResult[] = [];
  const seen = new Set<string>();

  for (const [institution, balanceJpy] of mfBalanceByInstitution) {
    seen.add(institution);
    const hasAppTrades = appInstitutions.has(institution);
    results.push({
      institution,
      moneyForwardBalanceJpy: balanceJpy,
      hasAppTrades,
      status: !hasAppTrades && balanceJpy.greaterThan(0) ? "MISSING_APP_TRADES" : "OK",
    });
  }

  for (const institution of appInstitutions) {
    if (seen.has(institution)) continue;
    results.push({
      institution,
      moneyForwardBalanceJpy: null,
      hasAppTrades: true,
      status: "MISSING_IN_MONEYFORWARD",
    });
  }

  return results.sort((a, b) => a.institution.localeCompare(b.institution, "ja"));
}
