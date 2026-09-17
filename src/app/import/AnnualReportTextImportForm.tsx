"use client";

import { useMemo, useState } from "react";
import { setBrokerAnnualReport } from "@/app/actions";
import type { AnnualReportAccountType } from "@/lib/investment/annualReportCsv";
import { parseAnnualReportText } from "@/lib/investment/annualReportText";

const ACCOUNT_TYPE_OPTIONS: { value: AnnualReportAccountType; label: string }[] = [
  { value: "SPECIFIC_WITHHOLDING", label: "特定口座(源泉徴収あり)" },
  { value: "SPECIFIC_NO_WITHHOLDING", label: "特定口座(源泉徴収なし)" },
  { value: "GENERAL", label: "一般口座" },
];

function yen(value: { toString(): string } | null): string {
  if (value === null) return "(読み取れませんでした)";
  const n = Number(value.toString());
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

/**
 * 「特定口座年間取引報告書」のPDFから本文をコピーしたテキストを貼り付けると、
 * ラベルを手がかりに金額・証券会社名・口座区分を読み取り、下の登録フォームに
 * 補完する。読み取り精度は保証しないため、あくまで下書きとして表示し、
 * ユーザーが「反映する」を押して初めて入力欄に反映される(自動で書き換えない)。
 */
export function AnnualReportTextImportForm({ year }: { year: number }) {
  const [pastedText, setPastedText] = useState("");
  const [broker, setBroker] = useState("");
  const [accountType, setAccountType] = useState<AnnualReportAccountType>(
    "SPECIFIC_WITHHOLDING",
  );
  const [proceeds, setProceeds] = useState("");
  const [acquisitionCost, setAcquisitionCost] = useState("");
  const [dividend, setDividend] = useState("0");

  const parsed = useMemo(() => {
    if (!pastedText.trim()) return null;
    try {
      return parseAnnualReportText(pastedText);
    } catch {
      return null;
    }
  }, [pastedText]);

  function applyParsedValues() {
    if (!parsed) return;
    if (parsed.brokerGuess) setBroker(parsed.brokerGuess);
    if (parsed.accountTypeGuess) setAccountType(parsed.accountTypeGuess);
    if (parsed.proceedsJpy) setProceeds(parsed.proceedsJpy.toString());
    if (parsed.acquisitionCostJpy) setAcquisitionCost(parsed.acquisitionCostJpy.toString());
    if (parsed.dividendJpy) setDividend(parsed.dividendJpy.toString());
  }

  return (
    <div className="mb-6 border-b border-dashed border-neutral-200 pb-6 dark:border-neutral-800">
      <h3 className="mb-2 text-sm font-semibold">テキスト貼り付け取り込み(PDFからのコピー)</h3>
      <p className="mb-3 text-sm text-neutral-500">
        年間取引報告書はPDFで発行されることが多いため、本ツールはPDFファイル自体の解析
        (レイアウト解析・OCR)には対応しない。代わりに、PDFビューアで本文を選択して
        コピーしたテキストをここに貼り付けると、「譲渡の対価の額(収入金額)」
        「取得費及び譲渡に要した費用の額等」「配当等の額」等のラベルを手がかりに金額を
        読み取り、下書きとして表示する。証券会社名・口座区分の判定や、証券会社ごとの
        レイアウトの違いによっては誤読することがあるため、「反映する」で入力欄に
        コピーした後、登録前に必ず内容を確認・修正すること。
      </p>
      <textarea
        value={pastedText}
        onChange={(e) => setPastedText(e.target.value)}
        rows={6}
        placeholder="PDFビューアからコピーした年間取引報告書の本文をここに貼り付け"
        className={`${inputClass} mb-3 w-full`}
      />
      {parsed && (
        <div className="mb-3 rounded-md bg-neutral-50 p-3 text-xs text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
          <p className="mb-1 font-medium">読み取り結果(下書き、未確定)</p>
          <p>証券会社: {parsed.brokerGuess ?? "(読み取れませんでした)"}</p>
          <p>
            口座区分:{" "}
            {parsed.accountTypeGuess
              ? ACCOUNT_TYPE_OPTIONS.find((o) => o.value === parsed.accountTypeGuess)?.label
              : "(読み取れませんでした)"}
          </p>
          <p>譲渡の対価の額(収入金額): {yen(parsed.proceedsJpy)}</p>
          <p>取得費及び譲渡に要した費用の額等: {yen(parsed.acquisitionCostJpy)}</p>
          {parsed.netGainJpy !== null && <p>差引金額(参考表示): {yen(parsed.netGainJpy)}</p>}
          <p>配当等の額: {yen(parsed.dividendJpy)}</p>
          <button
            type="button"
            onClick={applyParsedValues}
            className="mt-2 rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-white dark:text-neutral-900"
          >
            この内容を下の入力欄に反映する
          </button>
        </div>
      )}

      <form action={setBrokerAnnualReport} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <input type="hidden" name="year" value={year} />
        <Field label="証券会社">
          <input
            type="text"
            name="broker"
            value={broker}
            onChange={(e) => setBroker(e.target.value)}
            placeholder="SBI証券"
            required
            className={inputClass}
          />
        </Field>
        <Field label="口座区分">
          <select
            name="accountType"
            value={accountType}
            onChange={(e) => setAccountType(e.target.value as AnnualReportAccountType)}
            className={inputClass}
          >
            {ACCOUNT_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="譲渡の対価の額(収入金額・円)">
          <input
            type="number"
            step="any"
            name="proceedsJpy"
            value={proceeds}
            onChange={(e) => setProceeds(e.target.value)}
            required
            className={inputClass}
          />
        </Field>
        <Field label="取得費及び譲渡費用の額等(円)">
          <input
            type="number"
            step="any"
            name="acquisitionCostJpy"
            value={acquisitionCost}
            onChange={(e) => setAcquisitionCost(e.target.value)}
            required
            className={inputClass}
          />
        </Field>
        <Field label="配当等の額(円・任意)">
          <input
            type="number"
            step="any"
            name="dividendJpy"
            value={dividend}
            onChange={(e) => setDividend(e.target.value)}
            className={inputClass}
          />
        </Field>
        <div className="col-span-full">
          <button
            type="submit"
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
          >
            登録・更新(同じ証券会社・口座区分は上書き)
          </button>
        </div>
      </form>
    </div>
  );
}

const inputClass =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-neutral-500">{label}</span>
      {children}
    </label>
  );
}
