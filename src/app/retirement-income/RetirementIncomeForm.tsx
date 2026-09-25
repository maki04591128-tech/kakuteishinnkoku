"use client";

import { useMemo, useState } from "react";
import {
  estimateRetirementIncome,
  type RetirementIncomeCategory,
  type RetirementPaymentKind,
  type SamePeriodRetirementPaymentInput,
} from "@/lib/retirementIncome";

function yen(value: { toString(): string }): string {
  const n = Number(value.toString());
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

const CATEGORY_LABELS: Record<RetirementIncomeCategory, string> = {
  GENERAL: "一般の退職手当等(通常どおり2分の1課税)",
  SPECIFIED_OFFICER: "特定役員退職手当等(役員等勤続年数5年以下。2分の1課税の適用なし)",
  SHORT_TERM: "短期退職手当等(役員等以外の勤続年数5年以下。300万円超の部分のみ2分の1課税の適用なし)",
};

const PRIOR_PAYMENT_KIND_LABELS: Record<RetirementPaymentKind, string> = {
  REGULAR: "通常の退職手当等",
  DC_LUMP_SUM: "DC一時金(確定拠出年金の老齢給付金として支給される一時金)",
};

interface SamePeriodPaymentRow {
  incomeJpy: string;
  yearsOfService: string;
  overlappingYearsOfService: string;
}

const EMPTY_SAME_PERIOD_PAYMENT_ROW: SamePeriodPaymentRow = {
  incomeJpy: "0",
  yearsOfService: "0",
  overlappingYearsOfService: "0",
};

export function RetirementIncomeForm() {
  const [incomeJpy, setIncomeJpy] = useState("0");
  const [yearsOfService, setYearsOfService] = useState("10");
  const [isDisabilityRelated, setIsDisabilityRelated] = useState(false);
  const [category, setCategory] = useState<RetirementIncomeCategory>("GENERAL");
  const [isDefinedContributionLumpSum, setIsDefinedContributionLumpSum] = useState(false);
  const [paymentYear, setPaymentYear] = useState(String(new Date().getFullYear()));
  const [hasPriorPayment, setHasPriorPayment] = useState(false);
  const [priorPaymentYear, setPriorPaymentYear] = useState("");
  const [priorPaymentKind, setPriorPaymentKind] = useState<RetirementPaymentKind>("REGULAR");
  const [overlappingYearsOfService, setOverlappingYearsOfService] = useState("0");
  const [hasSamePeriodPayments, setHasSamePeriodPayments] = useState(false);
  const [samePeriodPayments, setSamePeriodPayments] = useState<SamePeriodPaymentRow[]>([
    { ...EMPTY_SAME_PERIOD_PAYMENT_ROW },
  ]);

  const result = useMemo(() => {
    const years = Number(yearsOfService);
    if (!Number.isFinite(years) || years <= 0) return null;
    try {
      const samePeriodPaymentsInput: SamePeriodRetirementPaymentInput[] | undefined = hasSamePeriodPayments
        ? samePeriodPayments.map((row) => ({
            incomeJpy: row.incomeJpy === "" ? 0 : row.incomeJpy,
            yearsOfService: Number(row.yearsOfService),
            overlappingYearsOfService: Number(row.overlappingYearsOfService),
          }))
        : undefined;
      return estimateRetirementIncome({
        incomeJpy: incomeJpy === "" ? 0 : incomeJpy,
        yearsOfService: years,
        isDisabilityRelated,
        category,
        isDefinedContributionLumpSum,
        paymentYear: hasPriorPayment ? Number(paymentYear) : undefined,
        priorPayment: hasPriorPayment
          ? {
              paymentYear: Number(priorPaymentYear),
              kind: priorPaymentKind,
              overlappingYearsOfService: Number(overlappingYearsOfService),
            }
          : undefined,
        samePeriodPayments: samePeriodPaymentsInput,
      });
    } catch {
      return null;
    }
  }, [
    incomeJpy,
    yearsOfService,
    isDisabilityRelated,
    category,
    isDefinedContributionLumpSum,
    paymentYear,
    hasPriorPayment,
    priorPaymentYear,
    priorPaymentKind,
    overlappingYearsOfService,
    hasSamePeriodPayments,
    samePeriodPayments,
  ]);

  function updateSamePeriodPaymentRow(index: number, patch: Partial<SamePeriodPaymentRow>) {
    setSamePeriodPayments((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">退職金の収入金額(源泉徴収前)</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={incomeJpy}
            onChange={(e) => setIncomeJpy(e.target.value)}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">
            勤続年数(1年未満は切り上げ計算。例: 10年3か月→10.25)
          </span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step={0.01}
            value={yearsOfService}
            onChange={(e) => setYearsOfService(e.target.value)}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-neutral-500">区分</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as RetirementIncomeCategory)}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
          >
            {(Object.keys(CATEGORY_LABELS) as RetirementIncomeCategory[]).map((key) => (
              <option key={key} value={key}>
                {CATEGORY_LABELS[key]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            checked={isDisabilityRelated}
            onChange={(e) => setIsDisabilityRelated(e.target.checked)}
            className="h-4 w-4 rounded border-neutral-300 dark:border-neutral-700"
          />
          <span className="text-neutral-500">
            障害者になったことが直接の原因で退職した(退職所得控除額に100万円加算)
          </span>
        </label>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            checked={isDefinedContributionLumpSum}
            onChange={(e) => setIsDefinedContributionLumpSum(e.target.checked)}
            className="h-4 w-4 rounded border-neutral-300 dark:border-neutral-700"
          />
          <span className="text-neutral-500">
            今回の退職手当等はDC一時金(iDeCo・企業型確定拠出年金の老齢給付金として支給される一時金)である
          </span>
        </label>
      </div>

      <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={hasSamePeriodPayments}
            onChange={(e) => setHasSamePeriodPayments(e.target.checked)}
            className="h-4 w-4 rounded border-neutral-300 dark:border-neutral-700"
          />
          <span className="font-medium">
            同一年中に他の支払者からも退職手当等を受け取っている(2か所以上から受け取る場合)
          </span>
        </label>
        <p className="mt-1 text-xs text-neutral-500">
          同一年中に他の支払者からも退職手当等を受け取っている場合、退職所得控除額はそれぞれ別々に
          計算せず、収入金額を合算し勤続年数も重複しない期間を加算した年数で1回だけ計算する
          (国税庁タックスアンサーNo.2735、所得税法施行令69条)。
        </p>
        {hasSamePeriodPayments && (
          <div className="mt-4 flex flex-col gap-4">
            {samePeriodPayments.map((row, i) => (
              <div key={i} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-neutral-500">他の退職手当等の収入金額</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    value={row.incomeJpy}
                    onChange={(e) => updateSamePeriodPaymentRow(i, { incomeJpy: e.target.value })}
                    className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-neutral-500">その勤続年数</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={0.01}
                    value={row.yearsOfService}
                    onChange={(e) => updateSamePeriodPaymentRow(i, { yearsOfService: e.target.value })}
                    className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
                  />
                </label>
                <div className="flex items-end gap-2">
                  <label className="flex flex-1 flex-col gap-1 text-sm">
                    <span className="text-neutral-500">
                      これまでの合算勤続期間と重複する年数
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={0.01}
                      value={row.overlappingYearsOfService}
                      onChange={(e) =>
                        updateSamePeriodPaymentRow(i, { overlappingYearsOfService: e.target.value })
                      }
                      className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
                    />
                  </label>
                  {samePeriodPayments.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setSamePeriodPayments((rows) => rows.filter((_, idx) => idx !== i))
                      }
                      className="rounded-md border border-neutral-300 px-2 py-1.5 text-xs text-neutral-500 dark:border-neutral-700"
                    >
                      削除
                    </button>
                  )}
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setSamePeriodPayments((rows) => [...rows, { ...EMPTY_SAME_PERIOD_PAYMENT_ROW }])
              }
              className="self-start rounded-md border border-neutral-300 px-3 py-1.5 text-xs text-neutral-500 dark:border-neutral-700"
            >
              他の退職手当等を追加
            </button>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={hasPriorPayment}
            onChange={(e) => setHasPriorPayment(e.target.checked)}
            className="h-4 w-4 rounded border-neutral-300 dark:border-neutral-700"
          />
          <span className="font-medium">
            前年以前に他の退職手当等(前の退職手当等)を受け取っており、勤続期間等が重複している
          </span>
        </label>
        <p className="mt-1 text-xs text-neutral-500">
          前年以前一定期間内(前がDC一時金以外なら4年内、DC一時金かつ令和8年以後の支給なら9年内、
          今回がDC一時金なら19年内)に他の退職手当等を受け取っている場合、重複する勤続年数分は
          退職所得控除額を二重に使えない(所得税法施行令70条)。
        </p>
        {hasPriorPayment && (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">今回の退職手当等の支給を受けた年(西暦)</span>
              <input
                type="number"
                inputMode="numeric"
                step={1}
                value={paymentYear}
                onChange={(e) => setPaymentYear(e.target.value)}
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">前の退職手当等の支給を受けた年(西暦)</span>
              <input
                type="number"
                inputMode="numeric"
                step={1}
                value={priorPaymentYear}
                onChange={(e) => setPriorPaymentYear(e.target.value)}
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">前の退職手当等の区分</span>
              <select
                value={priorPaymentKind}
                onChange={(e) => setPriorPaymentKind(e.target.value as RetirementPaymentKind)}
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
              >
                {(Object.keys(PRIOR_PAYMENT_KIND_LABELS) as RetirementPaymentKind[]).map((key) => (
                  <option key={key} value={key}>
                    {PRIOR_PAYMENT_KIND_LABELS[key]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-500">
                今回と重複する勤続年数(1年未満は切り捨て計算。例: 6年7か月→6.58)
              </span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step={0.01}
                value={overlappingYearsOfService}
                onChange={(e) => setOverlappingYearsOfService(e.target.value)}
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
          </div>
        )}
      </div>

      {result === null ? (
        <p className="text-sm text-red-600">
          入力値を確認してください(収入金額は0以上、勤続年数は0より大きい数値を入力。前の退職手当等を
          入力する場合はその支給年が今回より前で、重複する勤続年数が今回の勤続年数以下であること。
          同一年中の他の退職手当等を入力する場合は収入金額が0以上、勤続年数が0より大きく、
          重複する年数がその勤続年数以下であること)。
        </p>
      ) : (
        <>
          {hasSamePeriodPayments && (
            <p className="text-xs text-neutral-500">
              合算後の収入金額: {yen(result.combinedIncomeJpy)} / 合算後の勤続年数:{" "}
              {result.combinedYearsOfService}年
            </p>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-sm text-neutral-500">退職所得控除額</p>
              <p className="mt-1 text-3xl font-semibold">{yen(result.deductionJpy)}</p>
              {result.overlapDeductionReductionJpy.greaterThan(0) && (
                <p className="mt-1 text-xs text-neutral-500">
                  うち前の退職手当等との重複排除による減額: {yen(result.overlapDeductionReductionJpy)}
                </p>
              )}
            </div>
            <div className="rounded-lg border border-neutral-900 p-4 dark:border-white">
              <p className="text-sm text-neutral-500">退職所得の金額</p>
              <p className="mt-1 text-3xl font-semibold">{yen(result.retirementIncomeJpy)}</p>
            </div>
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-sm text-neutral-500">所得税額(復興特別所得税を含む)の目安</p>
              <p className="mt-1 text-2xl font-semibold">{yen(result.nationalTaxJpy)}</p>
            </div>
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-sm text-neutral-500">住民税額の目安</p>
              <p className="mt-1 text-2xl font-semibold">{yen(result.residentTaxJpy)}</p>
            </div>
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
