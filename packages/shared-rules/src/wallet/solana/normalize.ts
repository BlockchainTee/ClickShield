import { normalizeSolAddress } from "../../normalize/address.js";
import {
  SOLANA_BROAD_PERMISSION_SCOPES,
  SOLANA_CONNECTION_STALE_DAYS,
} from "./constants.js";
import { buildStableId } from "./ids.js";
import type {
  NormalizedSolanaAuthorityAssignment,
  NormalizedSolanaConnectionRecord,
  NormalizedSolanaProgramExposure,
  NormalizedSolanaTokenAccountState,
  NormalizedSolanaWalletSnapshot,
  SolanaAuthorityAssignmentInput,
  SolanaConnectionRecordInput,
  SolanaPermissionLevel,
  SolanaProgramExposureInput,
  SolanaTokenAccountInput,
  SolanaWalletScanEvaluationInput,
} from "./types.js";
import {
  computeAgeDays,
  normalizeMetadata,
  normalizeStringList,
} from "./utils.js";

function parseIntegerString(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
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
  input: SolanaWalletScanEvaluationInput,
  keywords: readonly string[]
): readonly string[] {
  return input.snapshot.sections
    .filter((section) => {
      const haystacks = [
        section.sectionId,
        section.sectionType,
        section.label,
      ].map((value) => value.toLowerCase());
      return keywords.some((keyword) =>
        haystacks.some((haystack) => haystack.includes(keyword))
      );
    })
    .map((section) => section.sectionId)
    .sort();
}

function normalizePermissionLevel(
  input: SolanaConnectionRecordInput,
  permissions: readonly string[]
): SolanaPermissionLevel {
  if (input.permissionLevel === "broad") {
    return "broad";
  }

  if (
    permissions.length >= 3 ||
    permissions.some((permission) =>
      SOLANA_BROAD_PERMISSION_SCOPES.includes(
        permission as (typeof SOLANA_BROAD_PERMISSION_SCOPES)[number]
      )
    )
  ) {
    return "broad";
  }

  return "limited";
}

function normalizeTokenAccount(
  input: SolanaTokenAccountInput,
  walletAddress: string,
  defaultSectionIds: readonly string[]
): NormalizedSolanaTokenAccountState {
  const tokenAccountAddress = normalizeSolAddress(input.tokenAccountAddress);
  const mintAddress = normalizeSolAddress(input.mintAddress);
  const ownerAddress =
    input.ownerAddress === undefined || input.ownerAddress === null
      ? null
      : normalizeSolAddress(input.ownerAddress);
  const delegateAddress =
    input.delegateAddress === undefined || input.delegateAddress === null
      ? null
      : normalizeSolAddress(input.delegateAddress);
  const delegateFlags = normalizeStringList(input.delegateFlags);
  const delegateRiskLevel =
    delegateAddress === null
      ? null
      : input.delegateRiskLevel ?? (delegateFlags.length > 0 ? "high" : null);
  const sourceSectionId = pickSourceSectionId(
    input.sourceSectionId,
    defaultSectionIds
  );

  return {
    resourceId: buildStableId("wallet_sol_token_account", {
      delegateAddress,
      mintAddress,
      tokenAccountAddress,
      walletAddress,
    }),
    tokenAccountAddress,
    mintAddress,
    ownerAddress,
    balanceLamports: parseIntegerString(input.balanceLamports),
    delegateAddress,
    delegateAmount: parseIntegerString(input.delegateAmount),
    delegateRiskLevel,
    delegateFlags,
    delegateLabel: input.delegateLabel ?? null,
    hasDelegate: delegateAddress !== null,
    isRiskyDelegate:
      delegateAddress !== null &&
      delegateRiskLevel !== null &&
      delegateRiskLevel !== "low",
    closeAuthorityAddress:
      input.closeAuthorityAddress === undefined || input.closeAuthorityAddress === null
        ? null
        : normalizeSolAddress(input.closeAuthorityAddress),
    permanentDelegateAddress:
      input.permanentDelegateAddress === undefined ||
      input.permanentDelegateAddress === null
        ? null
        : normalizeSolAddress(input.permanentDelegateAddress),
    sourceSectionId,
    metadata: normalizeMetadata(input.metadata),
  };
}

function normalizeAuthorityAssignment(
  input: SolanaAuthorityAssignmentInput,
  defaultSectionIds: readonly string[]
): NormalizedSolanaAuthorityAssignment {
  const flags = normalizeStringList(input.flags);
  const riskLevel = input.riskLevel ?? (flags.length > 0 ? "high" : null);
  const sourceSectionId = pickSourceSectionId(input.sourceSectionId, defaultSectionIds);

  return {
    resourceId: buildStableId("wallet_sol_authority", {
      authorityAddress: normalizeSolAddress(input.authorityAddress),
      authorityType: input.authorityType,
      programAddress:
        input.programAddress === undefined || input.programAddress === null
          ? null
          : normalizeSolAddress(input.programAddress),
      subjectAddress: normalizeSolAddress(input.subjectAddress),
    }),
    subjectAddress: normalizeSolAddress(input.subjectAddress),
    authorityAddress: normalizeSolAddress(input.authorityAddress),
    authorityType: input.authorityType,
    programAddress:
      input.programAddress === undefined || input.programAddress === null
        ? null
        : normalizeSolAddress(input.programAddress),
    riskLevel,
    flags,
    label: input.label ?? null,
    isRisky: riskLevel !== null && riskLevel !== "low",
    sourceSectionId,
    metadata: normalizeMetadata(input.metadata),
  };
}

