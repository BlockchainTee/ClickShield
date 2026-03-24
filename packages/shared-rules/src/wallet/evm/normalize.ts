import { normalizeEvmAddress } from "../../normalize/address.js";
import {
  EVM_APPROVAL_STALE_DAYS,
} from "./constants.js";
import { buildStableId } from "./ids.js";
import type {
  EvmApprovalKind,
  EvmApprovalRecordInput,
  EvmContractExposureInput,
  EvmSpenderRiskInput,
  EvmWalletScanEvaluationInput,
  NormalizedEvmApprovalState,
  NormalizedEvmContractExposure,
  NormalizedEvmSpenderRisk,
  NormalizedEvmWalletSnapshot,
} from "./types.js";

const MAX_UINT256 = (1n << 256n) - 1n;

function normalizeMetadata(
  metadata?: Readonly<Record<string, string>>
): Readonly<Record<string, string>> {
  if (!metadata) {
    return {};
  }

  const normalized: Record<string, string> = {};
  for (const key of Object.keys(metadata).sort()) {
    normalized[key] = metadata[key];
  }
  return normalized;
}

function normalizeFlags(flags?: readonly string[]): readonly string[] {
  return [...new Set((flags ?? []).map((flag) => flag.trim().toLowerCase()).filter(Boolean))].sort();
}

function parseIntegerString(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^0x[0-9a-fA-F]+$/.test(trimmed)) {
    return BigInt(trimmed).toString(10);
  }

  if (/^[0-9]+$/.test(trimmed)) {
    return BigInt(trimmed).toString(10);
  }

  return trimmed;
}

function compareNullable(left: string | null, right: string | null): number {
  return (left ?? "").localeCompare(right ?? "");
}

function pickSourceSectionId(
  explicitSectionId: string | null | undefined,
  candidates: readonly string[]
): string | null {
  if (explicitSectionId) {
    return explicitSectionId;
  }

  return candidates[0] ?? null;
}

function findSectionIds(
  input: EvmWalletScanEvaluationInput,
  matcher: (value: string) => boolean
): readonly string[] {
  return input.snapshot.sections
    .filter((section) => {
      const haystacks = [
        section.sectionId,
        section.sectionType,
        section.label,
      ].map((value) => value.toLowerCase());
      return haystacks.some(matcher);
    })
    .map((section) => section.sectionId)
    .sort();
}

function normalizeSpender(
  input: EvmSpenderRiskInput,
  defaultSectionIds: readonly string[]
): NormalizedEvmSpenderRisk {
  const flags = normalizeFlags(input.flags);
  const riskLevel =
    input.riskLevel ?? (flags.length > 0 ? "high" : null);
  const disposition =
    flags.length > 0 || (riskLevel !== null && riskLevel !== "low")
      ? "flagged"
      : input.trusted
        ? "trusted"
        : "unknown";
  const spenderAddress = normalizeEvmAddress(input.spenderAddress);
  const sourceSectionId = pickSourceSectionId(input.sourceSectionId, defaultSectionIds);
  const metadata = normalizeMetadata(input.metadata);

  return {
    resourceId: buildStableId("wallet_spender", {
      disposition,
      riskLevel,
      sourceSectionId,
      spenderAddress,
    }),
    spenderAddress,
    disposition,
    riskLevel,
    flags,
    label: input.label ?? null,
    sourceSectionId,
    metadata,
  };
}

function normalizeContractExposure(
  input: EvmContractExposureInput,
  defaultSectionIds: readonly string[]
): NormalizedEvmContractExposure {
  const flags = normalizeFlags(input.flags);
  const riskLevel =
    input.riskLevel ?? (flags.length > 0 ? "high" : null);
  const contractAddress = normalizeEvmAddress(input.contractAddress);
  const sourceSectionId = pickSourceSectionId(input.sourceSectionId, defaultSectionIds);
  const metadata = normalizeMetadata(input.metadata);
  const isRisky = flags.length > 0 || (riskLevel !== null && riskLevel !== "low");

  return {
    resourceId: buildStableId("wallet_contract", {
      contractAddress,
      exposureType: input.exposureType,
      riskLevel,
      sourceSectionId,
    }),
    contractAddress,
    exposureType: input.exposureType,
    riskLevel,
    flags,
    label: input.label ?? null,
    isRisky,
    sourceSectionId,
    metadata,
  };
}

function deriveApprovalKind(input: EvmApprovalRecordInput): EvmApprovalKind {
  if (input.tokenStandard === "erc20") {
    return "erc20_allowance";
  }

  if (input.tokenStandard === "erc721" && input.tokenId) {
    return "erc721_token";
  }

  return input.tokenStandard === "erc721"
    ? "erc721_operator"
    : "erc1155_operator";
}

function isInactiveApproval(
  approvalKind: EvmApprovalKind,
  amount: string | null,
  isApproved: boolean | null | undefined
): boolean {
  if (approvalKind === "erc20_allowance") {
    return amount === "0";
  }

  if (
    approvalKind === "erc721_token" ||
    approvalKind === "erc721_operator" ||
    approvalKind === "erc1155_operator"
  ) {
    return isApproved === false;
  }

  return false;
}

function computeAgeDays(approvedAt: string | null, capturedAt: string): number | null {
  if (!approvedAt) {
    return null;
  }

  const approvedAtMs = Date.parse(approvedAt);
  const capturedAtMs = Date.parse(capturedAt);
  if (Number.isNaN(approvedAtMs) || Number.isNaN(capturedAtMs) || approvedAtMs > capturedAtMs) {
    return null;
  }

  return Math.floor((capturedAtMs - approvedAtMs) / 86_400_000);
}

