import { describe, expect, it } from "vitest";

import {
  evaluateSolanaWalletScan,
  type SolanaAuthorityAssignmentInput,
  type SolanaConnectionRecordInput,
  type SolanaProgramExposureInput,
  type SolanaTokenAccountInput,
  type SolanaWalletScanEvaluationInput,
  type WalletScanRequest,
  type WalletScanSnapshot,
  type WalletSnapshotSection,
} from "../../src/index.js";

const WALLET_ADDRESS = "5D6xPj5vXvGkGEXUXMaLLq5yRvCNr4CemGYGAaHo9dZY";
const CAPTURED_AT = "2026-03-23T12:00:00.000Z";
const EVALUATED_AT = "2026-03-23T12:05:00.000Z";

function buildSolAddress(seed: number): string {
  return `${String(seed).padStart(2, "1")}SolanaAddressSeed${String(seed).padStart(2, "1")}AlphaBetaGamma`;
}

function createSections(): readonly WalletSnapshotSection[] {
  return [
    {
      sectionId: "section_sol_token_accounts",
      sectionType: "solana_token_accounts",
      label: "Solana token accounts",
      itemCount: 0,
      contentHash: "hash_token_accounts",
      metadata: {},
    },
    {
      sectionId: "section_sol_connections",
      sectionType: "solana_connections",
      label: "Solana connected apps",
      itemCount: 0,
      contentHash: "hash_connections",
      metadata: {},
    },
    {
      sectionId: "section_sol_authorities",
      sectionType: "solana_authorities",
      label: "Solana authorities",
      itemCount: 0,
      contentHash: "hash_authorities",
      metadata: {},
    },
    {
      sectionId: "section_sol_programs",
      sectionType: "solana_program_interactions",
      label: "Solana programs",
      itemCount: 0,
      contentHash: "hash_programs",
      metadata: {},
    },
  ];
}

function createRequest(
  scanMode: WalletScanRequest["scanMode"] = "basic"
): WalletScanRequest {
  return {
    requestId: "request_sol_phase4d",
    walletChain: "solana",
    walletAddress: WALLET_ADDRESS,
    networkId: "mainnet-beta",
    scanMode,
    requestedAt: CAPTURED_AT,
    metadata: {
      source: "test",
    },
  };
}

function createSnapshot(request: WalletScanRequest): WalletScanSnapshot {
  return {
    snapshotId: "snapshot_sol_phase4d",
    requestId: request.requestId,
    walletChain: request.walletChain,
    walletAddress: request.walletAddress,
    networkId: request.networkId,
    capturedAt: CAPTURED_AT,
    sections: createSections(),
    metadata: {
      source: "test",
    },
  };
}

function createInput(overrides?: {
  readonly tokenAccounts?: readonly SolanaTokenAccountInput[];
  readonly authorityAssignments?: readonly SolanaAuthorityAssignmentInput[];
  readonly connections?: readonly SolanaConnectionRecordInput[];
  readonly programExposures?: readonly SolanaProgramExposureInput[];
  readonly scanMode?: WalletScanRequest["scanMode"];
}): SolanaWalletScanEvaluationInput {
  const request = createRequest(overrides?.scanMode);

  return {
    request,
    snapshot: createSnapshot(request),
    hydratedSnapshot: {
      tokenAccounts: overrides?.tokenAccounts ?? [],
      authorityAssignments: overrides?.authorityAssignments ?? [],
      connections: overrides?.connections ?? [],
      programExposures: overrides?.programExposures ?? [],
      metadata: {
        source: "test",
      },
    },
    evaluatedAt: EVALUATED_AT,
  };
}

function listFindingCodes(
  evaluation: ReturnType<typeof evaluateSolanaWalletScan>
): readonly string[] {
  return evaluation.result.findings.map((finding) => finding.metadata.code ?? "");
}

