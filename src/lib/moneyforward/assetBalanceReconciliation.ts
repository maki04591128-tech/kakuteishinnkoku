import { Decimal } from "decimal.js";

/**
 * マネーフォワード ME の資産残高(AssetBalanceSnapshot)と、アプリ内に登録済みの
 * 暗号資産・投資取引の金融機関(CryptoTrade.exchange / InvestmentTrade.broker)
 * を突き合わせ、取引の計上漏れの疑いを検知する。
 *
 * 銘柄単位での評価額の突合は、
 *  - マネーフォワード側の資産名の表記(例:「ビットコイン」)とアプリ側の
 *    銘柄シンボル(例:「BTC」)の対応が自動では判定できない
 *  - 評価額は時価に左右されるため、取得原価ベースの保有数量と単純比較できない
 * という理由で行わず、`annualReportReconciliation.ts`と同様に自動判定できる
 * 範囲(ここでは金融機関の突合)に限定する。そのため、この突合はあくまで
 * 「登録漏れの可能性がある金融機関」を洗い出すための参考情報であり、
 * 一致していても計上漏れが無いことを保証するものではない
 * (逆方向の不一致は、証券会社を跨いだ資産移管やMoneyForward未連携の
 * ウォレット・口座でも起こりうるため、こちらも参考情報に留める)。
 *
 * ユーザーが`AssetSymbolMapping`(マネーフォワードの資産名 <-> アプリの
 * 銘柄シンボル)を登録している場合は、`reconcileAssetSymbolBalances`で
 * 金融機関単位よりもう一段細かい「金融機関×銘柄」単位の突合も行える。
 * さらにCSVに数量列(quantityColumn)を指定した場合は、評価額とは異なり
 * 時価に左右されない「保有数量」そのものの突合(quantityCheck)も行える
 * (詳細はAssetQuantityCheckStatusのコメント参照)。数量列を指定しない場合は
 * 従来どおり「その金融機関にその銘柄の取引明細が1件でもあるか」という
 * 存在判定のみになる。
 *
 * 銘柄ごとに`MarketPrice`(現在価格の手入力。時価を自動取得する仕組みは
 * 持たない)を登録している場合は、評価額そのものの突合(valueCheck)も行える。
 * 期待保有数量(期首残高+当年の増減。quantityCheckと同じ計算)×登録価格を
 * 期待評価額とし、マネーフォワード側の評価額と比較する。手入力の価格は
 * マネーフォワード側の評価時点とずれることが避けられないため、完全一致は
 * 求めず、大きな乖離(既定で期待評価額の±10%超)のみを「要確認」として
 * 検知する目安情報に留める。quantityCheckが使える場合はそちらのほうが
 * 時価に左右されず精度が高いため優先して確認すること。
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

export interface AssetBalanceSnapshotWithNameEntry {
  institution: string;
  assetName: string;
  balanceJpy: Decimal.Value;
  /** 保有数量(任意)。CSV取り込み時に数量列を指定していない場合はnull/undefined */
  quantity?: Decimal.Value | null;
}

export interface AssetSymbolMappingEntry {
  assetName: string;
  symbol: string;
}

export interface AppSymbolHoldingEntry {
  institution: string | null | undefined;
  symbol: string;
  /**
   * その年の取引による保有数量の増減(取得は+、譲渡は-)。
   * `cryptoTradeQuantityDelta` / `investmentTradeQuantityDelta`で算出する。
   * 省略した場合は数量突合の対象外(既存の存在判定のみ)になる。
   */
  quantityDelta?: Decimal.Value;
}

/**
 * 銘柄ごとの期首残高数量。`OpeningBalance`から集計する(金融機関単位では
 * 管理していない)。`institution`を指定した場合は、`OpeningBalanceByInstitution`
 * から集計した「その金融機関における」期首残高として扱われ、同一銘柄が
 * 複数の金融機関にまたがっていてもその金融機関については按分不要で
 * 数量突合に使える(詳細はAssetQuantityCheckStatusのコメント参照)。
 */
