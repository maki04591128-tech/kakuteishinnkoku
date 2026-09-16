import { describe, expect, it } from "vitest";
import { reconcileAssetBalances, reconcileAssetSymbolBalances } from "./assetBalanceReconciliation";

describe("reconcileAssetBalances", () => {
  it("両方に存在する金融機関はOKになる", () => {
    const results = reconcileAssetBalances(
      [{ institution: "bitFlyer", balanceJpy: 1_500_000 }],
      [{ institution: "bitFlyer" }],
    );

    expect(results).toHaveLength(1);
    expect(results[0].institution).toBe("bitFlyer");
    expect(results[0].moneyForwardBalanceJpy?.toNumber()).toBe(1_500_000);
    expect(results[0].hasAppTrades).toBe(true);
    expect(results[0].status).toBe("OK");
  });

  it("マネーフォワードに残高があるのにアプリ側に取引明細が無い場合はMISSING_APP_TRADES", () => {
    const results = reconcileAssetBalances(
      [{ institution: "GMOコイン", balanceJpy: 200_000 }],
      [{ institution: "bitFlyer" }],
    );

    const gmo = results.find((r) => r.institution === "GMOコイン");
    expect(gmo?.status).toBe("MISSING_APP_TRADES");
    expect(gmo?.hasAppTrades).toBe(false);
  });

  it("残高が0以下の金融機関は計上漏れとして扱わない", () => {
    const results = reconcileAssetBalances(
      [{ institution: "GMOコイン", balanceJpy: 0 }],
      [],
    );

    expect(results.find((r) => r.institution === "GMOコイン")?.status).toBe("OK");
  });

  it("アプリ側に取引明細があるのにマネーフォワードの資産残高に無い場合はMISSING_IN_MONEYFORWARD", () => {
    const results = reconcileAssetBalances(
      [{ institution: "bitFlyer", balanceJpy: 1_500_000 }],
      [{ institution: "bitFlyer" }, { institution: "Coincheck" }],
    );

    const coincheck = results.find((r) => r.institution === "Coincheck");
    expect(coincheck?.status).toBe("MISSING_IN_MONEYFORWARD");
    expect(coincheck?.moneyForwardBalanceJpy).toBeNull();
  });

  it("同一金融機関の複数行は残高を合算してから判定する", () => {
    const results = reconcileAssetBalances(
      [
        { institution: "SBI証券", balanceJpy: 100_000 },
        { institution: "SBI証券", balanceJpy: 200_000 },
      ],
      [{ institution: "SBI証券" }],
    );

    const sbi = results.find((r) => r.institution === "SBI証券");
    expect(sbi?.moneyForwardBalanceJpy?.toNumber()).toBe(300_000);
    expect(sbi?.status).toBe("OK");
  });

  it("institutionの前後空白は正規化して同一視する", () => {
    const results = reconcileAssetBalances(
      [{ institution: " bitFlyer ", balanceJpy: 100 }],
      [{ institution: "bitFlyer" }],
    );

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("OK");
  });

  it("institutionが空文字・nullの行は無視する", () => {
    const results = reconcileAssetBalances(
      [{ institution: "", balanceJpy: 100 }],
      [{ institution: null }, { institution: undefined }],
    );

    expect(results).toEqual([]);
  });
});

