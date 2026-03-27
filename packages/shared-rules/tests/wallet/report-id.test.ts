import { describe, expect, it } from "vitest";

import { buildWalletReportId } from "../../src/index.js";
import type {
  EvmCleanupAction,
  EvmWalletCleanupPlan,
  WalletCleanupActionResult,
  WalletCleanupExecutionResult,
  WalletEvidenceRef,
  WalletFinding,
  WalletReportIdInput,
  WalletRiskFactor,
  WalletScanMode,
  WalletScanRequest,
  WalletScanResult,
  WalletScanSnapshot,
  WalletSnapshotSection,
  WalletSummary,
} from "../../src/index.js";

function createReportIdInput(): WalletReportIdInput {
  const evidence: WalletEvidenceRef = {
    evidenceId: "evidence_1",
    label: "Balances section",
    sourceId: "section_balances",
    sourceType: "snapshot_section",
  };

  const request: WalletScanRequest = {
    requestId: "request_1",
    walletChain: "evm",
    walletAddress: "0x1111111111111111111111111111111111111111",
    networkId: "1",
    scanMode: "full",
    requestedAt: "2026-03-23T10:00:00.000Z",
    metadata: {
      actor: "audit",
      source: "test",
    },
  };

  const section: WalletSnapshotSection = {
    sectionId: "section_balances",
    sectionType: "balances",
    label: "Token balances",
    itemCount: 2,
    contentHash: "hash_balances",
    metadata: {
      freshness: "fresh",
    },
  };

  const snapshot: WalletScanSnapshot = {
    snapshotId: "snapshot_1",
    requestId: request.requestId,
    walletChain: request.walletChain,
    walletAddress: request.walletAddress,
    networkId: request.networkId,
    capturedAt: "2026-03-23T10:01:00.000Z",
    sections: [section],
    metadata: {
      sourceVersion: "v1",
    },
  };

  const finding: WalletFinding = {
    findingId: "finding_1",
    walletChain: request.walletChain,
    category: "authorization",
    riskLevel: "high",
    status: "open",
    title: "High-risk approval",
    summary: "Approval should be reviewed.",
    detectedAt: "2026-03-23T10:02:00.000Z",
    resourceIds: ["approval_1"],
    riskFactorIds: ["factor_1"],
    cleanupActionIds: ["action_1"],
    evidence: [evidence],
    metadata: {
      protocol: "example",
    },
  };

  const riskFactor: WalletRiskFactor = {
    factorId: "factor_1",
    walletChain: request.walletChain,
    category: "authorization",
    riskLevel: "high",
    title: "Approval exposure",
    summary: "An approval remains active.",
    findingIds: [finding.findingId],
    resourceIds: ["approval_1"],
    metadata: {
      family: "spender",
    },
  };

  const cleanupAction: EvmCleanupAction = {
    ...({
      revocationMethod: "erc20_approve_zero",
      approval: {
        approvalId: "approval_1",
        approvalKind: "erc20_allowance",
        tokenAddress: "0x2222222222222222222222222222222222222222",
        spenderAddress: "0x3333333333333333333333333333333333333333",
        tokenId: null,
        currentState: "1000",
        intendedState: "0",
      },
      estimatedRiskReduction: "high",
      explanation: "Revokes the active ERC-20 allowance and still requires a later re-scan.",
    } satisfies Pick<
      EvmCleanupAction,
      "approval" | "estimatedRiskReduction" | "explanation" | "revocationMethod"
    >),
    actionId: "action_1",
    walletChain: request.walletChain,
    kind: "revoke_authorization",
    executionMode: "guided",
    executionType: "wallet_signature",
    status: "ready",
    requiresSignature: true,
    supportStatus: "supported",
    title: "Review and revoke approval",
    description: "Review approval details and revoke if unnecessary.",
    priority: "high",
    target: {
      targetId: "target_1",
      targetKind: "authorization",
      label: "Allowance target",
      metadata: {
        protocol: "example",
      },
    },
    findingIds: [finding.findingId],
    riskFactorIds: [riskFactor.factorId],
    supportDetail: "Prepared revoke payload requires explicit wallet signature outside this layer.",
    metadata: {
      channel: "guide",
    },
  };

  const cleanupPlan: EvmWalletCleanupPlan = {
    planId: "plan_1",
    walletChain: request.walletChain,
    walletAddress: request.walletAddress,
    networkId: request.networkId,
    createdAt: "2026-03-23T10:03:00.000Z",
    summary: "Review high-risk authorizations first.",
    actions: [cleanupAction],
    batches: [
      {
        batchId: "batch_1",
        walletChain: request.walletChain,
        walletAddress: request.walletAddress,
        networkId: request.networkId,
        createdAt: "2026-03-23T10:03:00.000Z",
        supportStatus: "partial",
        executionKind: "multiple_transactions",
        title: "Review grouped revokes",
        summary: "Grouped review batch for deterministic revoke actions.",
        actionIds: [cleanupAction.actionId],
        actions: [cleanupAction],
      },
    ],
    projectedScore: 18,
    projectedRiskLevel: "low",
  };

  const result: WalletScanResult = {
    requestId: request.requestId,
    snapshotId: snapshot.snapshotId,
    walletChain: request.walletChain,
    walletAddress: request.walletAddress,
    networkId: request.networkId,
    evaluatedAt: "2026-03-23T10:04:00.000Z",
    findings: [finding],
    riskFactors: [riskFactor],
    scoreBreakdown: {
      totalScore: 72,
      riskLevel: "high",
      rationale: "Open approval exposure increases risk.",
      components: [
        {
          componentId: "component_1",
          label: "Authorization risk",
          score: 72,
          maxScore: 100,
          riskLevel: "high",
          rationale: "Single high-risk approval remains active.",
          findingIds: [finding.findingId],
          riskFactorIds: [riskFactor.factorId],
        },
      ],
    },
    cleanupPlan,
    capabilityTier: request.scanMode,
    executionPerformed: false,
    actionable: true,
    classification: "issues_detected",
    statusLabel: "Scan completed. Issues detected. Follow-up action is available.",
    capabilityBoundaries: [
      {
        boundaryId: "boundary_1",
        area: "cleanup_execution",
        capabilityKey: "revoke_authorization",
        status: "partial",
        detail: "Phase 4A models execution boundaries only.",
      },
    ],
  };

  const summary: WalletSummary = {
    walletChain: request.walletChain,
    walletAddress: request.walletAddress,
    networkId: request.networkId,
    scanMode: request.scanMode,
    generatedAt: "2026-03-23T10:05:00.000Z",
    snapshotCapturedAt: snapshot.capturedAt,
    capabilityTier: request.scanMode,
    score: 72,
    riskLevel: "high",
    findingCount: 1,
    openFindingCount: 1,
    cleanupActionCount: 1,
    actionableFindingCount: 1,
    executionPerformed: false,
    actionable: true,
    classification: "issues_detected",
    statusLabel: "Scan completed. Issues detected. Follow-up action is available.",
  };

  const cleanupExecution: WalletCleanupExecutionResult = {
    planId: cleanupPlan.planId,
    walletChain: request.walletChain,
    walletAddress: request.walletAddress,
    networkId: request.networkId,
    status: "not_started",
    startedAt: null,
    completedAt: null,
    actionResults: [
      {
        actionId: cleanupAction.actionId,
        status: "pending",
        executedAt: null,
        detail: "Awaiting user confirmation.",
        evidence: [evidence],
      },
    ],
  };

  return {
    reportVersion: "1",
    generatedAt: "2026-03-23T10:05:00.000Z",
    request,
    snapshot,
    result,
    summary,
    cleanupExecution,
  };
}

