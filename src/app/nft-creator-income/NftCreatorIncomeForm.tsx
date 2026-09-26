"use client";

import { useId, useMemo, useRef, useState } from "react";
import { estimateNftCreatorIncome } from "@/lib/nftCreatorIncome";

function yen(value: { toString(): string }): string {
  const n = Number(value.toString());
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

interface NftRow {
  key: string;
  description: string;
  transferRevenue: string;
  mintingCost: string;
  sellingAndAdminExpenses: string;
  artCreationCost: string;
}

function newNftRow(key: string): NftRow {
  return {
    key,
    description: "",
    transferRevenue: "0",
    mintingCost: "0",
    sellingAndAdminExpenses: "0",
    artCreationCost: "0",
  };
}

export function NftCreatorIncomeForm() {
  const idPrefix = useId();
  const [items, setItems] = useState<NftRow[]>([newNftRow("initial")]);
  const nextRowIdRef = useRef(0);

  const result = useMemo(() => {
    try {
      return estimateNftCreatorIncome({
        items: items.map((row) => ({
          description: row.description,
          transferRevenueJpy: row.transferRevenue || 0,
          mintingCostJpy: row.mintingCost || 0,
          sellingAndAdminExpensesJpy: row.sellingAndAdminExpenses || 0,
          artCreationCostJpy: row.artCreationCost || 0,
        })),
      });
    } catch {
      return null;
    }
  }, [items]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        {items.map((row, index) => (
          <fieldset
            key={row.key}
            className="grid grid-cols-1 gap-3 rounded-md border border-neutral-200 p-3 sm:grid-cols-5 dark:border-neutral-800"
          >
            <legend className="px-1 text-sm font-medium">NFT取引 {index + 1}</legend>
            <label className="flex flex-col gap-1 text-sm sm:col-span-1">
              <span className="text-neutral-500">作品名・NFTの内容</span>
              <input
                type="text"
                placeholder="デジタルアートA等"
                value={row.description}
                onChange={(e) =>
                  setItems((prev) =>
                    prev.map((r) =>
                      r.key === row.key ? { ...r, description: e.target.value } : r,
                    ),
                  )
                }
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">譲渡収入</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={row.transferRevenue}
                onChange={(e) =>
                  setItems((prev) =>
                    prev.map((r) =>
                      r.key === row.key ? { ...r, transferRevenue: e.target.value } : r,
                    ),
                  )
                }
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">組成(ミント)費用</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={row.mintingCost}
                onChange={(e) =>
                  setItems((prev) =>
                    prev.map((r) =>
                      r.key === row.key ? { ...r, mintingCost: e.target.value } : r,
                    ),
                  )
                }
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">販売費及び一般管理費</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={row.sellingAndAdminExpenses}
                onChange={(e) =>
                  setItems((prev) =>
                    prev.map((r) =>
                      r.key === row.key
                        ? { ...r, sellingAndAdminExpenses: e.target.value }
                        : r,
                    ),
                  )
                }
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">
                デジタルアート制作費(参考、必要経費に算入不可)
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={row.artCreationCost}
                onChange={(e) =>
                  setItems((prev) =>
                    prev.map((r) =>
                      r.key === row.key ? { ...r, artCreationCost: e.target.value } : r,
                    ),
                  )
                }
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
            <button
              type="button"
              onClick={() => setItems((prev) => prev.filter((r) => r.key !== row.key))}
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
            setItems((prev) => [...prev, newNftRow(key)]);
          }}
          className="self-start rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          NFT取引を追加
        </button>
      </div>

      {result === null ? (
        <p className="text-sm text-red-600">入力値を確認してください(すべて0以上の数値)。</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-sm text-neutral-500">譲渡収入の合計</p>
              <p className="mt-1 text-2xl font-semibold">{yen(result.totalRevenueJpy)}</p>
            </div>
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-sm text-neutral-500">必要経費の合計(組成費用+販管費)</p>
              <p className="mt-1 text-2xl font-semibold">{yen(result.deductibleExpensesJpy)}</p>
            </div>
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-sm text-neutral-500">
                参考: 必要経費に算入できない制作費の合計
              </p>
              <p className="mt-1 text-2xl font-semibold">
                {yen(result.excludedArtCreationCostJpy)}
              </p>
            </div>
            <div className="rounded-lg border border-neutral-900 p-4 dark:border-white">
              <p className="text-sm text-neutral-500">雑所得の金額</p>
              <p className="mt-1 text-3xl font-semibold">{yen(result.miscIncomeJpy)}</p>
            </div>
          </div>

          {result.miscIncomeJpy.isNegative() && (
            <p className="rounded-md border border-dashed border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              雑所得の金額が赤字({yen(result.miscIncomeJpy.abs())})です。他の所得区分
              (給与所得等)との損益通算はできません(暗号資産等、雑所得内での通算のみ
              可能)。
            </p>
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
