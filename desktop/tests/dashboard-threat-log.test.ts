import { describe, expect, it } from "vitest";
import {
  DEFAULT_LAYER4_RUNTIME_INVALID_CODE,
  ingestLayer4RuntimeReports,
  validateLayer4ThreatLogPayload,
} from "../src/dashboard/layer4Runtime";
import {
  buildThreatLogState,
  createEmptyThreatLogState,
} from "../src/dashboard/threatLog";
import {
  createThreatSystemStatus,
  createWalletLayer4Report,
} from "./helpers/dashboardFixtures";

const WALLET_LAYER4_OUTPUT_EVENT = "clickshield:wallet-layer4-output";

describe("dashboard Layer 4 runtime validator", () => {
  it("accepts a canonical payload and preserves exact Layer 4 truth fields without mutating input", () => {
    const report = createWalletLayer4Report({
      findingSpecs: [
        { code: "ALLOWANCE_UNLIMITED", findingId: "finding:wallet-report-1:1" },
        { findingId: "finding:wallet-report-1:2" },
      ],
    });
    const reportSnapshot = structuredClone(report);

    const validation = validateLayer4ThreatLogPayload(report);

    expect(validation).toEqual({
      ok: true,
      value: {
        reportId: report.reportId,
        generatedAt: report.generatedAt,
        request: {
          walletChain: report.request.walletChain,
          walletAddress: report.request.walletAddress,
          networkId: report.request.networkId,
          scanMode: report.request.scanMode,
        },
        result: {
          classification: report.result.classification,
          statusLabel: report.result.statusLabel,
          executionPerformed: report.result.executionPerformed,
          findings: [
            {
              reasonCode: "ALLOWANCE_UNLIMITED",
              title: report.result.findings[0]?.title ?? "",
              summary: report.result.findings[0]?.summary ?? "",
            },
            {
              reasonCode: "finding:wallet-report-1:2",
              title: report.result.findings[1]?.title ?? "",
              summary: report.result.findings[1]?.summary ?? "",
            },
          ],
        },
        summary: {
          findingCount: report.summary.findingCount,
          openFindingCount: report.summary.openFindingCount,
          actionableFindingCount: report.summary.actionableFindingCount,
          cleanupActionCount: report.summary.cleanupActionCount,
        },
      },
    });
    expect(report).toEqual(reportSnapshot);
  });

  it("fails deterministically for an invalid payload", () => {
    const report = createWalletLayer4Report();
    const invalidReport = {
      ...report,
      result: {
        ...report.result,
        statusLabel: "   ",
      },
    };

    expect(validateLayer4ThreatLogPayload(invalidReport)).toEqual({
      ok: false,
      code: "invalid_layer4_status_label",
    });
    expect(validateLayer4ThreatLogPayload(invalidReport)).toEqual({
      ok: false,
      code: "invalid_layer4_status_label",
    });
  });
});

