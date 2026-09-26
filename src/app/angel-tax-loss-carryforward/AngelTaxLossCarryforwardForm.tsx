"use client";

import { useId, useMemo, useState } from "react";
import {
  calculateAngelTaxCurrentYearOffset,
  calculateAngelTaxDeemedTransferLoss,
  calculateAngelTaxLossCarryforward,
  type AngelTaxWorthlessEvent,
} from "@/lib/investment/angelTaxLossCarryforward";

function yen(value: { toString(): string }): string {
  const n = Number(value.toString());
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

const inputClass =
  "rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900";

export function AngelTaxLossCarryforwardForm({
  year,
  carryforwardEntries,
}: {
  year: number;
  /** 年初時点で残っている繰越損失の残高(発生年ごと) */
  carryforwardEntries: { originYear: number; remainingAmountJpy: string }[];
}) {
  const idPrefix = useId();

  // No.1531: 価値喪失時のみなし譲渡損失の計算補助
  const [worthlessEvent, setWorthlessEvent] = useState<AngelTaxWorthlessEvent>("BANKRUPTCY");
  const [worthlessAcquisitionCost, setWorthlessAcquisitionCost] = useState("0");
  const deemedLossResult = useMemo(() => {
    try {
      return calculateAngelTaxDeemedTransferLoss({
        event: worthlessEvent,
        acquisitionCostJpy: worthlessAcquisitionCost || 0,
      });
    } catch {
      return null;
    }
  }, [worthlessEvent, worthlessAcquisitionCost]);

  // No.1532: 当年分の控除計算
  const [specificStockLoss, setSpecificStockLoss] = useState("0");
  const [generalStockNetGain, setGeneralStockNetGain] = useState("0");
  const [listedStockCapitalGain, setListedStockCapitalGain] = useState("0");

  const offsetResult = useMemo(() => {
    try {
      return calculateAngelTaxCurrentYearOffset({
        specificStockLossJpy: specificStockLoss || 0,
        generalStockNetGainJpy: generalStockNetGain || 0,
        listedStockCapitalGainJpy: listedStockCapitalGain || 0,
      });
    } catch {
      return null;
    }
  }, [specificStockLoss, generalStockNetGain, listedStockCapitalGain]);

  // No.1533: 繰越控除(前年以前の残高を、この年のNo.1532適用後の余力に適用)
  const carryforwardResult = useMemo(() => {
    if (offsetResult === null) return null;
    try {
      return calculateAngelTaxLossCarryforward(
        year,
        offsetResult.generalStockTaxableGainJpy,
        offsetResult.listedStockCapitalGainAfterJpy,
        offsetResult.newLossForCarryforwardJpy,
        carryforwardEntries,
      );
    } catch {
      return null;
    }
  }, [offsetResult, year, carryforwardEntries]);

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
        <legend className="px-1 text-sm font-medium">
          株式としての価値を失った場合のみなし譲渡損失(No.1531、任意)
        </legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-neutral-500">価値を失った事由</span>
            <select
              value={worthlessEvent}
              onChange={(e) => setWorthlessEvent(e.target.value as AngelTaxWorthlessEvent)}
              className={inputClass}
            >
              <option value="BANKRUPTCY">発行会社の破産手続開始の決定</option>
              <option value="DISSOLUTION">発行会社の解散(清算結了)</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-neutral-500">その特定株式の取得価額(円)</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={worthlessAcquisitionCost}
              onChange={(e) => setWorthlessAcquisitionCost(e.target.value)}
              className={inputClass}
            />
          </label>
          <div className="flex flex-col justify-end gap-1 text-sm">
            {deemedLossResult && (
              <button
                type="button"
                onClick={() =>
                  setSpecificStockLoss((prev) =>
                    (Number(prev || 0) + Number(deemedLossResult.deemedTransferLossJpy)).toString(),
                  )
                }
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
              >
                みなし譲渡損失({deemedLossResult && yen(deemedLossResult.deemedTransferLossJpy)})を
                下の「特定株式に係る譲渡損失の金額」に加算する
              </button>
            )}
          </div>
        </div>
      </fieldset>

      <fieldset className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
        <legend className="px-1 text-sm font-medium">
          当年分の損益通算(No.1532)
        </legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-neutral-500">
              その年中の特定株式に係る譲渡損失の金額(みなし譲渡損失を含む合計)
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              id={`${idPrefix}-specific-loss`}
              value={specificStockLoss}
              onChange={(e) => setSpecificStockLoss(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-neutral-500">
              特定株式分を含めて計算した、一般株式等に係る譲渡所得等の金額(赤字は負値)
            </span>
            <input
              type="number"
              inputMode="numeric"
              value={generalStockNetGain}
              onChange={(e) => setGeneralStockNetGain(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-neutral-500">
              適用前の、上場株式等に係る譲渡所得等の金額
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={listedStockCapitalGain}
              onChange={(e) => setListedStockCapitalGain(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>
      </fieldset>

      {offsetResult && carryforwardResult && (
        <div className="rounded-md bg-neutral-50 p-4 text-sm dark:bg-neutral-900">
          <p className="font-medium">{year}年分の試算結果</p>
          <p className="mt-2">
            一般株式等に係る譲渡所得等の金額(赤字は0円):{" "}
            {yen(offsetResult.generalStockTaxableGainJpy)}
          </p>
          <p>
            特定株式の損失のうち一般株式等で控除しきれなかった額:{" "}
            {yen(offsetResult.unabsorbedSpecificStockLossJpy)}
          </p>
          <p>
            うち当年の上場株式等に係る譲渡所得等の金額から控除した額:{" "}
            {yen(offsetResult.usedAgainstListedStockJpy)}
          </p>

          <p className="mt-3 font-medium">繰越控除(No.1533)適用後</p>
          <p>
            前年以前の繰越損失の使用額(一般株式等):{" "}
            {yen(carryforwardResult.totalUsedAgainstGeneralStockJpy)}
          </p>
          <p>
            前年以前の繰越損失の使用額(上場株式等):{" "}
            {yen(carryforwardResult.totalUsedAgainstListedStockJpy)}
          </p>
          <p>
            控除後の一般株式等に係る譲渡所得等の金額:{" "}
            {yen(carryforwardResult.generalStockTaxableGainAfterCarryforwardJpy)}
          </p>
          <p>
            控除後の上場株式等に係る譲渡所得等の金額:{" "}
            {yen(carryforwardResult.listedStockCapitalGainAfterCarryforwardJpy)}
          </p>

          {carryforwardResult.carryforwardToNextYear.length > 0 && (
            <p className="mt-2">
              {year + 1}年分以後へ繰り越す損失:{" "}
              {carryforwardResult.carryforwardToNextYear
                .map((c) => `${c.originYear}年分 ${yen(c.remainingAmountJpy)}`)
                .join(" / ")}
              (下の「繰越控除の残高」から{year + 1}年分として登録すること)
            </p>
          )}
          {carryforwardResult.expiredByOriginYear.length > 0 && (
            <p className="mt-2 text-red-600">
              控除期限切れで繰り越せなかった損失があります:{" "}
              {carryforwardResult.expiredByOriginYear
                .map((e) => `${e.originYear}年分 ${yen(e.expiredAmountJpy)}`)
                .join(" / ")}
            </p>
          )}

          {[...offsetResult.notes, ...carryforwardResult.notes].map((note, i) => (
            <p key={i} className="mt-2 text-xs text-neutral-500">
              {note}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