function normalizeConnectionRecord(
  input: SolanaConnectionRecordInput,
  capturedAt: string,
  defaultSectionIds: readonly string[]
): NormalizedSolanaConnectionRecord {
  const connectionId = input.connectionId?.trim() || null;
  const appName = input.appName?.trim() || null;
  const origin =
    input.origin === undefined || input.origin === null
      ? null
      : input.origin.trim().toLowerCase();
  const permissions = normalizeStringList(input.permissions);
  const permissionLevel = normalizePermissionLevel(input, permissions);
  const programAddresses = (input.programAddresses ?? [])
    .map((address) => normalizeSolAddress(address))
    .sort();
  const flags = normalizeStringList(input.flags);
  const riskLevel = input.riskLevel ?? (flags.length > 0 ? "high" : null);
  const sourceSectionId = pickSourceSectionId(input.sourceSectionId, defaultSectionIds);
  const connectedAt = input.connectedAt ?? null;
  const lastUsedAt = input.lastUsedAt ?? null;
  const connectedAgeDays = computeAgeDays(connectedAt, capturedAt);
  const lastUsedAgeDays = computeAgeDays(lastUsedAt, capturedAt);
  const activityAgeDays = lastUsedAgeDays ?? connectedAgeDays;
  const isRisky = riskLevel !== null && riskLevel !== "low";
  const isBroadPermission = permissionLevel === "broad";

  return {
    resourceId: buildStableId("wallet_sol_connection", {
      appName,
      connectedAt,
      connectionId,
      flags,
      lastUsedAt,
      origin,
      permissionLevel,
      permissions,
      programAddresses,
      riskLevel,
    }),
    connectionId,
    appName,
    origin,
    permissions,
    permissionLevel,
    programAddresses,
    riskLevel,
    flags,
    connectedAt,
    lastUsedAt,
    connectedAgeDays,
    lastUsedAgeDays,
    isBroadPermission,
    isRisky,
    isStaleRisky:
      isRisky &&
      activityAgeDays !== null &&
      activityAgeDays >= SOLANA_CONNECTION_STALE_DAYS,
    sourceSectionId,
    metadata: normalizeMetadata(input.metadata),
  };
}

function normalizeProgramExposure(
  input: SolanaProgramExposureInput,
  defaultSectionIds: readonly string[]
): NormalizedSolanaProgramExposure {
  const flags = normalizeStringList(input.flags);
  const riskLevel = input.riskLevel ?? (flags.length > 0 ? "high" : null);
  const sourceSectionId = pickSourceSectionId(input.sourceSectionId, defaultSectionIds);

  return {
    resourceId: buildStableId("wallet_sol_program", {
      programAddress: normalizeSolAddress(input.programAddress),
      sourceSectionId,
    }),
    programAddress: normalizeSolAddress(input.programAddress),
    label: input.label ?? null,
    riskLevel,
    flags,
    interactionCount: input.interactionCount ?? null,
    lastInteractedAt: input.lastInteractedAt ?? null,
    isSuspicious: riskLevel !== null && riskLevel !== "low",
    sourceSectionId,
    metadata: normalizeMetadata(input.metadata),
  };
}

/**
 * Normalizes a fully hydrated Solana wallet snapshot into stable evaluation state.
 */
export function normalizeSolanaWalletSnapshot(
  input: SolanaWalletScanEvaluationInput
): NormalizedSolanaWalletSnapshot {
  if (input.request.walletChain !== "solana" || input.snapshot.walletChain !== "solana") {
    throw new Error(
      "Phase 4D Solana evaluation requires solana request and snapshot contracts."
    );
  }

  const walletAddress = normalizeSolAddress(input.request.walletAddress);
  const tokenSectionIds = findSectionIds(input, ["token", "account"]);
  const authoritySectionIds = findSectionIds(input, ["authorit"]);
  const connectionSectionIds = findSectionIds(input, ["connection", "permission", "app"]);
  const programSectionIds = findSectionIds(input, ["program", "interaction"]);

  const tokenAccounts = input.hydratedSnapshot.tokenAccounts
    .map((tokenAccount) =>
      normalizeTokenAccount(tokenAccount, walletAddress, tokenSectionIds)
    )
    .sort((left, right) =>
      left.tokenAccountAddress.localeCompare(right.tokenAccountAddress) ||
      left.mintAddress.localeCompare(right.mintAddress) ||
      compareNullable(left.delegateAddress, right.delegateAddress)
    );

  const authorityAssignments = (input.hydratedSnapshot.authorityAssignments ?? [])
    .map((assignment) => normalizeAuthorityAssignment(assignment, authoritySectionIds))
    .sort((left, right) =>
      left.authorityType.localeCompare(right.authorityType) ||
      left.subjectAddress.localeCompare(right.subjectAddress) ||
      left.authorityAddress.localeCompare(right.authorityAddress)
    );

  const connections = (input.hydratedSnapshot.connections ?? [])
    .map((connection) =>
      normalizeConnectionRecord(connection, input.snapshot.capturedAt, connectionSectionIds)
    )
    .sort((left, right) =>
      compareNullable(left.appName, right.appName) ||
      compareNullable(left.origin, right.origin) ||
      compareNullable(left.connectionId, right.connectionId) ||
      left.resourceId.localeCompare(right.resourceId)
    );

  const programExposures = (input.hydratedSnapshot.programExposures ?? [])
    .map((programExposure) =>
      normalizeProgramExposure(programExposure, programSectionIds)
    )
    .sort((left, right) =>
      left.programAddress.localeCompare(right.programAddress) ||
      left.resourceId.localeCompare(right.resourceId)
    );

  return {
    walletAddress,
    networkId: input.request.networkId,
    capturedAt: input.snapshot.capturedAt,
    tokenAccounts,
    authorityAssignments,
    connections,
    programExposures,
  };
}