describe("dashboard Layer 4 runtime ingestion", () => {
  it("rejects invalid persisted payloads while keeping valid load-path payloads", () => {
    const validReport = createWalletLayer4Report({
      reportId: "wallet-report-load-valid",
      generatedAt: "2026-03-26T12:20:00.000Z",
    });
    const invalidReport = createWalletLayer4Report({
      reportId: "wallet-report-load-invalid",
      generatedAt: "2026-03-26T12:21:00.000Z",
      findingSpecs: [{ findingId: "   " }],
    });
    const persistedPayload = JSON.parse(
      JSON.stringify([validReport, invalidReport]),
    ) as unknown;

    const ingestion = ingestLayer4RuntimeReports({
      previousReports: [],
      input: persistedPayload,
    });
    const state = buildThreatLogState({
      previousState: createEmptyThreatLogState(),
      scans: [],
      layer4Reports: ingestion.reports,
      scanHistoryTruthState: "unknown",
      systemStatus: createThreatSystemStatus(),
      manifest: null,
      engine: null,
      healthSnapshot: null,
      referenceTime: null,
    });

    expect(ingestion.invalidCode).toBe("invalid_layer4_reason_code");
    expect(ingestion.reports).toEqual([validReport]);
    expect(state.entries.filter((entry) => entry.layer === "layer4").map((entry) => entry.reportId)).toEqual([
      validReport.reportId,
    ]);
  });

  it("appends valid runtime events and blocks invalid runtime events on the App event path", () => {
    const existingReport = createWalletLayer4Report({
      reportId: "wallet-report-runtime-existing",
      generatedAt: "2026-03-26T12:05:00.000Z",
    });
    const validEventReport = createWalletLayer4Report({
      reportId: "wallet-report-runtime-valid",
      generatedAt: "2026-03-26T12:30:00.000Z",
      findingSpecs: [
        { code: "ALLOWANCE_UNLIMITED", findingId: "finding:wallet-report-runtime-valid:1" },
        { findingId: "finding:wallet-report-runtime-valid:2" },
      ],
    });
    const invalidEventReport = createWalletLayer4Report({
      reportId: "wallet-report-runtime-invalid",
      generatedAt: "2026-03-26T12:31:00.000Z",
      findingSpecs: [{ findingId: "   " }],
    });

    const runtimeTarget = new EventTarget();
    let reports = [existingReport];
    let invalidCode = DEFAULT_LAYER4_RUNTIME_INVALID_CODE;

    const handleWalletLayer4Output = (event: Event) => {
      const ingestion = ingestLayer4RuntimeReports({
        previousReports: reports,
        input: (event as CustomEvent<unknown>).detail,
      });
      reports = ingestion.reports;
      invalidCode = ingestion.invalidCode;
    };

    runtimeTarget.addEventListener(
      WALLET_LAYER4_OUTPUT_EVENT,
      handleWalletLayer4Output as EventListener,
    );

    try {
      runtimeTarget.dispatchEvent(
        new CustomEvent(WALLET_LAYER4_OUTPUT_EVENT, {
          detail: { report: validEventReport },
        }),
      );
      expect(invalidCode).toBe(DEFAULT_LAYER4_RUNTIME_INVALID_CODE);
      expect(reports).toEqual([validEventReport, existingReport]);

      const reportsSnapshot = structuredClone(reports);
      runtimeTarget.dispatchEvent(
        new CustomEvent(WALLET_LAYER4_OUTPUT_EVENT, {
          detail: { report: invalidEventReport },
        }),
      );

      expect(invalidCode).toBe("invalid_layer4_reason_code");
      expect(reports).toEqual(reportsSnapshot);
    } finally {
      runtimeTarget.removeEventListener(
        WALLET_LAYER4_OUTPUT_EVENT,
        handleWalletLayer4Output as EventListener,
      );
    }
  });

  it("stays deterministic across repeated runtime ingestion for the same report id", () => {
    const report = createWalletLayer4Report({
      reportId: "wallet-report-runtime-repeat",
      generatedAt: "2026-03-26T12:30:00.000Z",
    });

    const firstIngestion = ingestLayer4RuntimeReports({
      previousReports: [],
      input: { reports: [report] },
    });
    const secondIngestion = ingestLayer4RuntimeReports({
      previousReports: firstIngestion.reports,
      input: { reports: [report] },
    });

    expect(firstIngestion.invalidCode).toBe(DEFAULT_LAYER4_RUNTIME_INVALID_CODE);
    expect(secondIngestion.invalidCode).toBe(DEFAULT_LAYER4_RUNTIME_INVALID_CODE);
    expect(secondIngestion.reports).toEqual(firstIngestion.reports);
  });
});