export interface OpeningQuantityEntry {
  symbol: string;
  quantity: Decimal.Value;
  institution?: string | null;
}

export type AssetSymbolReconciliationStatus = "OK" | "MISSING_APP_TRADES" | "UNMAPPED";

/**
 * 数量突合の結果。評価額(balanceJpy)と異なり時価に左右されないため、
 * 突合できる場合は評価額よりも精度の高いチェックになる。
 *
 * - NOT_AVAILABLE: CSVに数量列が無い、または銘柄が未マッピングで判定できない
 * - SKIPPED_AMBIGUOUS_OPENING_BALANCE: 銘柄に(金融機関を指定しない)期首残高が
 *   あり、かつ当年その銘柄の取引が複数の金融機関にまたがっているため、期首残高を
 *   どの金融機関に按分すべきか本ツールのデータだけでは判定できず、突合を見送った。
 *   `OpeningBalanceByInstitution`でその金融機関の期首残高を個別登録すれば、
 *   その金融機関については按分不要になり突合できるようになる
 * - OK: マネーフォワードの数量とアプリ側の期待数量(期首残高+当年の増減)が一致
 * - MISMATCH: 一致しない(取引の入力漏れ・入力ミスの可能性)
 */
export type AssetQuantityCheckStatus =
  | "NOT_AVAILABLE"
  | "SKIPPED_AMBIGUOUS_OPENING_BALANCE"
  | "OK"
  | "MISMATCH";

export interface AssetQuantityCheckResult {
  status: AssetQuantityCheckStatus;
  /** マネーフォワード側の数量。取り込んでいない場合はnull */
  snapshotQuantity: Decimal | null;
  /** アプリ側から計算した期待数量(期首残高+当年の増減)。判定できない場合はnull */
  expectedQuantity: Decimal | null;
  /** snapshotQuantity - expectedQuantity。判定できない場合はnull */
  diff: Decimal | null;
}

export interface AssetSymbolReconciliationResult {
  institution: string;
  assetName: string;
  /** アプリ側の銘柄シンボル。`AssetSymbolMapping`未登録の資産名はnull */
  symbol: string | null;
  /** マネーフォワードの資産残高(同一金融機関×資産名の複数行を合算) */
  moneyForwardBalanceJpy: Decimal;
  /** アプリ内に当該金融機関×銘柄の取引明細が1件以上あるか(未マッピングの場合はfalse) */
  hasAppTrades: boolean;
  status: AssetSymbolReconciliationStatus;
  quantityCheck: AssetQuantityCheckResult;
  valueCheck: AssetValueCheckResult;
}

/** 数量の一致判定の許容誤差(暗号資産の最小単位である1satoshi=0.00000001を基準) */
const QUANTITY_EPSILON = new Decimal("0.00000001");

const NOT_AVAILABLE_QUANTITY_CHECK: AssetQuantityCheckResult = {
  status: "NOT_AVAILABLE",
  snapshotQuantity: null,
  expectedQuantity: null,
  diff: null,
};

export interface MarketPriceEntry {
  symbol: string;
  /** 1単位あたりの現在価格(円) */
  priceJpy: Decimal.Value;
}

export type AssetValueCheckStatus =
  | "NOT_AVAILABLE"
  | "SKIPPED_AMBIGUOUS_OPENING_BALANCE"
  | "OK"
  | "LARGE_DEVIATION";

