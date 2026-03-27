import type {
  WalletLayer4Output,
  WalletReportClassification,
} from "../lib/shared-rules";

const VALID_LAYER4_CLASSIFICATIONS: readonly WalletReportClassification[] = [
  "no_issues_detected",
  "issues_detected",
  "manual_action_required",
  "execution_reported",
];

type UnknownRecord = Record<string, unknown>;

function isWalletLayer4Output(value: unknown): value is WalletLayer4Output {
  if (!isRecord(value)) {
    return false;
  }

  const request = isRecord(value.request) ? value.request : null;
  const result = isRecord(value.result) ? value.result : null;
  const summary = isRecord(value.summary) ? value.summary : null;

  return (
    typeof value.reportId === "string" &&
    typeof value.generatedAt === "string" &&
    request !== null &&
    typeof request.walletAddress === "string" &&
    typeof request.walletChain === "string" &&
    typeof request.scanMode === "string" &&
    result !== null &&
    typeof result.statusLabel === "string" &&
    typeof result.classification === "string" &&
    Array.isArray(result.findings) &&
    summary !== null &&
    typeof summary.statusLabel === "string"
  );
}

export type ThreatLayer4ValidationErrorCode =
  | "invalid_layer4_payload"
  | "invalid_layer4_request"
  | "invalid_layer4_result"
  | "invalid_layer4_status_label"
  | "invalid_layer4_classification"
  | "invalid_layer4_findings"
  | "invalid_layer4_reason_code"
  | "invalid_layer4_summary";

export interface ValidatedThreatLayer4Finding {
  readonly reasonCode: string;
  readonly title: string;
  readonly summary: string;
}

export interface ValidatedThreatLayer4Payload {
  readonly reportId: string;
  readonly generatedAt: string;
  readonly request: {
    readonly walletChain: string;
    readonly walletAddress: string;
    readonly networkId: string;
    readonly scanMode: string;
  };
  readonly result: {
    readonly classification: WalletReportClassification;
    readonly statusLabel: string;
    readonly executionPerformed: boolean;
    readonly findings: readonly ValidatedThreatLayer4Finding[];
  };
  readonly summary: {
    readonly findingCount: number;
    readonly openFindingCount: number;
    readonly actionableFindingCount: number;
    readonly cleanupActionCount: number;
  };
}

export type ThreatLayer4ValidationResult =
  | {
      readonly ok: true;
      readonly value: ValidatedThreatLayer4Payload;
    }
  | {
      readonly ok: false;
      readonly code: ThreatLayer4ValidationErrorCode;
    };

export const DEFAULT_LAYER4_RUNTIME_INVALID_CODE: ThreatLayer4ValidationErrorCode =
  "invalid_layer4_payload";