function normalizeApproval(
  input: EvmApprovalRecordInput,
  walletAddress: string,
  capturedAt: string,
  spenderMap: ReadonlyMap<string, NormalizedEvmSpenderRisk>,
  contractMap: ReadonlyMap<string, NormalizedEvmContractExposure>,
  defaultSectionIds: readonly string[]
): NormalizedEvmApprovalState | null {
  const approvalKind = deriveApprovalKind(input);
  const tokenAddress = normalizeEvmAddress(input.tokenAddress);
  const spenderAddress = normalizeEvmAddress(input.spenderAddress);
  const amount = parseIntegerString(input.amount);

  if (isInactiveApproval(approvalKind, amount, input.isApproved)) {
    return null;
  }

  const spender = spenderMap.get(spenderAddress);
  const contractMatches = [tokenAddress, spenderAddress]
    .map((address) => contractMap.get(address))
    .filter(
      (exposure): exposure is NormalizedEvmContractExposure =>
        exposure !== undefined && exposure.isRisky
    )
    .sort((left, right) => left.resourceId.localeCompare(right.resourceId));
  const riskyContractExposureIds = contractMatches.map((match) => match.resourceId);
  const ageDays = computeAgeDays(input.approvedAt ?? null, capturedAt);
  const amountKind =
    approvalKind === "erc20_allowance"
      ? amount === MAX_UINT256.toString(10)
        ? "unlimited"
        : "limited"
      : approvalKind === "erc721_token"
        ? "not_applicable"
        : "unlimited";
  const metadata = normalizeMetadata(input.metadata);
  const sourceSectionId = pickSourceSectionId(input.sourceSectionId, defaultSectionIds);

  return {
    approvalId: buildStableId("wallet_approval", {
      amount: amount ?? "",
      approvalKind,
      approvedAt: input.approvedAt ?? "",
      spenderAddress,
      tokenAddress,
      tokenId: input.tokenId ?? "",
      walletAddress,
    }),
    walletAddress,
    tokenStandard: input.tokenStandard,
    approvalKind,
    tokenAddress,
    spenderAddress,
    spenderDisposition: spender?.disposition ?? "unknown",
    spenderRiskLevel: spender?.riskLevel ?? null,
    spenderFlags: spender?.flags ?? [],
    amount,
    amountKind,
    tokenId: input.tokenId ?? null,
    isUnlimited: amountKind === "unlimited",
    approvedAt: input.approvedAt ?? null,
    ageDays,
    isStale: ageDays !== null && ageDays >= EVM_APPROVAL_STALE_DAYS,
    riskyContractExposureIds,
    hasRiskyContractExposure: riskyContractExposureIds.length > 0,
    sourceSectionId,
    metadata,
  };
}

/**
 * Normalizes a fully hydrated EVM wallet snapshot into a stable evaluation shape.
 */
export function normalizeEvmWalletSnapshot(
  input: EvmWalletScanEvaluationInput
): NormalizedEvmWalletSnapshot {
  if (input.request.walletChain !== "evm" || input.snapshot.walletChain !== "evm") {
    throw new Error("Phase 4B EVM evaluation requires evm request and snapshot contracts.");
  }

  const requestWallet = normalizeEvmAddress(input.request.walletAddress);
  const snapshotWallet = normalizeEvmAddress(input.snapshot.walletAddress);
  if (requestWallet !== snapshotWallet) {
    throw new Error("Wallet request and snapshot addresses must match for EVM evaluation.");
  }

  if (input.request.requestId !== input.snapshot.requestId) {
    throw new Error("Wallet request and snapshot requestId values must match.");
  }

  if (input.request.networkId !== input.snapshot.networkId) {
    throw new Error("Wallet request and snapshot networkId values must match.");
  }

  const spenderSectionIds = findSectionIds(input, (value) => value.includes("spender"));
  const contractSectionIds = findSectionIds(input, (value) => value.includes("contract"));
  const approvalSectionIds = findSectionIds(input, (value) => value.includes("approval"));

  const spenders = (input.hydratedSnapshot.spenders ?? [])
    .map((spender) => normalizeSpender(spender, spenderSectionIds))
    .sort((left, right) => left.spenderAddress.localeCompare(right.spenderAddress));
  const contractExposures = (input.hydratedSnapshot.contractExposures ?? [])
    .map((exposure) => normalizeContractExposure(exposure, contractSectionIds))
    .sort((left, right) => left.resourceId.localeCompare(right.resourceId));
  const spenderMap = new Map(spenders.map((spender) => [spender.spenderAddress, spender]));
  const contractMap = new Map(
    contractExposures.map((exposure) => [exposure.contractAddress, exposure])
  );
  const approvals = input.hydratedSnapshot.approvals
    .map((approval) =>
      normalizeApproval(
        approval,
        requestWallet,
        input.snapshot.capturedAt,
        spenderMap,
        contractMap,
        approvalSectionIds
      )
    )
    .filter(
      (approval): approval is NormalizedEvmApprovalState => approval !== null
    )
    .sort((left, right) => {
      return (
        left.approvalKind.localeCompare(right.approvalKind) ||
        left.tokenAddress.localeCompare(right.tokenAddress) ||
        left.spenderAddress.localeCompare(right.spenderAddress) ||
        compareNullable(left.tokenId, right.tokenId) ||
        compareNullable(left.approvedAt, right.approvedAt) ||
        left.approvalId.localeCompare(right.approvalId)
      );
    });

  return {
    walletAddress: requestWallet,
    networkId: input.request.networkId,
    capturedAt: input.snapshot.capturedAt,
    approvals,
    spenders,
    contractExposures,
  };
}
