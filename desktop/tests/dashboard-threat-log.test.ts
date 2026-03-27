import { describe, expect, it } from "vitest";
import { validateLayer4ThreatLogPayload } from "../src/dashboard/layer4Runtime";
import {
  buildThreatLogState,
  createEmptyThreatLogState,
} from "../src/dashboard/threatLog";
import {
  createThreatSystemStatus,
  createWalletLayer4Report,
} from "./helpers/dashboardFixtures";

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

describe("dashboard Layer 4 threat log integration", () => {
  it("maps a Layer 4 output into a scan_result threat log entry without mutating it", () => {
    const report = createWalletLayer4Report({
      findingSpecs: [
        { code: "ALLOWANCE_UNLIMITED", findingId: "finding:wallet-report-1:1" },
        { findingId: "finding:wallet-report-1:2" },
      ],
    });
    const reportSnapshot = structuredClone(report);
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
