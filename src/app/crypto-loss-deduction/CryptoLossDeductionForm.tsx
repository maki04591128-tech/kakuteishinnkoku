"use client";

import { useId, useMemo, useState } from "react";
import {
  estimateCryptoLossDeduction,
  type CryptoLossCause,
  type CryptoLossTreatment,
} from "@/lib/crypto/lossDeduction";

function yen(value: { toString(): string }): string {
  const n = Number(value.toString());
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

const TREATMENT_LABEL: Record<CryptoLossTreatment, string> = {
  MISCELLANEOUS_LOSS_DEDUCTION: "雑損控除の対象",
  NECESSARY_EXPENSE: "必要経費算入の対象",
  NOT_DEDUCTIBLE: "いずれの対象にもならない",
};

const LOSS_CAUSE_LABEL: Record<CryptoLossCause, string> = {
  THEFT_OR_EMBEZZLEMENT: "盗難・横領(不正な送出等)",
  FRAUD_OR_EXTORTION: "詐欺・恐喝(投資詐欺等でだまし取られた)",
  OTHER: "特定できない(単なる秘密鍵の紛失等)",
};

export function CryptoLossDeductionForm() {
  const idPrefix = useId();
  const [acquisitionCost, setAcquisitionCost] = useState("0");
  const [fairValueAtLossInput, setFairValueAtLossInput] = useState("");
  const [isBusinessAsset, setIsBusinessAsset] = useState(false);
  const [bookValueInput, setBookValueInput] = useState("");
  const [isPersonalUseAsset, setIsPersonalUseAsset] = useState(false);
  const [lossCause, setLossCause] = useState<CryptoLossCause>("THEFT_OR_EMBEZZLEMENT");
  const [otherMiscIncomeInput, setOtherMiscIncomeInput] = useState("");

  const result = useMemo(() => {
    try {
      return estimateCryptoLossDeduction({
        acquisitionCostJpy: acquisitionCost || 0,
        fairValueAtLossJpy: fairValueAtLossInput === "" ? null : fairValueAtLossInput,
        isBusinessAsset,
        bookValueJpy: bookValueInput === "" ? null : bookValueInput,
        isPersonalUseAsset,
        lossCause,
        otherMiscellaneousIncomeJpy: otherMiscIncomeInput === "" ? null : otherMiscIncomeInput,
      });
    } catch {
      return null;
    }
  }, [
    acquisitionCost,
    fairValueAtLossInput,
    isBusinessAsset,
    bookValueInput,
    isPersonalUseAsset,
    lossCause,
    otherMiscIncomeInput,
  ]);

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="grid grid-cols-1 gap-3 rounded-md border border-neutral-200 p-3 sm:grid-cols-2 lg:grid-cols-3 dark:border-neutral-800">
        <legend className="px-1 text-sm font-medium">消失した暗号資産</legend>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">取得価額(取得費)</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={acquisitionCost}
            onChange={(e) => setAcquisitionCost(e.target.value)}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">消失時点の時価(不明な場合は未入力)</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={fairValueAtLossInput}
            onChange={(e) => setFairValueAtLossInput(e.target.value)}
            placeholder="不明な場合は取得価額を使用"
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">
            事業用資産等に該当する場合の帳簿価額(未入力の場合は取得価額を使用)
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={bookValueInput}
            onChange={(e) => setBookValueInput(e.target.value)}
            disabled={!isBusinessAsset}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">
            詐欺・恐喝の場合の頭打ち用: この損失計算前のその年分の雑所得の金額(不明な場合は未入力)
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={otherMiscIncomeInput}
            onChange={(e) => setOtherMiscIncomeInput(e.target.value)}
            disabled={lossCause !== "FRAUD_OR_EXTORTION"}
            placeholder="未入力の場合は頭打ちをしない"
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">消失の原因</span>
          <select
            value={lossCause}
            onChange={(e) => setLossCause(e.target.value as CryptoLossCause)}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
          >
            {(Object.keys(LOSS_CAUSE_LABEL) as CryptoLossCause[]).map((cause) => (
              <option key={cause} value={cause}>
                {LOSS_CAUSE_LABEL[cause]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            id={`${idPrefix}-business`}
            type="checkbox"
            checked={isBusinessAsset}
            onChange={(e) => setIsBusinessAsset(e.target.checked)}
          />
          <span className="text-neutral-500">
            事業用資産等(棚卸資産又は業務の用に供される資産)に該当する
          </span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            id={`${idPrefix}-personal`}
            type="checkbox"
            checked={isPersonalUseAsset}
            onChange={(e) => setIsPersonalUseAsset(e.target.checked)}
            disabled={isBusinessAsset}
          />
          <span className="text-neutral-500">
            生活に通常必要でない資産(施行令178条)に該当する(通常の投資目的では想定しにくい)
          </span>
        </label>
      </fieldset>

      {result === null ? (
        <p className="text-sm text-red-600">入力値を確認してください(すべて0以上の数値)。</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-neutral-900 p-4 dark:border-white sm:col-span-3">
              <p className="text-sm text-neutral-500">取扱い</p>
              <p className="mt-1 text-2xl font-semibold">{TREATMENT_LABEL[result.treatment]}</p>
            </div>
            {result.treatment === "MISCELLANEOUS_LOSS_DEDUCTION" && (
              <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
                <p className="text-sm text-neutral-500">雑損控除の損害金額に入力する損失額</p>
                <p className="mt-1 text-2xl font-semibold">
                  {yen(result.casualtyLossAmountJpy!)}
                </p>
              </div>
            )}
            {result.treatment === "NECESSARY_EXPENSE" && (
              <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
                <p className="text-sm text-neutral-500">必要経費に算入する金額</p>
                <p className="mt-1 text-2xl font-semibold">
                  {yen(result.necessaryExpenseJpy!)}
                </p>
              </div>
            )}
          </div>

          <ul className="list-disc space-y-1 pl-5 text-xs text-neutral-500">
            {result.notes.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