describe("dashboard Layer 4 threat log integration", () => {
  it("maps a Layer 4 output into a scan_result threat log entry without mutating it", () => {
    const report = createWalletLayer4Report({
      findingSpecs: [
        { code: "ALLOWANCE_UNLIMITED", findingId: "finding:wallet-report-1:1" },
        { findingId: "finding:wallet-report-1:2" },
      ],
    });
    const reportSnapshot = structuredClone(report);
    const ingestion = ingestLayer4RuntimeReports({
      previousReports: [],
      input: report,
    });
    const state = buildThreatLogState({
      previousState: null,
      scans: [],
      layer4Reports: ingestion.reports,
      scanHistoryTruthState: "unknown",
      systemStatus: createThreatSystemStatus(),
      manifest: null,
      engine: null,
      healthSnapshot: null,
      referenceTime: null,
    });

    const entry = state.entries.find((candidate) => candidate.reportId === report.reportId);

    expect(ingestion.invalidCode).toBe(DEFAULT_LAYER4_RUNTIME_INVALID_CODE);
    expect(entry).toMatchObject({
      eventKind: "scan_result",
      layer: "layer4",
      decision: "scan_result",
      surface: "desktop",
      sourceSurface: "desktop",
      summary: report.result.statusLabel,
      severity: report.result.classification,
      targetLabel: report.request.walletAddress,
      reportId: report.reportId,
      statusTruth: "available",
    });
    expect(entry?.reasonCodes).toEqual([
      "ALLOWANCE_UNLIMITED",
      "finding:wallet-report-1:2",
    ]);
    expect(report).toEqual(reportSnapshot);
    expect(entry?.evidencePreview).toContain(
      `Wallet address: ${report.request.walletAddress}.`,
    );
  });

  it("keeps prior Layer 4 entries append-only when a new report arrives", () => {
    const firstReport = createWalletLayer4Report({
      reportId: "wallet-report-1",
      generatedAt: "2026-03-26T12:05:00.000Z",
    });
    const secondReport = createWalletLayer4Report({
      reportId: "wallet-report-2",
      generatedAt: "2026-03-26T12:10:00.000Z",
    });

    const firstState = buildThreatLogState({
      previousState: createEmptyThreatLogState(),
      scans: [],
      layer4Reports: [firstReport],
      scanHistoryTruthState: "unknown",
      systemStatus: createThreatSystemStatus(),
      manifest: null,
      engine: null,
      healthSnapshot: null,
      referenceTime: null,
    });
    const originalEntryIds = firstState.entries.map((entry) => entry.id);

    const secondState = buildThreatLogState({
      previousState: firstState,
      scans: [],
      layer4Reports: [secondReport],
      scanHistoryTruthState: "unknown",
      systemStatus: createThreatSystemStatus(),
      manifest: null,
      engine: null,
      healthSnapshot: null,
      referenceTime: null,
    });

    expect(firstState.entries.map((entry) => entry.id)).toEqual(originalEntryIds);
    expect(
      secondState.entries
        .filter((entry) => entry.layer === "layer4")
        .map((entry) => entry.reportId),
    ).toEqual([secondReport.reportId, firstReport.reportId]);
  });

  it("preserves Layer 4 classification exactly as severity", () => {
    const report = createWalletLayer4Report({
      reportId: "wallet-report-manual-action",
      classification: "manual_action_required",
      cleanupActionCount: 0,
      statusLabel: "Scan completed. Issues detected. Manual action required.",
    });

    const state = buildThreatLogState({
      previousState: null,
      scans: [],
      layer4Reports: [report],
      scanHistoryTruthState: "unknown",
      systemStatus: createThreatSystemStatus(),
      manifest: null,
      engine: null,
      healthSnapshot: null,
      referenceTime: null,
    });

    const entry = state.entries.find((candidate) => candidate.reportId === report.reportId);

    expect(entry?.severity).toBe(report.result.classification);
  });

  it("stays deterministic across repeated runs with the same Layer 4 report id", () => {
    const report = createWalletLayer4Report({
      reportId: "wallet-report-repeat",
      generatedAt: "2026-03-26T12:15:00.000Z",
    });

    const firstState = buildThreatLogState({
      previousState: createEmptyThreatLogState(),
      scans: [],
      layer4Reports: [report],
      scanHistoryTruthState: "unknown",
      systemStatus: createThreatSystemStatus(),
      manifest: null,
      engine: null,
      healthSnapshot: null,
      referenceTime: null,
    });
    const secondState = buildThreatLogState({
      previousState: firstState,
      scans: [],
      layer4Reports: [report],
      scanHistoryTruthState: "unknown",
      systemStatus: createThreatSystemStatus(),
      manifest: null,
      engine: null,
      healthSnapshot: null,
      referenceTime: null,
    });

    expect(secondState.entries).toEqual(firstState.entries);
  });

  it("fails safe by skipping an invalid Layer 4 payload without appending an entry", () => {
    const report = createWalletLayer4Report({
      reportId: "wallet-report-invalid",
      findingSpecs: [{ findingId: "   " }],
    });

    const state = buildThreatLogState({
      previousState: createEmptyThreatLogState(),
      scans: [],
      layer4Reports: [report],
      scanHistoryTruthState: "unknown",
      systemStatus: createThreatSystemStatus(),
      manifest: null,
      engine: null,
      healthSnapshot: null,
      referenceTime: null,
    });

    expect(validateLayer4ThreatLogPayload(report)).toEqual({
      ok: false,
      code: "invalid_layer4_reason_code",
    });
    expect(state.entries.filter((entry) => entry.layer === "layer4")).toEqual([]);
  });
});
