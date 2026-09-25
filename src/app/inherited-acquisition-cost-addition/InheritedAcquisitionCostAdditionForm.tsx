"use client";

import { useId, useMemo, useRef, useState } from "react";
import {
  estimateInheritedAcquisitionCostAddition,
  type InheritedTransferInput,
} from "@/lib/investment/inheritedAcquisitionCostAddition";

function yen(value: { toString(): string }): string {
  const n = Number(value.toString());
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

interface TransferRow {
  key: string;
  label: string;
  inheritedValuation: string;
  transferGain: string;
  withinDeadline: boolean;
}

function newTransferRow(key: string): TransferRow {
  return { key, label: "", inheritedValuation: "0", transferGain: "0", withinDeadline: true };
}

export function InheritedAcquisitionCostAdditionForm() {
  const idPrefix = useId();
  const nextRowIdRef = useRef(0);

  const [inheritanceTax, setInheritanceTax] = useState("0");
  const [taxableBase, setTaxableBase] = useState("0");
  const [transfers, setTransfers] = useState<TransferRow[]>([]);

  const result = useMemo(() => {
    try {
      const transferInputs: InheritedTransferInput[] = transfers.map((row) => ({
        label: row.label,
        inheritedValuationJpy: row.inheritedValuation || 0,
        transferGainJpy: row.transferGain || 0,
        withinDeadline: row.withinDeadline,
      }));
      return estimateInheritedAcquisitionCostAddition({
        inheritanceTaxJpy: inheritanceTax || 0,
        taxableBaseJpy: taxableBase || 0,
        transfers: transferInputs,
      });
    } catch {
      return null;
    }
  }, [inheritanceTax, taxableBase, transfers]);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">その者(相続人)の相続税額</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={inheritanceTax}
            onChange={(e) => setInheritanceTax(e.target.value)}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">
            相続税の課税価格(取得財産の価額+相続時精算課税適用財産の価額+暦年課税分の贈与財産の価額。債務控除前)
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={taxableBase}
            onChange={(e) => setTaxableBase(e.target.value)}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">譲渡した相続財産</h2>
        {transfers.length === 0 && (
          <p className="text-sm text-neutral-500">
            「譲渡財産を追加」で、譲渡した相続財産ごとに入力欄を追加できる。
          </p>
        )}
        {transfers.map((row, index) => (
          <fieldset
            key={row.key}
            className="grid grid-cols-1 gap-3 rounded-md border border-neutral-200 p-3 sm:grid-cols-5 dark:border-neutral-800"
          >
            <legend className="px-1 text-sm font-medium">譲渡財産 {index + 1}</legend>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">名称(任意)</span>
              <input
                type="text"
                value={row.label}
                placeholder={`譲渡財産${index + 1}`}
                onChange={(e) =>
                  setTransfers((prev) =>
                    prev.map((r) => (r.key === row.key ? { ...r, label: e.target.value } : r)),
                  )
                }
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">その財産の相続税評価額</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={row.inheritedValuation}
                onChange={(e) =>
                  setTransfers((prev) =>
                    prev.map((r) =>
                      r.key === row.key ? { ...r, inheritedValuation: e.target.value } : r,
                    ),
                  )
                }
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">その譲渡による譲渡益(譲渡損失はマイナス)</span>
              <input
                type="number"
                inputMode="numeric"
                step={1}
                value={row.transferGain}
                onChange={(e) =>
                  setTransfers((prev) =>
                    prev.map((r) =>
                      r.key === row.key ? { ...r, transferGain: e.target.value } : r,
                    ),
                  )
                }
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
            <label className="flex items-center gap-2 self-end text-sm">
              <input
                type="checkbox"
                checked={row.withinDeadline}
                onChange={(e) =>
                  setTransfers((prev) =>
                    prev.map((r) =>
                      r.key === row.key ? { ...r, withinDeadline: e.target.checked } : r,
                    ),
                  )
                }
              />
              <span>適用期限内(相続開始翌日から申告期限翌日以後3年を経過する日まで)</span>
            </label>
            <button
              type="button"
              onClick={() => setTransfers((prev) => prev.filter((r) => r.key !== row.key))}
              className="self-end rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-red-600 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
            >
              削除
            </button>
          </fieldset>
        ))}
        <button
          type="button"
          onClick={() => {
            const key = `${idPrefix}-${nextRowIdRef.current}`;
            nextRowIdRef.current += 1;
            setTransfers((prev) => [...prev, newTransferRow(key)]);
          }}
          className="self-start rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          譲渡財産を追加
        </button>
      </div>

      {result === null ? (
        <p className="text-sm text-red-600">
          入力値を確認してください(0以上の数値、かつ各財産の相続税評価額は相続税の課税価格以下)。
        </p>
      ) : (
        <>
          {result.transfers.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 text-left text-neutral-500 dark:border-neutral-800">
                    <th className="py-2 pr-4">財産</th>
                    <th className="py-2 pr-4">按分計算額</th>
                    <th className="py-2 pr-4">取得費加算額</th>
                    <th className="py-2 pr-4">上限適用</th>
                  </tr>
                </thead>
                <tbody>
                  {result.transfers.map((t, i) => (
                    <tr key={i} className="border-b border-neutral-100 dark:border-neutral-900">
                      <td className="py-2 pr-4">{t.label}</td>
                      <td className="py-2 pr-4">{yen(t.proportionalAdditionJpy)}</td>
                      <td className="py-2 pr-4 font-semibold">{yen(t.additionJpy)}</td>
                      <td className="py-2 pr-4 text-neutral-500">
                        {!t.withinDeadline
                          ? "適用期限外"
                          : t.cappedByGain
                            ? "譲渡益で上限"
                            : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="rounded-lg border border-neutral-900 p-4 dark:border-white">
            <p className="text-sm text-neutral-500">取得費加算額の合計</p>
            <p className="mt-1 text-3xl font-semibold">{yen(result.totalAdditionJpy)}</p>
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