describe("reconcileAssetSymbolBalances", () => {
  it("マッピング済みで金融機関×銘柄の取引明細がある場合はOK", () => {
    const results = reconcileAssetSymbolBalances(
      [{ institution: "bitFlyer", assetName: "ビットコイン", balanceJpy: 1_500_000 }],
      [{ assetName: "ビットコイン", symbol: "BTC" }],
      [{ institution: "bitFlyer", symbol: "BTC" }],
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      institution: "bitFlyer",
      assetName: "ビットコイン",
      symbol: "BTC",
      hasAppTrades: true,
      status: "OK",
    });
  });

  it("マッピング済みだが同じ金融機関に該当銘柄の取引明細が無い場合はMISSING_APP_TRADES", () => {
    const results = reconcileAssetSymbolBalances(
      [{ institution: "SBI証券", assetName: "ビットコイン", balanceJpy: 500_000 }],
      [{ assetName: "ビットコイン", symbol: "BTC" }],
      [{ institution: "SBI証券", symbol: "ETH" }],
    );

    expect(results[0].status).toBe("MISSING_APP_TRADES");
    expect(results[0].hasAppTrades).toBe(false);
  });

  it("同じ銘柄でも金融機関が違えば取引明細ありとは判定しない", () => {
    const results = reconcileAssetSymbolBalances(
      [{ institution: "SBI証券", assetName: "ビットコイン", balanceJpy: 500_000 }],
      [{ assetName: "ビットコイン", symbol: "BTC" }],
      [{ institution: "bitFlyer", symbol: "BTC" }],
    );

    expect(results[0].status).toBe("MISSING_APP_TRADES");
  });

  it("マッピングが無い資産名はUNMAPPEDになる", () => {
    const results = reconcileAssetSymbolBalances(
      [{ institution: "楽天証券", assetName: "全世界株式ファンド", balanceJpy: 100_000 }],
      [],
      [],
    );

    expect(results[0].status).toBe("UNMAPPED");
    expect(results[0].symbol).toBeNull();
  });

  it("残高が0以下の場合はマッピング済みでも計上漏れとして扱わない", () => {
    const results = reconcileAssetSymbolBalances(
      [{ institution: "bitFlyer", assetName: "ビットコイン", balanceJpy: 0 }],
      [{ assetName: "ビットコイン", symbol: "BTC" }],
      [],
    );

    expect(results[0].status).toBe("OK");
  });

  it("同一金融機関×資産名の複数行は残高を合算する", () => {
    const results = reconcileAssetSymbolBalances(
      [
        { institution: "bitFlyer", assetName: "ビットコイン", balanceJpy: 100_000 },
        { institution: "bitFlyer", assetName: "ビットコイン", balanceJpy: 200_000 },
      ],
      [{ assetName: "ビットコイン", symbol: "BTC" }],
      [{ institution: "bitFlyer", symbol: "BTC" }],
    );

    expect(results).toHaveLength(1);
    expect(results[0].moneyForwardBalanceJpy.toNumber()).toBe(300_000);
  });

  it("symbolの大文字小文字は正規化して同一視する", () => {
    const results = reconcileAssetSymbolBalances(
      [{ institution: "bitFlyer", assetName: "ビットコイン", balanceJpy: 100 }],
      [{ assetName: "ビットコイン", symbol: "btc" }],
      [{ institution: "bitFlyer", symbol: "BTC" }],
    );

    expect(results[0].status).toBe("OK");
  });

  it("数量列が無い場合はquantityCheck.statusがNOT_AVAILABLEになる", () => {
    const results = reconcileAssetSymbolBalances(
      [{ institution: "bitFlyer", assetName: "ビットコイン", balanceJpy: 1_500_000 }],
      [{ assetName: "ビットコイン", symbol: "BTC" }],
      [{ institution: "bitFlyer", symbol: "BTC", quantityDelta: 0.1 }],
    );

    expect(results[0].quantityCheck).toMatchObject({
      status: "NOT_AVAILABLE",
      snapshotQuantity: null,
      expectedQuantity: null,
    });
  });

  it("未マッピングの資産名はquantityCheck.statusがNOT_AVAILABLEになる", () => {
    const results = reconcileAssetSymbolBalances(
      [
        {
          institution: "楽天証券",
          assetName: "全世界株式ファンド",
          balanceJpy: 100_000,
          quantity: 10,
        },
      ],
      [],
      [],
    );

    expect(results[0].quantityCheck.status).toBe("NOT_AVAILABLE");
  });

  it("期首残高+当年増減がマネーフォワードの数量と一致すればOK", () => {
    const results = reconcileAssetSymbolBalances(
      [{ institution: "bitFlyer", assetName: "ビットコイン", balanceJpy: 1_500_000, quantity: 0.3 }],
      [{ assetName: "ビットコイン", symbol: "BTC" }],
      [{ institution: "bitFlyer", symbol: "BTC", quantityDelta: 0.1 }],
      [{ symbol: "BTC", quantity: 0.2 }],
    );

    expect(results[0].quantityCheck).toMatchObject({ status: "OK" });
    expect(results[0].quantityCheck.expectedQuantity?.toNumber()).toBe(0.3);
  });

  it("数量が一致しない場合はMISMATCHになる", () => {
    const results = reconcileAssetSymbolBalances(
      [{ institution: "bitFlyer", assetName: "ビットコイン", balanceJpy: 1_500_000, quantity: 0.5 }],
      [{ assetName: "ビットコイン", symbol: "BTC" }],
      [{ institution: "bitFlyer", symbol: "BTC", quantityDelta: 0.1 }],
    );

    expect(results[0].quantityCheck.status).toBe("MISMATCH");
    expect(results[0].quantityCheck.diff?.toNumber()).toBe(0.4);
  });

  it("期首残高があり複数金融機関にまたがる銘柄は数量突合を見送る", () => {
    const results = reconcileAssetSymbolBalances(
      [{ institution: "bitFlyer", assetName: "ビットコイン", balanceJpy: 1_500_000, quantity: 0.3 }],
      [{ assetName: "ビットコイン", symbol: "BTC" }],
      [
        { institution: "bitFlyer", symbol: "BTC", quantityDelta: 0.1 },
        { institution: "Coincheck", symbol: "BTC", quantityDelta: 0.05 },
      ],
      [{ symbol: "BTC", quantity: 0.2 }],
    );

    expect(results[0].quantityCheck).toMatchObject({
      status: "SKIPPED_AMBIGUOUS_OPENING_BALANCE",
      expectedQuantity: null,
    });
  });

  it("期首残高が0なら複数金融機関にまたがっていても当年増減だけで突合できる", () => {
    const results = reconcileAssetSymbolBalances(
      [{ institution: "bitFlyer", assetName: "ビットコイン", balanceJpy: 1_500_000, quantity: 0.1 }],
      [{ assetName: "ビットコイン", symbol: "BTC" }],
      [
        { institution: "bitFlyer", symbol: "BTC", quantityDelta: 0.1 },
        { institution: "Coincheck", symbol: "BTC", quantityDelta: 0.05 },
      ],
    );

    expect(results[0].quantityCheck).toMatchObject({ status: "OK" });
  });

  it("金融機関別の期首残高(OpeningBalanceByInstitution)を登録した金融機関は複数金融機関にまたがっていても数量突合できる", () => {
    const results = reconcileAssetSymbolBalances(
      [
        { institution: "bitFlyer", assetName: "ビットコイン", balanceJpy: 1_500_000, quantity: 0.3 },
        { institution: "Coincheck", assetName: "ビットコイン", balanceJpy: 750_000, quantity: 0.15 },
      ],
      [{ assetName: "ビットコイン", symbol: "BTC" }],
      [
        { institution: "bitFlyer", symbol: "BTC", quantityDelta: 0.1 },
        { institution: "Coincheck", symbol: "BTC", quantityDelta: 0.05 },
      ],
      [
        { symbol: "BTC", quantity: 0.2, institution: "bitFlyer" },
        { symbol: "BTC", quantity: 0.1, institution: "Coincheck" },
      ],
    );

    const bitflyer = results.find((r) => r.institution === "bitFlyer");
    const coincheck = results.find((r) => r.institution === "Coincheck");
    expect(bitflyer?.quantityCheck).toMatchObject({ status: "OK" });
    expect(bitflyer?.quantityCheck.expectedQuantity?.toNumber()).toBe(0.3);
    expect(coincheck?.quantityCheck).toMatchObject({ status: "OK" });
    expect(coincheck?.quantityCheck.expectedQuantity?.toNumber()).toBe(0.15);
  });

  it("金融機関別の期首残高が未登録の金融機関は他の金融機関に登録があっても判定不能のまま", () => {
    const results = reconcileAssetSymbolBalances(
      [
        { institution: "bitFlyer", assetName: "ビットコイン", balanceJpy: 1_500_000, quantity: 0.3 },
        { institution: "Coincheck", assetName: "ビットコイン", balanceJpy: 750_000, quantity: 0.2 },
      ],
      [{ assetName: "ビットコイン", symbol: "BTC" }],
      [
        { institution: "bitFlyer", symbol: "BTC", quantityDelta: 0.1 },
        { institution: "Coincheck", symbol: "BTC", quantityDelta: 0.05 },
      ],
      [
        { symbol: "BTC", quantity: 0.1 },
        { symbol: "BTC", quantity: 0.2, institution: "bitFlyer" },
      ],
    );

    const bitflyer = results.find((r) => r.institution === "bitFlyer");
    const coincheck = results.find((r) => r.institution === "Coincheck");
    expect(bitflyer?.quantityCheck).toMatchObject({ status: "OK" });
    expect(coincheck?.quantityCheck).toMatchObject({
      status: "SKIPPED_AMBIGUOUS_OPENING_BALANCE",
    });
  });
});
