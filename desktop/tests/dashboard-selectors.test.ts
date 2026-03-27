import { describe, expect, it } from "vitest";
import { buildThreatDashboardViewModel } from "../src/dashboard/selectors";
import { buildThreatLogState } from "../src/dashboard/threatLog";
import {
  createLayer3ScanSource,
  createThreatSystemStatus,
  createWalletLayer4Report,
  DEFAULT_DASHBOARD_FILTERS,
} from "./helpers/dashboardFixtures";

describe("dashboard Layer 4 selectors", () => {
  it("includes Layer 4 scan results in the feed while keeping Layer 3 distinct", () => {
    const layer4Report = createWalletLayer4Report({
      generatedAt: "2026-03-26T12:05:00.000Z",
    });
    const threatLog = buildThreatLogState({
      previousState: null,
      scans: [
        createLayer3ScanSource({
          checkedAt: "2026-03-26T12:00:00.000Z",
        }),
      ],
      layer4Reports: [layer4Report],
      scanHistoryTruthState: "available",
      systemStatus: createThreatSystemStatus(),
      manifest: null,
      engine: null,
      healthSnapshot: null,
      referenceTime: null,
    });

    const view = buildThreatDashboardViewModel({
      threatLog,
      filters: DEFAULT_DASHBOARD_FILTERS,
      hiddenEntryIds: [],
      selectedEntryId: null,
      referenceTime: null,
      isLoading: false,
    });

    const layer3Entry = view.filteredEntries.find((entry) => entry.layer === "layer3");
    const layer4Entry = view.filteredEntries.find((entry) => entry.layer === "layer4");

    expect(layer3Entry?.eventKind).toBe("transaction_decision");
    expect(layer3Entry?.decision).toBe("blocked");
    expect(layer4Entry?.eventKind).toBe("scan_result");
    expect(layer4Entry?.decision).toBe("scan_result");
    expect(layer4Entry?.severity).toBe(layer4Report.result.classification);
    expect(view.summary.layerBreakdown.layer3).toBe(1);
    expect(view.summary.layerBreakdown.layer4).toBe(1);
    expect(view.summary.scansRun).toBe(1);
    expect(view.summary.eventKindBreakdown.scan_result).toBe(1);
  });

  it("filters Layer 4 scan results and preserves report details in the details view", () => {
    const layer4Report = createWalletLayer4Report({
      reportId: "wallet-report-details",
      generatedAt: "2026-03-26T12:10:00.000Z",
      classification: "manual_action_required",
    });
    const threatLog = buildThreatLogState({
      previousState: null,
      scans: [
        createLayer3ScanSource({
          checkedAt: "2026-03-26T12:00:00.000Z",
        }),
      ],
      layer4Reports: [layer4Report],
      scanHistoryTruthState: "available",
      systemStatus: createThreatSystemStatus(),
      manifest: null,
      engine: null,
      healthSnapshot: null,
      referenceTime: null,
    });

    const view = buildThreatDashboardViewModel({
      threatLog,
      filters: {
        ...DEFAULT_DASHBOARD_FILTERS,
        severity: layer4Report.result.classification,
      },
      hiddenEntryIds: [],
      selectedEntryId: null,
      referenceTime: null,
      isLoading: false,
    });

    expect(view.filteredEntries).toHaveLength(1);
    expect(view.filteredEntries[0]?.reportId).toBe(layer4Report.reportId);
    expect(view.selectedDetails?.summary).toBe(layer4Report.result.statusLabel);
    expect(view.selectedDetails?.severity).toBe(layer4Report.result.classification);
    expect(view.selectedDetails?.evidencePreview).toContain(
      "Finding: Unlimited approval. Approval allows an unlimited third-party spend.",
    );
  });

  it("returns deterministic selector output for the same threat log input", () => {
    const layer4Report = createWalletLayer4Report({
      reportId: "wallet-report-repeat-view",
      generatedAt: "2026-03-26T12:15:00.000Z",
    });
    const threatLog = buildThreatLogState({
      previousState: null,
      scans: [
        createLayer3ScanSource({
          checkedAt: "2026-03-26T12:00:00.000Z",
        }),
      ],
      layer4Reports: [layer4Report],
      scanHistoryTruthState: "available",
      systemStatus: createThreatSystemStatus(),
      manifest: null,
      engine: null,
      healthSnapshot: null,
      referenceTime: null,
    });

    const firstView = buildThreatDashboardViewModel({
      threatLog,
      filters: DEFAULT_DASHBOARD_FILTERS,
      hiddenEntryIds: [],
      selectedEntryId: null,
      referenceTime: "2026-03-26T12:20:00.000Z",
      isLoading: false,
    });
    const secondView = buildThreatDashboardViewModel({
      threatLog,
      filters: DEFAULT_DASHBOARD_FILTERS,
      hiddenEntryIds: [],
      selectedEntryId: null,
      referenceTime: "2026-03-26T12:20:00.000Z",
      isLoading: false,
    });

    expect(firstView.filteredEntries.map((entry) => entry.id)).toEqual(
      secondView.filteredEntries.map((entry) => entry.id),
    );
    expect(firstView.summary).toEqual(secondView.summary);
    expect(firstView.selectedDetails).toEqual(secondView.selectedDetails);
  });
});
