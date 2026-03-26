import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  buildEmptyValidatedTransactionLayer2Snapshot,
  createTransactionIntelProvider,
  resolveCanonicalTransactionIntel,
  validateTransactionLayer2Snapshot,
} from "../../src/index.js";

function serializeCanonicalJson(value: unknown): string {
  if (value === null) {
    return "null";
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(serializeCanonicalJson).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const entries = keys.map((key) => {
    return `${JSON.stringify(key)}:${serializeCanonicalJson(record[key])}`;
  });

  return `{${entries.join(",")}}`;
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function buildSnapshotVersion(snapshotBody: {
  readonly maliciousContracts: readonly unknown[];
  readonly scamSignatures: readonly unknown[];
  readonly metadata: {
    readonly generatedAt: string;
    readonly sources: readonly string[];
  };
  readonly sectionStates: {
    readonly maliciousContracts: string;
    readonly scamSignatures: string;
  };
}): string {
  return `layer2.${sha256Hex(
    serializeCanonicalJson({
      maliciousContracts: snapshotBody.maliciousContracts,
      scamSignatures: snapshotBody.scamSignatures,
      metadata: snapshotBody.metadata,
      sectionStates: snapshotBody.sectionStates,
    })
  ).slice(0, 16)}`;
}

function buildSnapshot(input?: {
  readonly maliciousContracts?: readonly unknown[];
  readonly scamSignatures?: readonly unknown[];
  readonly generatedAt?: string;
  readonly sources?: readonly string[];
  readonly maliciousContractsState?: "ready" | "stale" | "missing";
  readonly scamSignaturesState?: "ready" | "stale" | "missing";
}) {
  const generatedAt = input?.generatedAt ?? "2026-03-24T00:00:00.000Z";
  const maliciousContracts = input?.maliciousContracts ?? [];
  const scamSignatures = input?.scamSignatures ?? [];
  const snapshotBody = {
    generatedAt,
    maliciousContracts,
    scamSignatures,
    metadata: {
      generatedAt,
      sources:
        input?.sources ??
        ["chainabuse", "internal", "ofac"].filter((source) => {
          return (
            maliciousContracts.some(
              (entry) =>
                typeof entry === "object" &&
                entry !== null &&
                "source" in entry &&
                entry.source === source
            ) ||
            scamSignatures.some(
              (entry) =>
                typeof entry === "object" &&
                entry !== null &&
                "source" in entry &&
                entry.source === source
            )
          );
        }),
    } as const,
    sectionStates: {
      maliciousContracts:
        input?.maliciousContractsState ??
        (maliciousContracts.length === 0 ? "missing" : "ready"),
      scamSignatures:
        input?.scamSignaturesState ??
        (scamSignatures.length === 0 ? "missing" : "ready"),
    } as const,
  };

  return {
    version: buildSnapshotVersion(snapshotBody),
    ...snapshotBody,
  };
}

describe("transaction Layer 2 snapshot validation", () => {
  it("accepts a valid fully populated canonical snapshot", () => {
    const input = buildSnapshot({
      maliciousContracts: [
        {
          chain: "evm",
          address: "0x9999999999999999999999999999999999999999",
          source: "ofac",
          disposition: "block",
          confidence: "high",
          reason: "OFAC sanctions address",
          reasonCodes: ["OFAC_SANCTIONS_ADDRESS"],
        },
      ],
      scamSignatures: [
        {
          signatureHash:
            "0x1111111111111111111111111111111111111111111111111111111111111111",
          source: "internal",
          confidence: "high",
          reason: "Emergency signature blocklist hotfix",
        },
      ],
      sources: ["internal", "ofac"],
    });

    const result = validateTransactionLayer2Snapshot(input);

    expect(result).toMatchObject({
      ok: true,
      status: "valid",
      issues: [],
    });
    if (!result.ok) {
      return;
    }

    expect(Object.isFrozen(result.snapshot)).toBe(true);
    expect(Object.isFrozen(result.snapshot.maliciousContracts)).toBe(true);
    expect(Object.isFrozen(result.snapshot.scamSignatures)).toBe(true);
    expect(result.snapshot.metadata).toEqual({
      generatedAt: "2026-03-24T00:00:00.000Z",
      sources: ["internal", "ofac"],
    });

    const provider = createTransactionIntelProvider(result.snapshot);
    const intel = resolveCanonicalTransactionIntel(provider, {
      eventKind: "transaction",
      targetAddress: "0x9999999999999999999999999999999999999999",
      signatureHash: null,
    });

    expect(intel.maliciousContract.disposition).toBe("malicious");
    expect(intel.maliciousContract.feedVersion).toBe(input.version);
    expect(intel.scamSignature.disposition).toBe("no_match");
  });

  it("rejects snapshots with an invalid source", () => {
    const invalid = validateTransactionLayer2Snapshot(
      buildSnapshot({
        maliciousContracts: [
          {
            chain: "evm",
            address: "0x9999999999999999999999999999999999999999",
            source: "unknown-feed",
            disposition: "block",
            confidence: "high",
            reason: "Invalid source",
            reasonCodes: ["OFAC_SANCTIONS_ADDRESS"],
          },
        ],
        sources: ["ofac"],
      })
    );

    expect(invalid).toMatchObject({
      ok: false,
      status: "incompatible",
    });
  });

  it("rejects snapshots with an invalid confidence enum", () => {
    const invalid = validateTransactionLayer2Snapshot(
      buildSnapshot({
        scamSignatures: [
          {
            signatureHash:
              "0x1111111111111111111111111111111111111111111111111111111111111111",
            source: "chainabuse",
            confidence: "critical",
            reason: "Invalid confidence",
          },
        ],
        sources: ["chainabuse"],
      })
    );

    expect(invalid).toMatchObject({
      ok: false,
      status: "incompatible",
    });
  });

  it("rejects snapshots with missing required fields", () => {
    const invalid = validateTransactionLayer2Snapshot({
      ...buildSnapshot({
        maliciousContracts: [
          {
            chain: "evm",
            source: "ofac",
            disposition: "block",
            confidence: "high",
            reason: "Missing address",
            reasonCodes: ["OFAC_SANCTIONS_ADDRESS"],
          },
        ],
        sources: ["ofac"],
      }),
    });

    expect(invalid).toMatchObject({
      ok: false,
    });
  });

  it("rejects snapshots with extra fields", () => {
    const invalid = validateTransactionLayer2Snapshot(
      buildSnapshot({
        maliciousContracts: [
          {
            chain: "evm",
            address: "0x9999999999999999999999999999999999999999",
            source: "ofac",
            disposition: "block",
            confidence: "high",
            reason: "OFAC sanctions address",
            reasonCodes: ["OFAC_SANCTIONS_ADDRESS"],
            extraField: true,
          },
        ],
        sources: ["ofac"],
      })
    );

    expect(invalid).toMatchObject({
      ok: false,
    });
  });

  it("keeps snapshot validation deterministic and read-only", () => {
    const input = buildSnapshot({
      maliciousContracts: [
        {
          chain: "evm",
          address: "0x9999999999999999999999999999999999999999",
          source: "chainabuse",
          disposition: "warn",
          confidence: "medium",
          reason: "Multiple Chainabuse reports",
          reasonCodes: ["CHAINABUSE_REPORTED_ADDRESS"],
        },
      ],
      sources: ["chainabuse"],
      maliciousContractsState: "stale",
    });

    const first = validateTransactionLayer2Snapshot(input);
    const second = validateTransactionLayer2Snapshot(input);

    expect(second).toEqual(first);
    expect(first.ok).toBe(true);
    if (!first.ok || !second.ok) {
      return;
    }

    expect(first.snapshot).toEqual(second.snapshot);
    expect(Object.isFrozen(first.snapshot)).toBe(true);
    expect(Object.isFrozen(first.snapshot.metadata)).toBe(true);
    expect(Object.isFrozen(first.snapshot.maliciousContracts[0]!)).toBe(true);
  });

  it("builds a deterministic empty validated snapshot for fail-safe activation", () => {
    const first = buildEmptyValidatedTransactionLayer2Snapshot(
      "2026-03-24T00:00:00.000Z"
    );
    const second = buildEmptyValidatedTransactionLayer2Snapshot(
      "2026-03-24T00:00:00.000Z"
    );

    expect(second).toEqual(first);
    expect(Object.isFrozen(first)).toBe(true);
    expect(first.maliciousContracts).toEqual([]);
    expect(first.scamSignatures).toEqual([]);
    expect(first.sectionStates).toEqual({
      maliciousContracts: "missing",
      scamSignatures: "missing",
    });
  });
});