function createBasicOnlyReportIdInput(
  walletChain: "solana" | "bitcoin",
  scanMode: WalletScanMode = "basic"
): WalletReportIdInput {
  const request: WalletScanRequest = {
    requestId: `request_${walletChain}_1`,
    walletChain,
    walletAddress:
      walletChain === "solana"
        ? "5D6xPj5vXvGkGEXUXMaLLq5yRvCNr4CemGYGAaHo9dZY"
        : "bc1qclickshieldmainwallet000000000000000000000",
    networkId: walletChain === "solana" ? "mainnet-beta" : "bitcoin-mainnet",
    scanMode,
    requestedAt: "2026-03-23T10:00:00.000Z",
    metadata: {
      source: "test",
    },
  };

  const snapshot: WalletScanSnapshot = {
    snapshotId: `snapshot_${walletChain}_1`,
    requestId: request.requestId,
    walletChain,
    walletAddress: request.walletAddress,
    networkId: request.networkId,
    capturedAt: "2026-03-23T10:01:00.000Z",
    sections: [
      {
        sectionId: `section_${walletChain}_1`,
        sectionType: `${walletChain}_snapshot`,
        label: `${walletChain} snapshot`,
        itemCount: 1,
        contentHash: `hash_${walletChain}`,
        metadata: {},
      },
    ],
    metadata: {
      sourceVersion: "v1",
    },
  };

  const finding: WalletFinding = {
    findingId: `finding_${walletChain}_1`,
    walletChain,
    category: "authorization",
    riskLevel: "medium",
    status: "open",
    title: `${walletChain} review required`,
    summary: `${walletChain} requires manual review guidance.`,
    detectedAt: "2026-03-23T10:02:00.000Z",
    resourceIds: [`resource_${walletChain}_1`],
    riskFactorIds: [`factor_${walletChain}_1`],
    cleanupActionIds: [`action_${walletChain}_1`],
    evidence: [
      {
        evidenceId: `evidence_${walletChain}_1`,
        sourceType: "snapshot_section",
        sourceId: `section_${walletChain}_1`,
        label: `${walletChain} section`,
      },
    ],
    metadata: {
      code: `${walletChain}_review`,
    },
  };

  const riskFactor: WalletRiskFactor = {
    factorId: `factor_${walletChain}_1`,
    walletChain,
    category: finding.category,
    riskLevel: finding.riskLevel,
    title: `${walletChain} exposure`,
    summary: `${walletChain} exposure requires manual review.`,
    findingIds: [finding.findingId],
    resourceIds: finding.resourceIds,
    metadata: {
      sourceFindingId: finding.findingId,
    },
  };

  const result: WalletScanResult = {
    requestId: request.requestId,
    snapshotId: snapshot.snapshotId,
    walletChain,
    walletAddress: request.walletAddress,
    networkId: request.networkId,
    evaluatedAt: "2026-03-23T10:03:00.000Z",
    findings: [finding],
    riskFactors: [riskFactor],
    scoreBreakdown: {
      totalScore: 61,
      riskLevel: "medium",
      rationale: `${walletChain} guidance only`,
      components: [
        {
          componentId: `component_${walletChain}_1`,
          label: `${walletChain} review`,
          score: 61,
          maxScore: 100,
          riskLevel: "medium",
          rationale: `${walletChain} manual review guidance only`,
          findingIds: [finding.findingId],
          riskFactorIds: [riskFactor.factorId],
        },
      ],
    },
    cleanupPlan: {
      planId: `plan_${walletChain}_1`,
      walletChain,
      walletAddress: request.walletAddress,
      networkId: request.networkId,
      createdAt: "2026-03-23T10:03:00.000Z",
      summary: `${walletChain} manual guidance only`,
      actions: [
        {
          actionId: `action_${walletChain}_1`,
          walletChain,
          kind: "manual_review",
          executionMode: walletChain === "solana" ? "guided" : "manual",
          executionType: "manual_review",
          status: "planned",
          requiresSignature: walletChain === "solana",
          supportStatus: "partial",
          title: `${walletChain} manual review`,
          description: `${walletChain} manual action is required.`,
          priority: "medium",
          target: {
            targetId: `target_${walletChain}_1`,
            targetKind: "wallet",
            label: `${walletChain} target`,
            metadata: {
              recommendationType: "manual_review",
            },
          },
          findingIds: [finding.findingId],
          riskFactorIds: [riskFactor.factorId],
          supportDetail: `${walletChain} guidance only`,
          metadata: {
            recommendationType: "manual_review",
          },
        },
      ],
      projectedScore: null,
      projectedRiskLevel: null,
    },
    capabilityTier: scanMode,
    executionPerformed: false,
    actionable: true,
    classification: "manual_action_required",
    statusLabel: "Scan completed. Issues detected. Manual action required.",
    capabilityBoundaries: [
      {
        boundaryId: `boundary_${walletChain}_snapshot`,
        area: "snapshot",
        capabilityKey: `hydrated_${walletChain}_snapshot`,
        status: "supported",
        detail: `${walletChain} snapshot support`,
      },
      {
        boundaryId: `boundary_${walletChain}_finding`,
        area: "finding",
        capabilityKey: `deterministic_${walletChain}_findings`,
        status: "supported",
        detail: `${walletChain} finding support`,
      },
      {
        boundaryId: `boundary_${walletChain}_cleanup_plan`,
        area: "cleanup_plan",
        capabilityKey: `deterministic_${walletChain}_cleanup_guidance`,
        status: "supported",
        detail: `${walletChain} cleanup guidance support`,
      },
      {
        boundaryId: `boundary_${walletChain}_cleanup_execution`,
        area: "cleanup_execution",
        capabilityKey: `${walletChain}_cleanup_execution`,
        status: "not_supported",
        detail: `${walletChain} cleanup execution not supported`,
      },
    ],
  };

  const summary: WalletSummary = {
    walletChain,
    walletAddress: request.walletAddress,
    networkId: request.networkId,
    scanMode,
    generatedAt: "2026-03-23T10:04:00.000Z",
    snapshotCapturedAt: snapshot.capturedAt,
    capabilityTier: scanMode,
    score: 61,
    riskLevel: "medium",
    findingCount: 1,
    openFindingCount: 1,
    cleanupActionCount: 1,
    actionableFindingCount: 1,
    executionPerformed: false,
    actionable: true,
    classification: "manual_action_required",
    statusLabel: "Scan completed. Issues detected. Manual action required.",
  };

  return {
    reportVersion: "1",
    generatedAt: "2026-03-23T10:04:00.000Z",
    request,
    snapshot,
    result,
    summary,
    cleanupExecution: null,
  };
}

