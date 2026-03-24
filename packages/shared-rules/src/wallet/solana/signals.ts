import type {
  NormalizedSolanaWalletSnapshot,
  SolanaWalletSignals,
} from "./types.js";

/**
 * Builds pure deterministic wallet signals from a normalized Solana snapshot.
 */
export function buildSolanaWalletSignals(
  snapshot: NormalizedSolanaWalletSnapshot
): SolanaWalletSignals {
  const delegatedAccounts = snapshot.tokenAccounts.filter(
    (tokenAccount) => tokenAccount.hasDelegate
  );
  const riskyDelegates = delegatedAccounts.filter(
    (tokenAccount) => tokenAccount.isRiskyDelegate
  );
  const riskyAuthorityAssignments = snapshot.authorityAssignments.filter(
    (assignment) => assignment.isRisky
  );
  const broadConnections = snapshot.connections.filter(
    (connection) => connection.isBroadPermission
  );
  const riskyConnections = snapshot.connections.filter(
    (connection) => connection.isRisky
  );
  const staleRiskyConnections = riskyConnections.filter(
    (connection) => connection.isStaleRisky
  );
  const suspiciousPrograms = snapshot.programExposures.filter(
    (programExposure) => programExposure.isSuspicious
  );

  return {
    tokenAccountCount: snapshot.tokenAccounts.length,
    delegateCount: delegatedAccounts.length,
    delegateIds: delegatedAccounts.map((tokenAccount) => tokenAccount.resourceId),
    riskyDelegateCount: riskyDelegates.length,
    riskyDelegateIds: riskyDelegates.map((tokenAccount) => tokenAccount.resourceId),
    authorityAssignmentCount: snapshot.authorityAssignments.length,
    riskyAuthorityAssignmentCount: riskyAuthorityAssignments.length,
    riskyAuthorityAssignmentIds: riskyAuthorityAssignments.map(
      (assignment) => assignment.resourceId
    ),
    broadPermissionCount: broadConnections.length,
    broadPermissionConnectionIds: broadConnections.map(
      (connection) => connection.resourceId
    ),
    riskyConnectionCount: riskyConnections.length,
    riskyConnectionIds: riskyConnections.map((connection) => connection.resourceId),
    staleRiskyConnectionCount: staleRiskyConnections.length,
    staleRiskyConnectionIds: staleRiskyConnections.map(
      (connection) => connection.resourceId
    ),
    suspiciousProgramCount: suspiciousPrograms.length,
    suspiciousProgramIds: suspiciousPrograms.map(
      (programExposure) => programExposure.resourceId
    ),
  };
}
