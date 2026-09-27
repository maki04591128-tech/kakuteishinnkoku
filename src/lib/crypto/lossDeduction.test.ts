import { describe, expect, it } from "vitest";
import { estimateCryptoLossDeduction } from "./lossDeduction";

describe("estimateCryptoLossDeduction", () => {
  it("盗難・横領に該当し生活用資産・事業用資産のいずれでもない場合は雑損控除の対象になる(時価あり)", () => {
    const result = estimateCryptoLossDeduction({
      acquisitionCostJpy: 500_000,
      fairValueAtLossJpy: 800_000,
      isBusinessAsset: false,
      bookValueJpy: null,
      isPersonalUseAsset: false,
      lossCause: "THEFT_OR_EMBEZZLEMENT",
    });
    expect(result.treatment).toBe("MISCELLANEOUS_LOSS_DEDUCTION");
    expect(result.casualtyLossAmountJpy?.toNumber()).toBe(800_000);
    expect(result.necessaryExpenseJpy).toBeNull();
  });

  it("消失時点の時価が不明な場合は取得価額を損失額とする", () => {
    const result = estimateCryptoLossDeduction({
      acquisitionCostJpy: 300_000,
      fairValueAtLossJpy: null,
      isBusinessAsset: false,
      bookValueJpy: null,
      isPersonalUseAsset: false,
      lossCause: "THEFT_OR_EMBEZZLEMENT",
    });
    expect(result.treatment).toBe("MISCELLANEOUS_LOSS_DEDUCTION");
    expect(result.casualtyLossAmountJpy?.toNumber()).toBe(300_000);
  });

  it("詐欺・恐喝による消失は雑損控除の対象外だが必要経費算入の対象になる(所得税法51条4項)", () => {
    const result = estimateCryptoLossDeduction({
      acquisitionCostJpy: 500_000,
      isBusinessAsset: false,
      bookValueJpy: null,
      isPersonalUseAsset: false,
      lossCause: "FRAUD_OR_EXTORTION",
    });
    expect(result.treatment).toBe("NECESSARY_EXPENSE");
    expect(result.necessaryExpenseJpy?.toNumber()).toBe(500_000);
    expect(result.casualtyLossAmountJpy).toBeNull();
  });

  it("詐欺・恐喝による必要経費算入額はその年分の雑所得の金額を限度に頭打ちする", () => {
    const result = estimateCryptoLossDeduction({
      acquisitionCostJpy: 1_000_000,
      isBusinessAsset: false,
      bookValueJpy: null,
      isPersonalUseAsset: false,
      lossCause: "FRAUD_OR_EXTORTION",
      otherMiscellaneousIncomeJpy: 300_000,
    });
    expect(result.treatment).toBe("NECESSARY_EXPENSE");
    expect(result.necessaryExpenseJpy?.toNumber()).toBe(300_000);
  });

  it("その年分の雑所得の金額が取得価額以上の場合は頭打ちされない", () => {
    const result = estimateCryptoLossDeduction({
      acquisitionCostJpy: 200_000,
      isBusinessAsset: false,
      bookValueJpy: null,
      isPersonalUseAsset: false,
      lossCause: "FRAUD_OR_EXTORTION",
      otherMiscellaneousIncomeJpy: 5_000_000,
    });
    expect(result.necessaryExpenseJpy?.toNumber()).toBe(200_000);
  });

  it("事業用資産等に該当する場合は原因を問わず帳簿価額を必要経費に算入する", () => {
    const result = estimateCryptoLossDeduction({
      acquisitionCostJpy: 400_000,
      fairValueAtLossJpy: 900_000,
      isBusinessAsset: true,
      bookValueJpy: 350_000,
      isPersonalUseAsset: false,
      lossCause: "FRAUD_OR_EXTORTION",
    });
    expect(result.treatment).toBe("NECESSARY_EXPENSE");
    expect(result.necessaryExpenseJpy?.toNumber()).toBe(350_000);
    expect(result.casualtyLossAmountJpy).toBeNull();
  });

  it("事業用資産等で帳簿価額が未入力の場合は取得価額をそのまま使う", () => {
    const result = estimateCryptoLossDeduction({
      acquisitionCostJpy: 400_000,
      isBusinessAsset: true,
      bookValueJpy: null,
      isPersonalUseAsset: false,
      lossCause: "THEFT_OR_EMBEZZLEMENT",
    });
    expect(result.necessaryExpenseJpy?.toNumber()).toBe(400_000);
  });

  it("生活に通常必要でない資産に該当する場合はいずれの対象にもならない", () => {
    const result = estimateCryptoLossDeduction({
      acquisitionCostJpy: 1_000_000,
      isBusinessAsset: false,
      bookValueJpy: null,
      isPersonalUseAsset: true,
      lossCause: "THEFT_OR_EMBEZZLEMENT",
    });
    expect(result.treatment).toBe("NOT_DEDUCTIBLE");
    expect(result.casualtyLossAmountJpy).toBeNull();
    expect(result.necessaryExpenseJpy).toBeNull();
  });

  it("原因が特定できない場合(単なる秘密鍵の紛失等)はいずれの対象にもならない", () => {
    const result = estimateCryptoLossDeduction({
      acquisitionCostJpy: 200_000,
      isBusinessAsset: false,
      bookValueJpy: null,
      isPersonalUseAsset: false,
      lossCause: "OTHER",
    });
    expect(result.treatment).toBe("NOT_DEDUCTIBLE");
  });

  it("事業用資産等の判定が生活に通常必要でない資産の判定より優先する", () => {
    const result = estimateCryptoLossDeduction({
      acquisitionCostJpy: 200_000,
      isBusinessAsset: true,
      bookValueJpy: 150_000,
      isPersonalUseAsset: true,
      lossCause: "THEFT_OR_EMBEZZLEMENT",
    });
    expect(result.treatment).toBe("NECESSARY_EXPENSE");
    expect(result.necessaryExpenseJpy?.toNumber()).toBe(150_000);
  });

  it("マイナスの取得価額はエラーを投げる", () => {
    expect(() =>
      estimateCryptoLossDeduction({
        acquisitionCostJpy: -1,
        isBusinessAsset: false,
        bookValueJpy: null,
        isPersonalUseAsset: false,
        lossCause: "THEFT_OR_EMBEZZLEMENT",
      }),
    ).toThrow();
  });

  it("マイナスの消失時点の時価はエラーを投げる", () => {
    expect(() =>
      estimateCryptoLossDeduction({
        acquisitionCostJpy: 100_000,
        fairValueAtLossJpy: -1,
        isBusinessAsset: false,
        bookValueJpy: null,
        isPersonalUseAsset: false,
        lossCause: "THEFT_OR_EMBEZZLEMENT",
      }),
    ).toThrow();
  });

  it("マイナスの雑所得の金額(頭打ち用)はエラーを投げる", () => {
    expect(() =>
      estimateCryptoLossDeduction({
        acquisitionCostJpy: 100_000,
        isBusinessAsset: false,
        bookValueJpy: null,
        isPersonalUseAsset: false,
        lossCause: "FRAUD_OR_EXTORTION",
        otherMiscellaneousIncomeJpy: -1,
      }),
    ).toThrow();
  });
});
