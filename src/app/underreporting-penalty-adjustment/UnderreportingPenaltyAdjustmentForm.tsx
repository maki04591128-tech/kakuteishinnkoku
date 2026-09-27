"use client";

import { useId, useMemo, useState } from "react";
import {
  determinePenaltyAdjustment,
  type DisclosureStatementType,
  type UnderreportingTaxType,
} from "@/lib/underreportingPenaltyAdjustment";

const STATEMENT_LABELS: Record<DisclosureStatementType, string> = {
  OVERSEAS_ASSET: "国外財産調書",
  ASSET_LIABILITY: "財産債務調書",
};

const TAX_TYPE_LABELS: Record<UnderreportingTaxType, string> = {
  OWN_INCOME_TAX: "本人自身の所得税(又は相続税)",
  DECEASED_PERSON_INCOME_TAX: "死亡した方自身の所得税(準確定申告)",
  INHERITANCE_TAX: "相続人自身の相続税",
};

export function UnderreportingPenaltyAdjustmentForm() {
  const idPrefix = useId();
  const [statementType, setStatementType] = useState<DisclosureStatementType>("OVERSEAS_ASSET");
  const [underreportingTaxType, setUnderreportingTaxType] =
    useState<UnderreportingTaxType>("OWN_INCOME_TAX");
  const [hasUnderreporting, setHasUnderreporting] = useState(true);
  const [filedByDeadlineOrDeemedTimely, setFiledByDeadlineOrDeemedTimely] = useState(true);
  const [assetOrDebtWasListed, setAssetOrDebtWasListed] = useState(true);
  const [noFaultForInheritedProperty, setNoFaultForInheritedProperty] = useState(false);
  const [overseasDocumentsNotProvided, setOverseasDocumentsNotProvided] = useState(false);

  const result = useMemo(
    () =>
      determinePenaltyAdjustment({
        statementType,
        underreportingTaxType,
        hasUnderreporting,
        filedByDeadlineOrDeemedTimely,
        assetOrDebtWasListed,
        noFaultForInheritedProperty,
        overseasDocumentsNotProvided,
      }),
    [
      statementType,
      underreportingTaxType,
      hasUnderreporting,
      filedByDeadlineOrDeemedTimely,
      assetOrDebtWasListed,
      noFaultForInheritedProperty,
      overseasDocumentsNotProvided,
    ],
  );

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="grid grid-cols-1 gap-3 rounded-md border border-neutral-200 p-3 sm:grid-cols-2 dark:border-neutral-800">
        <legend className="px-1 text-sm font-medium">調書・申告漏れの区分</legend>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">判定対象の調書</span>
          <select
            id={`${idPrefix}-statement`}
            value={statementType}
            onChange={(e) => setStatementType(e.target.value as DisclosureStatementType)}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
          >
            {(Object.keys(STATEMENT_LABELS) as DisclosureStatementType[]).map((key) => (
              <option key={key} value={key}>
                {STATEMENT_LABELS[key]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">
            申告漏れの原因区分(加重措置の除外対象が調書ごとに異なるため区別する)
          </span>
          <select
            id={`${idPrefix}-tax-type`}
            value={underreportingTaxType}
            onChange={(e) => setUnderreportingTaxType(e.target.value as UnderreportingTaxType)}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900"
          >
            {(Object.keys(TAX_TYPE_LABELS) as UnderreportingTaxType[]).map((key) => (
              <option key={key} value={key}>
                {TAX_TYPE_LABELS[key]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            id={`${idPrefix}-has-underreporting`}
            type="checkbox"
            checked={hasUnderreporting}
            onChange={(e) => setHasUnderreporting(e.target.checked)}
          />
          <span className="text-neutral-500">
            対象資産(債務)に関して生じる所得等について、所得税又は相続税の申告漏れが生じた
          </span>
        </label>
      </fieldset>

      <fieldset className="grid grid-cols-1 gap-3 rounded-md border border-neutral-200 p-3 sm:grid-cols-2 dark:border-neutral-800">
        <legend className="px-1 text-sm font-medium">調書の提出状況</legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            id={`${idPrefix}-filed-on-time`}
            type="checkbox"
            checked={filedByDeadlineOrDeemedTimely}
            onChange={(e) => setFiledByDeadlineOrDeemedTimely(e.target.checked)}
          />
          <span className="text-neutral-500">
            提出期限内に提出した(又は調査通知前提出により期限内提出とみなされる)
          </span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            id={`${idPrefix}-listed`}
            type="checkbox"
            checked={assetOrDebtWasListed}
            onChange={(e) => setAssetOrDebtWasListed(e.target.checked)}
          />
          <span className="text-neutral-500">
            提出した調書に、申告漏れの基因となった資産(債務)についての記載があった
          </span>
        </label>
        {underreportingTaxType === "INHERITANCE_TAX" && (
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              id={`${idPrefix}-no-fault`}
              type="checkbox"
              checked={noFaultForInheritedProperty}
              onChange={(e) => setNoFaultForInheritedProperty(e.target.checked)}
            />
            <span className="text-neutral-500">
              相続財産(債務)について、調書の提出等がないことに相続人本人の責めに帰すべき
              事由が無い
            </span>
          </label>
        )}
        {statementType === "OVERSEAS_ASSET" && (
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              id={`${idPrefix}-documents-not-provided`}
              type="checkbox"
              checked={overseasDocumentsNotProvided}
              onChange={(e) => setOverseasDocumentsNotProvided(e.target.checked)}
            />
            <span className="text-neutral-500">
              税務調査で国外財産に関する書類の提示等を求められたが、指定期限までに応じな
              かった(国外財産調書のみ。応じられなかったことに本人の責めに帰すべき事由が
              ない場合は対象外)
            </span>
          </label>
        )}
      </fieldset>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div
          className={`rounded-lg border p-4 ${
            result.reductionPercent > 0 ? "border-emerald-600" : "border-neutral-900 dark:border-white"
          }`}
        >
          <p className="text-sm text-neutral-500">軽減措置</p>
          <p className="mt-1 text-2xl font-semibold">
            {result.applicable ? `${result.reductionPercent}%軽減` : "対象外"}
          </p>
        </div>
        <div
          className={`rounded-lg border p-4 ${
            result.increasePercent > 0 ? "border-red-600" : "border-neutral-900 dark:border-white"
          }`}
        >
          <p className="text-sm text-neutral-500">加重措置</p>
          <p className="mt-1 text-2xl font-semibold">
            {result.applicable ? `${result.increasePercent}%加重` : "対象外"}
          </p>
        </div>
      </div>

      <p className="text-sm text-neutral-500">{result.reason}</p>

      <ul className="list-disc space-y-1 pl-5 text-xs text-neutral-500">
        {result.notes.map((note, i) => (
          <li key={i}>{note}</li>
        ))}
      </ul>
    </div>
  );
}