function cloneReportIdInput(input: WalletReportIdInput): WalletReportIdInput {
  return {
    reportVersion: input.reportVersion,
    generatedAt: input.generatedAt,
    request: {
      ...input.request,
      metadata: { ...input.request.metadata },
    },
    snapshot: {
      ...input.snapshot,
      sections: input.snapshot.sections.map((section) => ({
        ...section,
        metadata: { ...section.metadata },
      })),
      metadata: { ...input.snapshot.metadata },
    },
    result: {
      ...input.result,
      findings: input.result.findings.map((finding) => ({
        ...finding,
        resourceIds: [...finding.resourceIds],
        riskFactorIds: [...finding.riskFactorIds],
        cleanupActionIds: [...finding.cleanupActionIds],
        evidence: finding.evidence.map((evidence) => ({ ...evidence })),
        metadata: { ...finding.metadata },
      })),
      riskFactors: input.result.riskFactors.map((factor) => ({
        ...factor,
        findingIds: [...factor.findingIds],
        resourceIds: [...factor.resourceIds],
        metadata: { ...factor.metadata },
      })),
      scoreBreakdown: {
        ...input.result.scoreBreakdown,
        components: input.result.scoreBreakdown.components.map((component) => ({
          ...component,
          findingIds: [...component.findingIds],
          riskFactorIds: [...component.riskFactorIds],
        })),
      },
      cleanupPlan:
        input.result.cleanupPlan === null
          ? null
          : {
              ...input.result.cleanupPlan,
              actions: input.result.cleanupPlan.actions.map((action) => ({
                ...action,
                target: {
                  ...action.target,
                  metadata: { ...action.target.metadata },
                },
                findingIds: [...action.findingIds],
                riskFactorIds: [...action.riskFactorIds],
                metadata: { ...action.metadata },
              })),
              ...("batches" in input.result.cleanupPlan
                ? {
                    batches: input.result.cleanupPlan.batches.map((batch) => ({
                      ...batch,
                      actionIds: [...batch.actionIds],
                      actions: batch.actions.map((action) => ({
                        ...action,
                        approval: {
                          ...action.approval,
                        },
                        target: {
                          ...action.target,
                          metadata: { ...action.target.metadata },
                        },
                        findingIds: [...action.findingIds],
                        riskFactorIds: [...action.riskFactorIds],
                        metadata: { ...action.metadata },
                      })),
                    })),
                  }
                : {}),
            },
      capabilityBoundaries: input.result.capabilityBoundaries.map((boundary) => ({
        ...boundary,
      })),
    },
    summary: {
      ...input.summary,
    },
    cleanupExecution:
      input.cleanupExecution === null
        ? null
        : {
            ...input.cleanupExecution,
            actionResults: input.cleanupExecution.actionResults.map(
              (actionResult) => ({
                ...actionResult,
                evidence: actionResult.evidence.map((evidence) => ({ ...evidence })),
              })
            ),
          },
  };
}

