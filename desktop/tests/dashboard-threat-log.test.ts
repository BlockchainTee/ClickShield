import { describe, expect, it } from "vitest";
import {
  buildThreatLogState,
  createEmptyThreatLogState,
} from "../src/dashboard/threatLog";
import {
  createThreatSystemStatus,
  createWalletLayer4Report,
} from "./helpers/dashboardFixtures";

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
});
