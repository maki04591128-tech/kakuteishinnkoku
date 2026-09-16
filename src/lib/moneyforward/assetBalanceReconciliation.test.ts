import { describe, expect, it } from "vitest";
import { reconcileAssetBalances } from "./assetBalanceReconciliation";

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