describe("buildWalletReportId", () => {
  it("returns the same ID for equivalent declared contract data", () => {
    const first = createReportIdInput();
    const second = cloneReportIdInput(first);

    expect(buildWalletReportId(first)).toBe(buildWalletReportId(second));
  });

  it("ignores undeclared extra runtime fields", () => {
    const base = createReportIdInput();

    const withExtras = {
      ...base,
      ignoredTopLevel: "ignore-me",
      request: {
        ...base.request,
        ignoredRequestField: "ignore-me",
      } as unknown as WalletScanRequest,
      snapshot: {
        ...base.snapshot,
        ignoredSnapshotField: "ignore-me",
        sections: base.snapshot.sections.map(
          (section) =>
            ({
              ...section,
              ignoredSectionField: "ignore-me",
            }) as unknown as WalletSnapshotSection
        ),
      } as unknown as WalletScanSnapshot,
      result: {
        ...base.result,
        ignoredResultField: "ignore-me",
        findings: base.result.findings.map(
          (finding) =>
            ({
              ...finding,
              ignoredFindingField: "ignore-me",
              evidence: finding.evidence.map(
                (evidence) =>
                  ({
                    ...evidence,
                    ignoredEvidenceField: "ignore-me",
                  }) as unknown as WalletEvidenceRef
              ),
            }) as unknown as WalletFinding
        ),
        riskFactors: base.result.riskFactors.map(
          (factor) =>
            ({
              ...factor,
              ignoredFactorField: "ignore-me",
            }) as unknown as WalletRiskFactor
        ),
        cleanupPlan:
          base.result.cleanupPlan === null
            ? null
            : ({
                ...base.result.cleanupPlan,
                ignoredPlanField: "ignore-me",
                actions: base.result.cleanupPlan.actions.map(
                  (action) =>
                    ({
                      ...action,
                      ignoredActionField: "ignore-me",
                    }) as unknown as WalletCleanupAction
                ),
              } as unknown as WalletCleanupPlan),
        capabilityBoundaries: base.result.capabilityBoundaries.map(
          (boundary) =>
            ({
              ...boundary,
              ignoredBoundaryField: "ignore-me",
            }) as unknown as (typeof base.result.capabilityBoundaries)[number]
        ),
      } as unknown as WalletScanResult,
      summary: {
        ...base.summary,
        ignoredSummaryField: "ignore-me",
      } as unknown as WalletSummary,
      cleanupExecution:
        base.cleanupExecution === null
          ? null
          : ({
              ...base.cleanupExecution,
              ignoredCleanupExecutionField: "ignore-me",
              actionResults: base.cleanupExecution.actionResults.map(
                (actionResult) =>
                  ({
                    ...actionResult,
                    ignoredActionResultField: "ignore-me",
                  }) as unknown as WalletCleanupActionResult
              ),
            } as unknown as WalletCleanupExecutionResult),
    } as unknown as WalletReportIdInput;

    expect(buildWalletReportId(withExtras)).toBe(buildWalletReportId(base));
  });

  it("changes the ID when declared contract data changes", () => {
    const base = createReportIdInput();
    const changed: WalletReportIdInput = {
      ...cloneReportIdInput(base),
      summary: {
        ...base.summary,
        score: 71,
      },
    };

    expect(buildWalletReportId(changed)).not.toBe(buildWalletReportId(base));
  });

  it("changes the ID when declared Phase 4C cleanup plan fields change", () => {
    const base = createReportIdInput();
    const changed = cloneReportIdInput(base);
    const cleanupPlan = changed.result.cleanupPlan;

    if (cleanupPlan === null || !("batches" in cleanupPlan)) {
      throw new Error("Expected Phase 4C cleanup plan with batches.");
    }

    changed.result = {
      ...changed.result,
      cleanupPlan: {
        ...cleanupPlan,
        batches: cleanupPlan.batches.map((batch, index) =>
          index === 0
            ? {
                ...batch,
                summary: "Changed batch summary for report ID regression coverage.",
              }
            : batch
        ),
      },
    };

    expect(buildWalletReportId(changed)).not.toBe(buildWalletReportId(base));
  });

  it("accepts EVM execution-reported identity only when summary and result match the execution record", () => {
    const changed = cloneReportIdInput(createReportIdInput());

    changed.cleanupExecution = {
      ...changed.cleanupExecution!,
      status: "completed",
      startedAt: "2026-03-23T10:06:00.000Z",
      completedAt: "2026-03-23T10:07:00.000Z",
      actionResults: changed.cleanupExecution!.actionResults.map((actionResult) => ({
        ...actionResult,
        status: "succeeded",
        executedAt: "2026-03-23T10:07:00.000Z",
        detail: "External revoke execution was reported.",
      })),
    };
    changed.result = {
      ...changed.result,
      executionPerformed: true,
      classification: "execution_reported",
      statusLabel: "Scan completed. Issues detected. Cleanup execution was reported.",
    };
    changed.summary = {
      ...changed.summary,
      executionPerformed: true,
      classification: "execution_reported",
      statusLabel: "Scan completed. Issues detected. Cleanup execution was reported.",
    };

    expect(buildWalletReportId(changed)).toMatch(/^wallet_report_/);
    expect(buildWalletReportId(changed)).not.toBe(buildWalletReportId(createReportIdInput()));
  });

  it("changes the ID when declared capability boundaries change within supported truth", () => {
    const base = createReportIdInput();
    const changed = cloneReportIdInput(base);

    changed.result = {
      ...changed.result,
      capabilityBoundaries: changed.result.capabilityBoundaries.map((boundary) =>
        boundary.area === "cleanup_execution"
          ? {
              ...boundary,
              status: "not_supported",
              detail: "Changed cleanup execution support detail for report ID coverage.",
            }
          : boundary
      ),
    };

    expect(buildWalletReportId(changed)).not.toBe(buildWalletReportId(base));
  });

  it("rejects report identity input when execution truth fields overstate what ran", () => {
    const changed = cloneReportIdInput(createReportIdInput());

    changed.cleanupExecution = {
      ...changed.cleanupExecution!,
      status: "completed",
      startedAt: "2026-03-23T10:06:00.000Z",
      completedAt: "2026-03-23T10:07:00.000Z",
      actionResults: changed.cleanupExecution!.actionResults.map((actionResult) => ({
        ...actionResult,
        status: "succeeded",
        executedAt: "2026-03-23T10:07:00.000Z",
        detail: "External revoke execution was reported.",
      })),
    };

    expect(() => buildWalletReportId(changed)).toThrowError(
      "Wallet report capability truth requires result.executionPerformed to match actual cleanup execution."
    );
  });

  it("rejects report identity input that overclaims EVM cleanup execution support", () => {
    const changed = cloneReportIdInput(createReportIdInput());

    changed.result = {
      ...changed.result,
      capabilityBoundaries: changed.result.capabilityBoundaries.map((boundary) =>
        boundary.area === "cleanup_execution"
          ? {
              ...boundary,
              status: "supported",
            }
          : boundary
      ),
    };

    expect(() => buildWalletReportId(changed)).toThrowError(
      'Layer 4 evm capability boundary "revoke_authorization" overclaims cleanup_execution support as "supported".'
    );
  });

  it("rejects report identity input that encodes false full Solana capability", () => {
    expect(() =>
      buildWalletReportId(createBasicOnlyReportIdInput("solana", "full"))
    ).toThrowError(
      'Layer 4 solana capability does not support request.scanMode "full"; supported values: "basic".'
    );
  });

  it("rejects report identity input that encodes false full Bitcoin capability", () => {
    expect(() =>
      buildWalletReportId(createBasicOnlyReportIdInput("bitcoin", "full"))
    ).toThrowError(
      'Layer 4 bitcoin capability does not support request.scanMode "full"; supported values: "basic".'
    );
  });
});