/**
 * 評価額突合の結果。quantityCheckと異なりCSVの数量列の有無に関係なく、
 * `MarketPrice`(現在価格の手入力)が登録済みの銘柄であれば計算できる
 * (期待保有数量自体は期首残高+当年の増減から求まるため)。
 *
 * - NOT_AVAILABLE: 銘柄が未マッピング、またはその銘柄の`MarketPrice`が未登録
 * - SKIPPED_AMBIGUOUS_OPENING_BALANCE: quantityCheckと同様、期首残高の
 *   按分ができず期待保有数量が求まらないため見送り
 * - OK: 期待評価額(期待保有数量×登録価格)とマネーフォワード側の評価額の差が
 *   許容範囲内(既定で期待評価額の±10%以内)
 * - LARGE_DEVIATION: 許容範囲を超える乖離があり、計上漏れ・入力ミス・
 *   登録価格が古い等の可能性がある(手入力の価格とマネーフォワード側の評価
 *   時点がずれるため、あくまで目安の警告でありOKでも一致を保証しない)
 */
export interface AssetValueCheckResult {
  status: AssetValueCheckStatus;
  /** 登録済みの現在価格。未登録の場合はnull */
  marketPriceJpy: Decimal | null;
  /** quantityCheckと同じ計算による期待保有数量。判定できない場合はnull */
  expectedQuantity: Decimal | null;
  /** 期待保有数量×登録価格。判定できない場合はnull */
  expectedValueJpy: Decimal | null;
  /** マネーフォワード側の評価額 - 期待評価額。判定できない場合はnull */
  diffJpy: Decimal | null;
  /** |diffJpy| / |expectedValueJpy|。期待評価額が0、または判定できない場合はnull */
  diffRatio: Decimal | null;
}

/** 評価額の乖離許容率。手入力価格と評価時点のずれを見込み、大きな乖離のみを警告する目安値 */
const VALUE_CHECK_TOLERANCE_RATIO = new Decimal("0.1");

const NOT_AVAILABLE_VALUE_CHECK: AssetValueCheckResult = {
  status: "NOT_AVAILABLE",
  marketPriceJpy: null,
  expectedQuantity: null,
  expectedValueJpy: null,
  diffJpy: null,
  diffRatio: null,
};

function normalizeSymbol(value: string): string {
  return value.trim().toUpperCase();
}

/**
 * マネーフォワードの資産残高を、ユーザー登録の資産名→銘柄シンボル対応表
 * (`AssetSymbolMapping`)を使ってアプリ内の取引明細と「金融機関×銘柄」単位で
 * 突き合わせる。DBに依存しない純粋関数。
 *
 * - 資産名に対応表の登録が無い -> UNMAPPED(判定不能。マッピング登録を促す)
 * - 対応表はあるが、同じ金融機関×銘柄の取引明細がアプリに1件も無く、
 *   マネーフォワード側の残高(合算)が0より大きい -> MISSING_APP_TRADES
 * - それ以外 -> OK
 *
 * 上記の存在判定に加えて、CSVに数量列があり`appHoldings`に`quantityDelta`
 * (当年の取引による数量の増減)、`openingQuantities`に期首残高数量を渡した
 * 場合は、`quantityCheck`で「期首残高+当年の増減」とマネーフォワード側の数量を
 * 比較する。期首残高は銘柄単位でしか管理していないため、同一銘柄を複数の
 * 金融機関で保有している場合はどちらに帰属するか判定できず、その場合は
 * SKIPPED_AMBIGUOUS_OPENING_BALANCEとして数量突合を見送る。ただし
 * `openingQuantities`の要素に`institution`を指定した(=`OpeningBalanceByInstitution`
 * に登録がある)金融機関×銘柄については、按分の必要が無いためその値を優先して
 * 使い、他の金融機関が同じ銘柄を保有していても数量突合を行う。
 */
