"use client";

import { useId, useMemo, useRef, useState } from "react";
import {
  classifyInvestmentTrustDistributions,
  type InvestmentTrustTimelineEvent,
} from "@/lib/investment/distributionClassification";

function yen(value: { toString(): string }): string {
  const n = Number(value.toString());
  return `¥${n.toLocaleString("ja-JP", { maximumFractionDigits: 2 })}`;
}

type EventRowType = "DISTRIBUTION" | "PURCHASE" | "REDEMPTION";

interface EventRow {
  key: string;
  type: EventRowType;
  label: string;
  /** DISTRIBUTIONの分配金額 / PURCHASEの購入口数 / REDEMPTIONの解約口数 */
  distribution: string;
  /** DISTRIBUTIONの分配落ち後基準価額 / PURCHASEの購入時基準価額 */
  postNav: string;
}

function newEventRow(key: string, index: number): EventRow {
  return {
    key,
    type: "DISTRIBUTION",
    label: `第${index}回`,
    distribution: "0",
    postNav: "0",
  };
}

export function InvestmentTrustDistributionForm() {
  const idPrefix = useId();
  const [openingPrincipal, setOpeningPrincipal] = useState("10000");
  const [holdingUnits, setHoldingUnits] = useState("10000");
  const [events, setEvents] = useState<EventRow[]>([newEventRow("initial", 1)]);
  const nextRowIdRef = useRef(0);

  const result = useMemo(() => {
    try {
      return classifyInvestmentTrustDistributions(
        openingPrincipal || 0,
        Number(holdingUnits || 0),
        events.map((row): InvestmentTrustTimelineEvent => {
          if (row.type === "PURCHASE") {
            return {
              type: "PURCHASE",
              label: row.label,
              units: Number(row.distribution || 0),
              pricePer10kUnitsJpy: row.postNav || 0,
            };
          }
          if (row.type === "REDEMPTION") {
            return {
              type: "REDEMPTION",
              label: row.label,
              units: Number(row.distribution || 0),
            };
          }
          return {
            label: row.label,
            distributionPer10kUnitsJpy: row.distribution || 0,
            postDistributionNavPer10kUnitsJpy: row.postNav || 0,
          };
        }),
      );
    } catch {
      return null;
    }
  }, [openingPrincipal, holdingUnits, events]);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">分配前個別元本(1万口当たり)</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            value={openingPrincipal}
            onChange={(e) => setOpeningPrincipal(e.target.value)}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">保有口数</span>
          <input
            type="number"
            inputMode="decimal"
            min={1}
            value={holdingUnits}
            onChange={(e) => setHoldingUnits(e.target.value)}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>
      </div>

      <div className="flex flex-col gap-3">
        {events.map((row, index) => (
          <fieldset
            key={row.key}
            className="grid grid-cols-1 gap-3 rounded-md border border-neutral-200 p-3 sm:grid-cols-5 dark:border-neutral-800"
          >
            <legend className="px-1 text-sm font-medium">イベント {index + 1}</legend>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">種別</span>
              <select
                value={row.type}
                onChange={(e) =>
                  setEvents((prev) =>
                    prev.map((r) =>
                      r.key === row.key ? { ...r, type: e.target.value as EventRowType } : r,
                    ),
                  )
                }
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
              >
                <option value="DISTRIBUTION">分配</option>
                <option value="PURCHASE">追加購入</option>
                <option value="REDEMPTION">一部解約</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">ラベル(決算日等)</span>
              <input
                type="text"
                value={row.label}
                onChange={(e) =>
                  setEvents((prev) =>
                    prev.map((r) => (r.key === row.key ? { ...r, label: e.target.value } : r)),
                  )
                }
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">
                {row.type === "DISTRIBUTION"
                  ? "分配金額(1万口当たり)"
                  : row.type === "PURCHASE"
                    ? "追加購入口数"
                    : "一部解約口数"}
              </span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={row.distribution}
                onChange={(e) =>
                  setEvents((prev) =>
                    prev.map((r) =>
                      r.key === row.key ? { ...r, distribution: e.target.value } : r,
                    ),
                  )
                }
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
            {row.type !== "REDEMPTION" && (
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-neutral-500">
                  {row.type === "PURCHASE"
                    ? "購入時基準価額(1万口当たり)"
                    : "分配落ち後基準価額(1万口当たり)"}
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={row.postNav}
                  onChange={(e) =>
                    setEvents((prev) =>
                      prev.map((r) => (r.key === row.key ? { ...r, postNav: e.target.value } : r)),
                    )
                  }
                  className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
                />
              </label>
            )}
            <button
              type="button"
              onClick={() => setEvents((prev) => prev.filter((r) => r.key !== row.key))}
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
            setEvents((prev) => [...prev, newEventRow(key, prev.length + 1)]);
          }}
          className="self-start rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          イベントを追加(分配・追加購入・一部解約)
        </button>
      </div>

      {result === null ? (
        <p className="text-sm text-red-600">
          入力値を確認してください(分配前個別元本・保有口数・分配金額・基準価額はいずれも0以上、保有口数・追加購入口数・一部解約口数は正の整数、一部解約口数はその時点の保有口数以下である必要があります)。
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-neutral-900 p-4 dark:border-white">
              <p className="text-sm text-neutral-500">普通分配金額の合計(課税・配当所得)</p>
              <p className="mt-1 text-3xl font-semibold">
                {yen(result.totalTaxableDistributionJpy)}
              </p>
            </div>
            <div className="rounded-lg border border-neutral-300 p-4 dark:border-neutral-700">
              <p className="text-sm text-neutral-500">特別分配金額の合計(非課税・元本払戻金)</p>
              <p className="mt-1 text-3xl font-semibold">
                {yen(result.totalNonTaxableDistributionJpy)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-neutral-500">
            <p>
              最終的な個別元本(1万口当たり):{" "}
              <span className="font-medium text-neutral-900 dark:text-neutral-100">
                {yen(result.closingPrincipalPer10kUnitsJpy)}
              </span>
            </p>
            <p>
              最終的な保有口数:{" "}
              <span className="font-medium text-neutral-900 dark:text-neutral-100">
                {result.closingHoldingUnits.toLocaleString("ja-JP")}口
              </span>
            </p>
          </div>

          {result.events.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[840px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-neutral-300 text-left text-neutral-500 dark:border-neutral-700">
                    <th className="py-2 pr-4">ラベル</th>
                    <th className="py-2 pr-4">保有口数</th>
                    <th className="py-2 pr-4">分配前個別元本(1万口)</th>
                    <th className="py-2 pr-4">普通分配金(1万口)</th>
                    <th className="py-2 pr-4">特別分配金(1万口)</th>
                    <th className="py-2 pr-4">普通分配金(実額)</th>
                    <th className="py-2 pr-4">特別分配金(実額)</th>
                    <th className="py-2 pr-4">分配後個別元本(1万口)</th>
                  </tr>
                </thead>
                <tbody>
                  {result.events.map((row) => (
                    <tr key={row.label} className="border-b border-neutral-100 dark:border-neutral-900">
                      <td className="py-2 pr-4 font-medium">{row.label}</td>
                      <td className="py-2 pr-4">{row.holdingUnits.toLocaleString("ja-JP")}口</td>
                      <td className="py-2 pr-4">{yen(row.openingPrincipalPer10kUnitsJpy)}</td>
                      <td className="py-2 pr-4">{yen(row.taxableDistributionPer10kUnitsJpy)}</td>
                      <td className="py-2 pr-4">{yen(row.nonTaxableDistributionPer10kUnitsJpy)}</td>
                      <td className="py-2 pr-4">{yen(row.taxableDistributionJpy)}</td>
                      <td className="py-2 pr-4">{yen(row.nonTaxableDistributionJpy)}</td>
                      <td className="py-2 pr-4">{yen(row.closingPrincipalPer10kUnitsJpy)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

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
