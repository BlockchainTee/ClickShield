import type { TransactionVerdict, Verdict } from "../engine/types.js";
import { serializeCanonicalJson, sha256Hex } from "../intel/hash.js";
import { explainTransaction } from "./explain.js";
import type {
  NormalizedTransactionContext,
  TransactionExplanation,
  TransactionRiskClassification,
  TransactionSignals,
} from "./types.js";

type CanonicalJsonValue =
  | null
  | boolean
  | number
  | string
  | readonly CanonicalJsonValue[]
  | { readonly [key: string]: CanonicalJsonValue };

type TransactionAuditVerdictInput =
  | Verdict
  | Omit<TransactionVerdict, "audit">
  | TransactionVerdict;

export interface TransactionAuditRecord {
  id: string;
  timestamp: string;
  status: "block" | "warn" | "allow";
  explanation: TransactionExplanation;
  signals: TransactionSignals;
  classification: TransactionRiskClassification;
  metadata: {
    source: "extension" | "mobile" | "desktop";
  };
}

function toCanonicalJsonValue(value: unknown): CanonicalJsonValue {
  if (value === null) {
    return null;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "bigint") {
    return value.toString(10);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => toCanonicalJsonValue(entry));
  }

  if (typeof value !== "object") {
    throw new Error("Audit serialization received an unsupported value");
  }

  const record = value as Record<string, unknown>;
  const canonicalRecord: Record<string, CanonicalJsonValue> = {};

  for (const key of Object.keys(record)) {
    const entry = record[key];
    if (entry !== undefined) {
      canonicalRecord[key] = toCanonicalJsonValue(entry);
    }
  }

  return canonicalRecord;
}

function cloneCanonical<T>(value: T): T {
  return JSON.parse(
    serializeCanonicalJson(toCanonicalJsonValue(value))
  ) as T;
}

function toAuditStatus(
  status: Verdict["status"] | TransactionVerdict["status"]
): TransactionAuditRecord["status"] {
  switch (status) {
    case "ALLOW":
    case "allow":
      return "allow";
    case "WARN":
    case "warn":
      return "warn";
    case "BLOCK":
    case "block":
      return "block";
  }
}

function hasTransactionExplanation(
  verdict: TransactionAuditVerdictInput
): verdict is Omit<TransactionVerdict, "audit"> | TransactionVerdict {
  return "explanation" in verdict;
}

function resolveExplanation(
  ctx: NormalizedTransactionContext,
  verdict: TransactionAuditVerdictInput
): TransactionExplanation {
  if (hasTransactionExplanation(verdict)) {
    return verdict.explanation;
  }

  return explainTransaction(ctx, verdict);
}

function inferAuditSource(
  ctx: NormalizedTransactionContext
): TransactionAuditRecord["metadata"]["source"] {
  const surface = ctx.provider.surface.trim().toLowerCase();
  const platform = ctx.provider.platform.trim().toLowerCase();

  if (
    surface.includes("mobile") ||
    platform === "mobile" ||
    platform === "ios" ||
    platform === "android"
  ) {
    return "mobile";
  }

  if (
    surface.includes("desktop") ||
    platform === "desktop" ||
    platform === "electron"
  ) {
    return "desktop";
  }

  return "extension";
}

function buildAuditId(
  ctx: NormalizedTransactionContext,
  verdict: TransactionAuditVerdictInput,
  status: TransactionAuditRecord["status"],
  explanation: TransactionExplanation,
  source: TransactionAuditRecord["metadata"]["source"]
): string {
  const verdictPayload = {
    status,
    riskLevel: verdict.riskLevel,
    reasonCodes: verdict.reasonCodes,
    matchedRules: verdict.matchedRules,
    evidence: verdict.evidence,
    ruleSetVersion: verdict.ruleSetVersion,
    explanation,
    ...(!("feedVersion" in verdict) || verdict.feedVersion === undefined
      ? {}
      : { feedVersion: verdict.feedVersion }),
    ...(hasTransactionExplanation(verdict)
      ? {
          intelVersions: verdict.intelVersions,
          overrideAllowed: verdict.overrideAllowed,
          overrideLevel: verdict.overrideLevel,
          primaryReason: verdict.primaryReason,
          primaryRuleId: verdict.primaryRuleId,
          secondaryReasons: verdict.secondaryReasons,
        }
      : {}),
  };

  return sha256Hex(
    serializeCanonicalJson(
      toCanonicalJsonValue({
        transaction: ctx,
        verdict: verdictPayload,
        metadata: {
          source,
        },
      })
    )
  );
}

export function createAuditRecord(
  ctx: NormalizedTransactionContext,
  verdict: Verdict
): TransactionAuditRecord;
export function createAuditRecord(
  ctx: NormalizedTransactionContext,
  verdict: Omit<TransactionVerdict, "audit">
): TransactionAuditRecord;
export function createAuditRecord(
  ctx: NormalizedTransactionContext,
  verdict: TransactionVerdict
): TransactionAuditRecord;
export function createAuditRecord(
  ctx: NormalizedTransactionContext,
  verdict: TransactionAuditVerdictInput
): TransactionAuditRecord {
  const status = toAuditStatus(verdict.status);
  const explanation = cloneCanonical(resolveExplanation(ctx, verdict));
  const signals = cloneCanonical(ctx.signals);
  const classification = cloneCanonical(ctx.riskClassification);
  const source = inferAuditSource(ctx);

  return {
    id: buildAuditId(ctx, verdict, status, explanation, source),
    timestamp: new Date().toISOString(),
    status,
    explanation,
    signals,
    classification,
    metadata: {
      source,
    },
  };
}