export function reconcileAssetSymbolBalances(
  snapshots: AssetBalanceSnapshotWithNameEntry[],
  mappings: AssetSymbolMappingEntry[],
  appHoldings: AppSymbolHoldingEntry[],
  openingQuantities: OpeningQuantityEntry[] = [],
  marketPrices: MarketPriceEntry[] = [],
): AssetSymbolReconciliationResult[] {
  const symbolByAssetName = new Map<string, string>();
  for (const mapping of mappings) {
    const assetName = normalizeInstitution(mapping.assetName);
    if (!assetName) continue;
    symbolByAssetName.set(assetName, normalizeSymbol(mapping.symbol));
  }

  const marketPriceBySymbol = new Map<string, Decimal>();
  for (const marketPrice of marketPrices) {
    const symbol = normalizeSymbol(marketPrice.symbol);
    if (!symbol) continue;
    marketPriceBySymbol.set(symbol, new Decimal(marketPrice.priceJpy));
  }

  const appSymbolsByInstitution = new Map<string, Set<string>>();
  const institutionsBySymbol = new Map<string, Set<string>>();
  const quantityDeltaByKey = new Map<string, Decimal>();
  for (const holding of appHoldings) {
    const institution = holding.institution ? normalizeInstitution(holding.institution) : "";
    if (!institution) continue;
    const symbol = normalizeSymbol(holding.symbol);
    if (!symbol) continue;

    const set = appSymbolsByInstitution.get(institution) ?? new Set<string>();
    set.add(symbol);
    appSymbolsByInstitution.set(institution, set);

    const institutions = institutionsBySymbol.get(symbol) ?? new Set<string>();
    institutions.add(institution);
    institutionsBySymbol.set(symbol, institutions);

    if (holding.quantityDelta !== undefined) {
      const key = `${institution} ${symbol}`;
      const delta = new Decimal(holding.quantityDelta);
      quantityDeltaByKey.set(key, (quantityDeltaByKey.get(key) ?? new Decimal(0)).plus(delta));
    }
  }

  const openingQuantityBySymbol = new Map<string, Decimal>();
  const openingQuantityByInstitutionSymbol = new Map<string, Decimal>();
  for (const opening of openingQuantities) {
    const symbol = normalizeSymbol(opening.symbol);
    if (!symbol) continue;
    const quantity = new Decimal(opening.quantity);
    const institution = opening.institution
      ? normalizeInstitution(opening.institution)
      : "";
    if (institution) {
      const key = `${institution} ${symbol}`;
      openingQuantityByInstitutionSymbol.set(
        key,
        (openingQuantityByInstitutionSymbol.get(key) ?? new Decimal(0)).plus(quantity),
      );
    } else {
      openingQuantityBySymbol.set(
        symbol,
        (openingQuantityBySymbol.get(symbol) ?? new Decimal(0)).plus(quantity),
      );
    }
  }

  const balanceByKey = new Map<
    string,
    { institution: string; assetName: string; balanceJpy: Decimal; quantity: Decimal | null }
  >();
  for (const snapshot of snapshots) {
    const institution = normalizeInstitution(snapshot.institution);
    const assetName = normalizeInstitution(snapshot.assetName);
    if (!institution || !assetName) continue;
    const key = `${institution} ${assetName}`;
    const amount = new Decimal(snapshot.balanceJpy);
    const existing = balanceByKey.get(key);
    const snapshotQuantity =
      snapshot.quantity === null || snapshot.quantity === undefined
        ? null
        : new Decimal(snapshot.quantity);
    balanceByKey.set(key, {
      institution,
      assetName,
      balanceJpy: (existing?.balanceJpy ?? new Decimal(0)).plus(amount),
      quantity:
        snapshotQuantity === null
          ? (existing?.quantity ?? null)
          : (existing?.quantity ?? new Decimal(0)).plus(snapshotQuantity),
    });
  }

  const results: AssetSymbolReconciliationResult[] = [];
  for (const { institution, assetName, balanceJpy, quantity } of balanceByKey.values()) {
    const symbol = symbolByAssetName.get(assetName) ?? null;
    if (!symbol) {
      results.push({
        institution,
        assetName,
        symbol: null,
        moneyForwardBalanceJpy: balanceJpy,
        hasAppTrades: false,
        status: "UNMAPPED",
        quantityCheck: NOT_AVAILABLE_QUANTITY_CHECK,
        valueCheck: NOT_AVAILABLE_VALUE_CHECK,
      });
      continue;
    }

    const hasAppTrades = appSymbolsByInstitution.get(institution)?.has(symbol) ?? false;

    // 期待保有数量(期首残高+当年の増減)は、quantityCheck(数量突合)と
    // valueCheck(評価額突合)の両方で使う共通の計算。数量突合はCSVの数量列が
    // 無いと行えないが、期待保有数量自体はCSVの数量列に依存しないため、
    // valueCheckは`MarketPrice`さえ登録されていればCSVの数量列が無くても行える。
    const delta = quantityDeltaByKey.get(`${institution} ${symbol}`) ?? new Decimal(0);
    const institutionOpeningQuantity = openingQuantityByInstitutionSymbol.get(
      `${institution} ${symbol}`,
    );
    const institutionsForSymbol = institutionsBySymbol.get(symbol) ?? new Set<string>();
    const unassignedOpeningQuantity = openingQuantityBySymbol.get(symbol) ?? new Decimal(0);
    const isAmbiguousOpeningBalance =
      institutionOpeningQuantity === undefined &&
      unassignedOpeningQuantity.greaterThan(0) &&
      institutionsForSymbol.size > 1;
    const expectedQuantity = isAmbiguousOpeningBalance
      ? null
      : (institutionOpeningQuantity ?? unassignedOpeningQuantity).plus(delta);

    let quantityCheck: AssetQuantityCheckResult;
    if (quantity === null) {
      quantityCheck = NOT_AVAILABLE_QUANTITY_CHECK;
    } else if (isAmbiguousOpeningBalance) {
      quantityCheck = {
        status: "SKIPPED_AMBIGUOUS_OPENING_BALANCE",
        snapshotQuantity: quantity,
        expectedQuantity: null,
        diff: null,
      };
    } else {
      const diff = quantity.minus(expectedQuantity!);
      quantityCheck = {
        status: diff.abs().lessThanOrEqualTo(QUANTITY_EPSILON) ? "OK" : "MISMATCH",
        snapshotQuantity: quantity,
        expectedQuantity,
        diff,
      };
    }

    const marketPriceJpy = marketPriceBySymbol.get(symbol) ?? null;
    let valueCheck: AssetValueCheckResult;
    if (marketPriceJpy === null) {
      valueCheck = NOT_AVAILABLE_VALUE_CHECK;
    } else if (isAmbiguousOpeningBalance) {
      valueCheck = {
        status: "SKIPPED_AMBIGUOUS_OPENING_BALANCE",
        marketPriceJpy,
        expectedQuantity: null,
        expectedValueJpy: null,
        diffJpy: null,
        diffRatio: null,
      };
    } else {
      const expectedValueJpy = expectedQuantity!.times(marketPriceJpy);
      const diffJpy = balanceJpy.minus(expectedValueJpy);
      let diffRatio: Decimal | null = null;
      let status: AssetValueCheckStatus;
      if (expectedValueJpy.isZero()) {
        status = balanceJpy.isZero() ? "OK" : "LARGE_DEVIATION";
      } else {
        diffRatio = diffJpy.abs().dividedBy(expectedValueJpy.abs());
        status = diffRatio.lessThanOrEqualTo(VALUE_CHECK_TOLERANCE_RATIO)
          ? "OK"
          : "LARGE_DEVIATION";
      }
      valueCheck = { status, marketPriceJpy, expectedQuantity, expectedValueJpy, diffJpy, diffRatio };
    }

    results.push({
      institution,
      assetName,
      symbol,
      moneyForwardBalanceJpy: balanceJpy,
      hasAppTrades,
      status: !hasAppTrades && balanceJpy.greaterThan(0) ? "MISSING_APP_TRADES" : "OK",
      quantityCheck,
      valueCheck,
    });
  }

  return results.sort(
    (a, b) =>
      a.institution.localeCompare(b.institution, "ja") ||
      a.assetName.localeCompare(b.assetName, "ja"),
  );
}