export interface Layer4RuntimeIngestionResult {
  readonly reports: WalletLayer4Output[];
  readonly invalidCode: ThreatLayer4ValidationErrorCode;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function readUsableString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readNonNegativeNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function isWalletReportClassification(value: unknown): value is WalletReportClassification {
  return (
    typeof value === "string" &&
    VALID_LAYER4_CLASSIFICATIONS.includes(value as WalletReportClassification)
  );
}

function buildInvalidResult(
  code: ThreatLayer4ValidationErrorCode,
): ThreatLayer4ValidationResult {
  return { ok: false, code };
}

function readWalletLayer4Outputs(value: unknown): WalletLayer4Output[] {
  if (Array.isArray(value)) {
    return value.filter(isWalletLayer4Output);
  }

  if (isWalletLayer4Output(value)) {
    return [value];
  }

  if (!isRecord(value)) {
    return [];
  }

  if (Array.isArray(value.reports)) {
    return value.reports.filter(isWalletLayer4Output);
  }

  return isWalletLayer4Output(value.report) ? [value.report] : [];
}

function dedupeLayer4ReportsKeepNewest(
  reports: readonly WalletLayer4Output[],
): WalletLayer4Output[] {
  const byId = new Map<string, WalletLayer4Output>();

  for (const report of reports) {
    if (!report.reportId) {
      continue;
    }

    const existing = byId.get(report.reportId);
    if (!existing) {
      byId.set(report.reportId, report);
      continue;
    }

    const existingTimestamp = new Date(existing.generatedAt).getTime();
    const nextTimestamp = new Date(report.generatedAt).getTime();
    if (!Number.isFinite(existingTimestamp) || !Number.isFinite(nextTimestamp) || nextTimestamp >= existingTimestamp) {
      byId.set(report.reportId, report);
    }
  }

  return Array.from(byId.values()).sort((left, right) => {
    const timestampDelta =
      new Date(right.generatedAt).getTime() - new Date(left.generatedAt).getTime();
    if (timestampDelta !== 0) {
      return timestampDelta;
    }

    return left.reportId.localeCompare(right.reportId);
  });
}

function validateThreatLayer4Finding(
  input: unknown,
): ValidatedThreatLayer4Finding | ThreatLayer4ValidationErrorCode {
  if (!isRecord(input)) {
    return "invalid_layer4_findings";
  }

  const title = readUsableString(input.title);
  const summary = readUsableString(input.summary);
  if (!title || !summary) {
    return "invalid_layer4_findings";
  }

  const findingId = readUsableString(input.findingId);
  const metadata = isRecord(input.metadata) ? input.metadata : null;
  const metadataCode = metadata ? readUsableString(metadata.code) : null;
  const reasonCode = metadataCode ?? findingId;

  if (!reasonCode) {
    return "invalid_layer4_reason_code";
  }

  return {
    reasonCode,
    title,
    summary,
  };
}

/**
 * Validates the canonical desktop Layer 4 payload shape and returns the exact
 * downstream truth fields needed by the dashboard without mutating input.
 */
export function validateLayer4ThreatLogPayload(
  input: unknown,
): ThreatLayer4ValidationResult {
  if (!isRecord(input)) {
    return buildInvalidResult("invalid_layer4_payload");
  }

  const reportId = readUsableString(input.reportId);
  const generatedAt = readUsableString(input.generatedAt);
  if (!reportId || !generatedAt) {
    return buildInvalidResult("invalid_layer4_payload");
  }

  const request = isRecord(input.request) ? input.request : null;
  if (!request) {
    return buildInvalidResult("invalid_layer4_request");
  }

  const walletChain = readUsableString(request.walletChain);
  const walletAddress = readUsableString(request.walletAddress);
  const networkId = readUsableString(request.networkId);
  const scanMode = readUsableString(request.scanMode);
  if (!walletChain || !walletAddress || !networkId || !scanMode) {
    return buildInvalidResult("invalid_layer4_request");
  }

  const result = isRecord(input.result) ? input.result : null;
  if (!result) {
    return buildInvalidResult("invalid_layer4_result");
  }

  const statusLabel = readUsableString(result.statusLabel);
  if (!statusLabel) {
    return buildInvalidResult("invalid_layer4_status_label");
  }

  const classification = result.classification;
  if (!isWalletReportClassification(classification)) {
    return buildInvalidResult("invalid_layer4_classification");
  }

  if (typeof result.executionPerformed !== "boolean") {
    return buildInvalidResult("invalid_layer4_result");
  }

  if (!Array.isArray(result.findings)) {
    return buildInvalidResult("invalid_layer4_findings");
  }

  const findings: ValidatedThreatLayer4Finding[] = [];
  for (const finding of result.findings) {
    const validatedFinding = validateThreatLayer4Finding(finding);
    if (typeof validatedFinding === "string") {
      return buildInvalidResult(validatedFinding);
    }
    findings.push(validatedFinding);
  }

  const summary = isRecord(input.summary) ? input.summary : null;
  if (!summary) {
    return buildInvalidResult("invalid_layer4_summary");
  }

  const findingCount = readNonNegativeNumber(summary.findingCount);
  const openFindingCount = readNonNegativeNumber(summary.openFindingCount);
  const actionableFindingCount = readNonNegativeNumber(summary.actionableFindingCount);
  const cleanupActionCount = readNonNegativeNumber(summary.cleanupActionCount);
  if (
    findingCount === null ||
    openFindingCount === null ||
    actionableFindingCount === null ||
    cleanupActionCount === null
  ) {
    return buildInvalidResult("invalid_layer4_summary");
  }

  return {
    ok: true,
    value: {
      reportId,
      generatedAt,
      request: {
        walletChain,
        walletAddress,
        networkId,
        scanMode,
      },
      result: {
        classification,
        statusLabel,
        executionPerformed: result.executionPerformed,
        findings: Object.freeze(findings),
      },
      summary: {
        findingCount,
        openFindingCount,
        actionableFindingCount,
        cleanupActionCount,
      },
    },
  };
}

/**
 * Applies the 5D-1 validator at the desktop runtime ingestion boundary so
 * invalid Layer 4 payloads are rejected before they reach live history.
 */
export function ingestLayer4RuntimeReports(params: {
  readonly previousReports: readonly WalletLayer4Output[];
  readonly input: unknown;
}): Layer4RuntimeIngestionResult {
  const candidates = readWalletLayer4Outputs(params.input);
  if (candidates.length === 0) {
    return {
      reports: [...params.previousReports],
      invalidCode: DEFAULT_LAYER4_RUNTIME_INVALID_CODE,
    };
  }

  let invalidCode = DEFAULT_LAYER4_RUNTIME_INVALID_CODE;
  const validReports: WalletLayer4Output[] = [];

  for (const report of candidates) {
    const validation = validateLayer4ThreatLogPayload(report);
    if (!validation.ok) {
      if (invalidCode === DEFAULT_LAYER4_RUNTIME_INVALID_CODE) {
        invalidCode = validation.code;
      }
      continue;
    }

    validReports.push(report);
  }

  if (validReports.length === 0) {
    return {
      reports: [...params.previousReports],
      invalidCode,
    };
  }

  return {
    reports: dedupeLayer4ReportsKeepNewest([...validReports, ...params.previousReports]),
    invalidCode,
  };
}
