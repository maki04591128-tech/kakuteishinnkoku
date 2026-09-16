"use client";

import { useMemo, useState } from "react";
import { calculateForeignTaxCredit } from "@/lib/investment/foreignTaxCredit";

function yen(value: { toString(): string }): string {
  const n = Number(value.toString());
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

export function ForeignTaxCreditForm() {
  const [incomeTaxJpy, setIncomeTaxJpy] = useState("300000");
  const [totalIncomeJpy, setTotalIncomeJpy] = useState("5000000");
  const [foreignSourceIncomeJpy, setForeignSourceIncomeJpy] = useState("300000");
  const [foreignIncomeTaxPaidJpy, setForeignIncomeTaxPaidJpy] = useState("30000");
  const [carriedForwardExcessJpy, setCarriedForwardExcessJpy] = useState("0");

  const result = useMemo(() => {
    try {
      return calculateForeignTaxCredit({
        incomeTaxJpy: incomeTaxJpy === "" ? 0 : incomeTaxJpy,
        totalIncomeJpy: totalIncomeJpy === "" ? 0 : totalIncomeJpy,
        foreignSourceIncomeJpy: foreignSourceIncomeJpy === "" ? 0 : foreignSourceIncomeJpy,
        foreignIncomeTaxPaidJpy: foreignIncomeTaxPaidJpy === "" ? 0 : foreignIncomeTaxPaidJpy,
        carriedForwardExcessForeignTaxJpy:
          carriedForwardExcessJpy === "" ? 0 : carriedForwardExcessJpy,
      });
    } catch {
      return null;
    }
  }, [
    incomeTaxJpy,
    totalIncomeJpy,
    foreignSourceIncomeJpy,
    foreignIncomeTaxPaidJpy,
    carriedForwardExcessJpy,
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="所得税額(他の税額控除適用前・復興特別所得税を除く)"
          value={incomeTaxJpy}
          onChange={setIncomeTaxJpy}
        />
        <Field
          label="所得総額(総所得金額等・全所得の合計)"
          value={totalIncomeJpy}
          onChange={setTotalIncomeJpy}
        />
        <Field
          label="国外所得金額(外国株式配当等、控除対象の国外所得の合計)"
          value={foreignSourceIncomeJpy}
          onChange={setForeignSourceIncomeJpy}
        />
        <Field
          label="外国所得税額(現地で源泉徴収された税額の年間合計・円換算)"
          value={foreignIncomeTaxPaidJpy}
          onChange={setForeignIncomeTaxPaidJpy}
        />
        <Field
          label="前年以前3年以内の繰越控除限度超過額(あれば)"
          value={carriedForwardExcessJpy}
          onChange={setCarriedForwardExcessJpy}
        />
      </div>

      {result === null ? (
        <p className="text-sm text-red-600">入力値を確認してください(0以上の数値を入力)。</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <LimitCard label="所得税の控除限度額" value={result.incomeTaxLimitJpy} />
            <LimitCard
              label="復興特別所得税の控除限度額"
              value={result.reconstructionSurtaxLimitJpy}
            />
            <LimitCard label="住民税の控除限度額(概算)" value={result.residentTaxLimitJpy} />
          </div>

          <div className="rounded-lg border border-neutral-900 p-4 dark:border-white">
            <p className="text-sm text-neutral-500">合計控除限度額</p>
            <p className="mt-1 text-2xl font-semibold">{yen(result.totalLimitJpy)}</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-sm text-neutral-500">外国税額控除として使える合計額</p>
              <p className="mt-1 text-2xl font-semibold">{yen(result.totalCreditJpy)}</p>
              <p className="mt-1 text-xs text-neutral-400">
                当年発生分から{yen(result.creditFromCurrentYearJpy)}
                {result.creditFromCarryforwardJpy.greaterThan(0) &&
                  ` + 繰越分から${yen(result.creditFromCarryforwardJpy)}`}
              </p>
            </div>
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-sm text-neutral-500">翌年以後に繰り越す額</p>
              <p className="mt-1 text-2xl font-semibold">
                {yen(result.newExcessForeignTaxJpy.plus(result.unusedCarriedForwardExcessJpy))}
              </p>
              {result.newExcessForeignTaxJpy.greaterThan(0) && (
                <p className="mt-1 text-xs text-neutral-400">
                  当年新規の控除限度超過額: {yen(result.newExcessForeignTaxJpy)}
                </p>
              )}
              {result.unusedCarriedForwardExcessJpy.greaterThan(0) && (
                <p className="mt-1 text-xs text-neutral-400">
                  使い切れず残った繰越分: {yen(result.unusedCarriedForwardExcessJpy)}
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-neutral-500">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
      />
    </label>
  );
}

function LimitCard({ label, value }: { label: string; value: { toString(): string } }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <p className="text-sm text-neutral-500">{label}</p>
      <p className="mt-1 text-xl font-semibold">{yen(value)}</p>
    </div>
  );
}
