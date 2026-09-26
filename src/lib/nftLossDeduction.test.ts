import { describe, expect, it } from "vitest";
import { estimateNftLossDeduction } from "./nftLossDeduction";

describe("estimateNftLossDeduction", () => {
  it("盗難等に該当し生活用資産・事業用資産のいずれでもない場合は雑損控除の対象になる(時価あり)", () => {
    const result = estimateNftLossDeduction({
      acquisitionCostJpy: 500_000,
      fairValueAtLossJpy: 800_000,
      isBusinessAsset: false,
      bookValueJpy: null,
      isPersonalUseAsset: false,
      isTheft: true,
    });
    expect(result.treatment).toBe("MISCELLANEOUS_LOSS_DEDUCTION");
    expect(result.casualtyLossAmountJpy?.toNumber()).toBe(800_000);
    expect(result.necessaryExpenseJpy).toBeNull();
  });

  it("消失時点の時価が不明な場合は取得価額を損失額とする(FAQ問5注3)", () => {
    const result = estimateNftLossDeduction({
      acquisitionCostJpy: 300_000,
      fairValueAtLossJpy: null,
      isBusinessAsset: false,
      bookValueJpy: null,
      isPersonalUseAsset: false,
      isTheft: true,
    });
    expect(result.treatment).toBe("MISCELLANEOUS_LOSS_DEDUCTION");
    expect(result.casualtyLossAmountJpy?.toNumber()).toBe(300_000);
  });

  it("事業用資産等に該当する場合は帳簿価額を必要経費に算入する", () => {
    const result = estimateNftLossDeduction({
      acquisitionCostJpy: 400_000,
      fairValueAtLossJpy: 900_000,
      isBusinessAsset: true,
      bookValueJpy: 350_000,
      isPersonalUseAsset: false,
      isTheft: true,
    });
    expect(result.treatment).toBe("NECESSARY_EXPENSE");
    expect(result.necessaryExpenseJpy?.toNumber()).toBe(350_000);
    expect(result.casualtyLossAmountJpy).toBeNull();
  });

  it("事業用資産等で帳簿価額が未入力の場合は取得価額をそのまま使う", () => {
    const result = estimateNftLossDeduction({
      acquisitionCostJpy: 400_000,
      isBusinessAsset: true,
      bookValueJpy: null,
      isPersonalUseAsset: false,
      isTheft: true,
    });
    expect(result.necessaryExpenseJpy?.toNumber()).toBe(400_000);
  });

  it("生活に通常必要でない資産に該当する場合はいずれの対象にもならない", () => {
    const result = estimateNftLossDeduction({
      acquisitionCostJpy: 1_000_000,
      isBusinessAsset: false,
      bookValueJpy: null,
      isPersonalUseAsset: true,
      isTheft: true,
    });
    expect(result.treatment).toBe("NOT_DEDUCTIBLE");
    expect(result.casualtyLossAmountJpy).toBeNull();
    expect(result.necessaryExpenseJpy).toBeNull();
  });

  it("盗難等に該当しない場合(詐欺・恐喝等)はいずれの対象にもならない", () => {
    const result = estimateNftLossDeduction({
      acquisitionCostJpy: 200_000,
      isBusinessAsset: false,
      bookValueJpy: null,
      isPersonalUseAsset: false,
      isTheft: false,
    });
    expect(result.treatment).toBe("NOT_DEDUCTIBLE");
  });

  it("事業用資産等の判定が生活に通常必要でない資産の判定より優先する", () => {
    const result = estimateNftLossDeduction({
      acquisitionCostJpy: 200_000,
      isBusinessAsset: true,
      bookValueJpy: 150_000,
      isPersonalUseAsset: true,
      isTheft: true,
    });
    expect(result.treatment).toBe("NECESSARY_EXPENSE");
    expect(result.necessaryExpenseJpy?.toNumber()).toBe(150_000);
  });

  it("マイナスの取得価額はエラーを投げる", () => {
    expect(() =>
      estimateNftLossDeduction({
        acquisitionCostJpy: -1,
        isBusinessAsset: false,
        bookValueJpy: null,
        isPersonalUseAsset: false,
        isTheft: true,
      }),
    ).toThrow();
  });

  it("マイナスの消失時点の時価はエラーを投げる", () => {
    expect(() =>
      estimateNftLossDeduction({
        acquisitionCostJpy: 100_000,
        fairValueAtLossJpy: -1,
        isBusinessAsset: false,
        bookValueJpy: null,
        isPersonalUseAsset: false,
        isTheft: true,
      }),
    ).toThrow();
  });
});