describe("Layer 4 Phase 4D Solana scan foundation", () => {
  it("coerces unsupported full scan requests to truthful basic scope", () => {
    const coerced = evaluateSolanaWalletScan(createInput({ scanMode: "full" }));
    const basic = evaluateSolanaWalletScan(createInput({ scanMode: "basic" }));

    expect(coerced.summary.scanMode).toBe("basic");
    expect(coerced.report.summary.scanMode).toBe("basic");
    expect(coerced.report.request.scanMode).toBe("basic");
    expect(coerced.report.reportId).toBe(basic.report.reportId);
  });

  it("returns a clean result for a safe Solana wallet snapshot", () => {
    const evaluation = evaluateSolanaWalletScan(
      createInput({
        tokenAccounts: [
          {
            tokenAccountAddress: buildSolAddress(1),
            mintAddress: buildSolAddress(2),
            ownerAddress: WALLET_ADDRESS,
            balanceLamports: "1000",
          },
        ],
        connections: [
          {
            appName: "Trusted app",
            origin: "https://trusted.example",
            permissions: ["view_public_key"],
            permissionLevel: "limited",
          },
        ],
      })
    );

    expect(evaluation.score).toBe(100);
    expect(evaluation.riskLevel).toBe("low");
    expect(evaluation.result.findings).toHaveLength(0);
    expect(evaluation.result.riskFactors).toHaveLength(0);
    expect(evaluation.result.cleanupPlan).toBeNull();
    expect(evaluation.result.walletAddress).toBe(WALLET_ADDRESS);
  });

  it("detects delegate authority exposure and produces manual-only cleanup guidance", () => {
    const evaluation = evaluateSolanaWalletScan(
      createInput({
        tokenAccounts: [
          {
            tokenAccountAddress: buildSolAddress(3),
            mintAddress: buildSolAddress(4),
            ownerAddress: WALLET_ADDRESS,
            delegateAddress: buildSolAddress(5),
            delegateRiskLevel: "high",
            delegateFlags: ["malicious"],
          },
        ],
      })
    );

    expect(listFindingCodes(evaluation)).toEqual([
      "SOLANA_DELEGATE_AUTHORITY_EXPOSURE",
    ]);
    expect(evaluation.riskLevel).toBe("critical");
    expect(evaluation.result.cleanupPlan?.actions).toHaveLength(1);
    expect(evaluation.result.cleanupPlan?.actions[0]?.executionType).toBe(
      "manual_review"
    );
    expect(evaluation.result.cleanupPlan?.actions[0]?.requiresSignature).toBe(true);
    expect(evaluation.result.cleanupPlan?.actions[0]?.metadata.recommendationType).toBe(
      "remove_delegate"
    );
  });

  it("detects risky connected app exposure", () => {
    const evaluation = evaluateSolanaWalletScan(
      createInput({
        tokenAccounts: [],
        connections: [
          {
            appName: "Sketchy dapp",
            origin: "https://sketchy.example",
            permissions: ["sign_transaction"],
            riskLevel: "high",
            flags: ["phishing"],
          },
        ],
      })
    );

    expect(listFindingCodes(evaluation)).toEqual([
      "SOLANA_RISKY_CONNECTION_EXPOSURE",
    ]);
    expect(evaluation.riskLevel).toBe("critical");
    expect(evaluation.result.cleanupPlan?.actions[0]?.metadata.recommendationType).toBe(
      "review_connection"
    );
    expect(evaluation.result.cleanupPlan?.actions[0]?.requiresSignature).toBe(true);
  });

  it("detects broad permission exposure without EVM approval semantics", () => {
    const evaluation = evaluateSolanaWalletScan(
      createInput({
        tokenAccounts: [],
        connections: [
          {
            appName: "Portfolio tool",
            origin: "https://portfolio.example",
            permissions: ["sign_all_transactions", "account_access_all"],
            permissionLevel: "broad",
          },
        ],
      })
    );

    expect(listFindingCodes(evaluation)).toEqual([
      "SOLANA_BROAD_PERMISSION_EXPOSURE",
    ]);
    expect(evaluation.riskLevel).toBe("medium");
    expect(
      evaluation.result.cleanupPlan?.actions[0]?.description.includes("disconnect")
    ).toBe(true);
    expect(evaluation.result.cleanupPlan?.actions[0]?.requiresSignature).toBe(true);
    expect("approval" in (evaluation.result.cleanupPlan?.actions[0] ?? {})).toBe(false);
  });

  it("detects suspicious program exposure", () => {
    const evaluation = evaluateSolanaWalletScan(
      createInput({
        programExposures: [
          {
            programAddress: buildSolAddress(6),
            label: "Unknown program",
            riskLevel: "critical",
            flags: ["drainer"],
          },
        ],
      })
    );

    expect(listFindingCodes(evaluation)).toEqual([
      "SOLANA_SUSPICIOUS_PROGRAM_INTERACTION",
    ]);
    expect(evaluation.riskLevel).toBe("critical");
  });

  it("detects stale risky connection behavior using the fixed threshold", () => {
    const evaluation = evaluateSolanaWalletScan(
      createInput({
        connections: [
          {
            appName: "Old risky app",
            origin: "https://old-risk.example",
            permissions: ["sign_transaction"],
            riskLevel: "high",
            connectedAt: "2025-11-01T12:00:00.000Z",
          },
        ],
      })
    );

    expect(listFindingCodes(evaluation)).toEqual([
      "SOLANA_RISKY_CONNECTION_EXPOSURE",
      "SOLANA_STALE_RISKY_CONNECTION_EXPOSURE",
    ]);
    expect(evaluation.signals.staleRiskyConnectionCount).toBe(1);
  });

  it("detects authority assignment exposure where represented", () => {
    const evaluation = evaluateSolanaWalletScan(
      createInput({
        authorityAssignments: [
          {
            subjectAddress: buildSolAddress(7),
            authorityAddress: buildSolAddress(8),
            authorityType: "freeze_authority",
            riskLevel: "high",
          },
        ],
      })
    );

    expect(listFindingCodes(evaluation)).toEqual([
      "SOLANA_AUTHORITY_ASSIGNMENT_EXPOSURE",
    ]);
    expect(evaluation.result.cleanupPlan?.actions[0]?.metadata.recommendationType).toBe(
      "remove_authority"
    );
  });

  it("produces consistent score and report output for identical input", () => {
    const input = createInput({
      tokenAccounts: [
        {
          tokenAccountAddress: buildSolAddress(9),
          mintAddress: buildSolAddress(10),
          ownerAddress: WALLET_ADDRESS,
          delegateAddress: buildSolAddress(11),
        },
      ],
      connections: [
        {
          appName: "Broad app",
          origin: "https://broad.example",
          permissions: ["sign_all_transactions", "account_access_all"],
          permissionLevel: "broad",
        },
      ],
    });

    const first = evaluateSolanaWalletScan(input);
    const second = evaluateSolanaWalletScan(input);

    expect(first).toEqual(second);
    expect(first.report.reportId).toBe(second.report.reportId);
    expect(first.normalizedSnapshot.connections[0]?.resourceId).toBe(
      second.normalizedSnapshot.connections[0]?.resourceId
    );
  });

  it("gives distinct identities to distinct Solana connection records", () => {
    const evaluation = evaluateSolanaWalletScan(
      createInput({
        connections: [
          {
            appName: "Portfolio tool",
            origin: "https://portfolio.example",
            permissions: ["sign_all_transactions", "account_access_all"],
            permissionLevel: "broad",
            programAddresses: [buildSolAddress(15)],
          },
          {
            appName: "Portfolio tool",
            origin: "https://portfolio.example",
            permissions: ["sign_all_transactions", "account_access_all"],
            permissionLevel: "broad",
            programAddresses: [buildSolAddress(16)],
          },
        ],
      })
    );

    expect(new Set(evaluation.normalizedSnapshot.connections.map((entry) => entry.resourceId)).size).toBe(2);
    expect(new Set(evaluation.result.cleanupPlan?.actions.map((action) => action.actionId)).size).toBe(2);
  });

  it("keeps cleanup recommendations recommendation-only with no EVM leakage", () => {
    const evaluation = evaluateSolanaWalletScan(
      createInput({
        tokenAccounts: [
          {
            tokenAccountAddress: buildSolAddress(12),
            mintAddress: buildSolAddress(13),
            ownerAddress: WALLET_ADDRESS,
            delegateAddress: buildSolAddress(14),
          },
        ],
        connections: [
          {
            appName: "Review app",
            origin: "https://review.example",
            permissions: ["sign_all_transactions", "account_access_all"],
            permissionLevel: "broad",
            riskLevel: "high",
          },
        ],
      })
    );

    expect(evaluation.result.cleanupPlan).not.toBeNull();
    expect(
      evaluation.result.cleanupPlan?.actions.every(
        (action) =>
          action.executionType === "manual_review" &&
          action.status === "planned" &&
          action.requiresSignature === true &&
          !action.title.toLowerCase().includes("erc") &&
          !action.description.toLowerCase().includes("approve(")
      )
    ).toBe(true);
  });
});
