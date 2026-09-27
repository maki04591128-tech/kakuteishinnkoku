"use client";

import { useId, useMemo, useRef, useState } from "react";
import { estimateInheritedAnnuityIncome } from "@/lib/inheritedAnnuityIncome";

function yen(value: { toString(): string }): string {
  const n = Number(value.toString());
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

interface ContractRow {
  key: string;
  name: string;
  annualAnnuityAmount: string;
  inheritanceTaxValuation: string;
  totalScheduledPayment: string;
  totalPremiumsPaid: string;
  remainingYearsAtAcquisition: string;
  paymentYearNumber: string;
}

function newContractRow(key: string): ContractRow {
  return {
    key,
    name: "",
    annualAnnuityAmount: "0",
    inheritanceTaxValuation: "0",
    totalScheduledPayment: "0",
    totalPremiumsPaid: "0",
    remainingYearsAtAcquisition: "10",
    paymentYearNumber: "1",
  };
}

export function InheritedAnnuityIncomeForm() {
  const idPrefix = useId();
  const [contracts, setContracts] = useState<ContractRow[]>([newContractRow("initial")]);
  const nextRowIdRef = useRef(0);

  const result = useMemo(() => {
    try {
      return estimateInheritedAnnuityIncome(
        contracts.map((row) => ({
          name: row.name,
          annualAnnuityAmountJpy: row.annualAnnuityAmount || 0,
          inheritanceTaxValuationJpy: row.inheritanceTaxValuation || 0,
          totalScheduledPaymentJpy: row.totalScheduledPayment || 0,
          totalPremiumsPaidJpy: row.totalPremiumsPaid || 0,
          remainingYearsAtAcquisition: Number(row.remainingYearsAtAcquisition || 0),
          paymentYearNumber: Number(row.paymentYearNumber || 0),
        })),
      );
    } catch {
      return null;
    }
  }, [contracts]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        {contracts.map((row, index) => (
          <fieldset
            key={row.key}
            className="grid grid-cols-1 gap-3 rounded-md border border-neutral-200 p-3 sm:grid-cols-3 dark:border-neutral-800"
          >
            <legend className="px-1 text-sm font-medium">契約 {index + 1}</legend>
            <label className="flex flex-col gap-1 text-sm sm:col-span-3">
              <span className="text-neutral-500">契約の名称等(任意)</span>
              <input
                type="text"
                placeholder="例: A生命 個人年金保険(相続分)"
                value={row.name}
                onChange={(e) =>
                  setContracts((prev) =>
                    prev.map((r) => (r.key === row.key ? { ...r, name: e.target.value } : r)),
                  )
                }
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">その年に支払を受ける年金の額</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={row.annualAnnuityAmount}
                onChange={(e) =>
                  setContracts((prev) =>
                    prev.map((r) =>
                      r.key === row.key ? { ...r, annualAnnuityAmount: e.target.value } : r,
                    ),
                  )
                }
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">年金受給権の相続税評価額</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={row.inheritanceTaxValuation}
                onChange={(e) =>
                  setContracts((prev) =>
                    prev.map((r) =>
                      r.key === row.key ? { ...r, inheritanceTaxValuation: e.target.value } : r,
                    ),
                  )
                }
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">確定年金の支払総額</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={row.totalScheduledPayment}
                onChange={(e) =>
                  setContracts((prev) =>
                    prev.map((r) =>
                      r.key === row.key ? { ...r, totalScheduledPayment: e.target.value } : r,
                    ),
                  )
                }
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">保険料又は掛金の総額</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={row.totalPremiumsPaid}
                onChange={(e) =>
                  setContracts((prev) =>
                    prev.map((r) =>
                      r.key === row.key ? { ...r, totalPremiumsPaid: e.target.value } : r,
                    ),
                  )
                }
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">
                支払開始日における残存期間年数(年金支払通知書記載の年数)
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={2}
                step={1}
                value={row.remainingYearsAtAcquisition}
                onChange={(e) =>
                  setContracts((prev) =>
                    prev.map((r) =>
                      r.key === row.key
                        ? { ...r, remainingYearsAtAcquisition: e.target.value }
                        : r,
                    ),
                  )
                }
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">支払年数(支払開始日の年を1年目とする)</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={row.paymentYearNumber}
                onChange={(e) =>
                  setContracts((prev) =>
                    prev.map((r) =>
                      r.key === row.key ? { ...r, paymentYearNumber: e.target.value } : r,
                    ),
                  )
                }
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
            <button
              type="button"
              onClick={() => setContracts((prev) => prev.filter((r) => r.key !== row.key))}
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
            setContracts((prev) => [...prev, newContractRow(key)]);
          }}
          className="self-start rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          契約を追加
        </button>
      </div>

      {result === null ? (
        <p className="text-sm text-red-600">
          入力値を確認してください(年金の額・相続税評価額・保険料総額は0以上、支払総額は正の値、
          残存期間年数は2以上の整数、支払年数は1以上残存期間年数以下の整数、相続税評価割合は
          100分の50超である必要があります)。
        </p>
      ) : (
        <>
          <div className="rounded-lg border border-neutral-900 p-4 dark:border-white">
            <p className="text-sm text-neutral-500">雑所得の金額の合計</p>
            <p className="mt-1 text-3xl font-semibold">{yen(result.totalMiscIncomeJpy)}</p>
          </div>

          {result.contracts.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-neutral-300 text-left text-neutral-500 dark:border-neutral-700">
                    <th className="py-2 pr-4">契約</th>
                    <th className="py-2 pr-4">相続税評価割合</th>
                    <th className="py-2 pr-4">課税割合</th>
                    <th className="py-2 pr-4">課税部分の年金収入額</th>
                    <th className="py-2 pr-4">非課税部分の金額</th>
                    <th className="py-2 pr-4">必要経費の額</th>
                    <th className="py-2 pr-4">雑所得の金額</th>
                  </tr>
                </thead>
                <tbody>
                  {result.contracts.map((row) => (
                    <tr key={row.name} className="border-b border-neutral-100 dark:border-neutral-900">
                      <td className="py-2 pr-4 font-medium">{row.name}</td>
                      <td className="py-2 pr-4">
                        {row.inheritanceTaxValuationRatio.times(100).toDecimalPlaces(1).toString()}%
                      </td>
                      <td className="py-2 pr-4">{row.taxableRatio.times(100).toString()}%</td>
                      <td className="py-2 pr-4">{yen(row.taxablePortionJpy)}</td>
                      <td className="py-2 pr-4">{yen(row.nonTaxablePortionJpy)}</td>
                      <td className="py-2 pr-4">{yen(row.necessaryExpenseJpy)}</td>
                      <td className="py-2 pr-4">{yen(row.miscIncomeJpy)}</td>
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
