import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
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
  readonly sectionStates: {
    readonly maliciousContracts: string;
    readonly scamSignatures: string;
  };
}): string {
  return `layer2.${sha256Hex(
    serializeCanonicalJson({
      maliciousContracts: snapshotBody.maliciousContracts,
      scamSignatures: snapshotBody.scamSignatures,
      sectionStates: snapshotBody.sectionStates,
    })
  ).slice(0, 16)}`;
}

function buildSnapshot(
  maliciousContracts: readonly unknown[],
  sectionState: "ready" | "stale" | "missing"
) {
  const snapshotBody = {
    generatedAt: "2026-03-24T00:00:00.000Z",
    maliciousContracts,
    scamSignatures: [],
    sectionStates: {
      maliciousContracts: sectionState,
      scamSignatures: "missing",
    } as const,
  };

  return {
    version: buildSnapshotVersion(snapshotBody),
    ...snapshotBody,
  };
}

describe("transaction Layer 2 snapshot validation", () => {
  it("accepts a valid canonical snapshot and resolves provider-safe intel from it", () => {
    const input = buildSnapshot(
      [
        {
          chain: "evm",
          address: "0x9999999999999999999999999999999999999999",
          source: "ofac",
          disposition: "block",
          confidence: 1,
          reasonCodes: ["OFAC_SANCTIONS_ADDRESS"],
        },
      ],
      "ready"
    );

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

    const intel = resolveCanonicalTransactionIntel(
      result.snapshot,
      {
        eventKind: "transaction",
        targetAddress: "0x9999999999999999999999999999999999999999",
      },
      {
        originDisposition: "no_match",
        allowlistFeedVersion: null,
        allowlistsState: "missing",
      }
    );

    expect(intel.contractDisposition).toBe("malicious");
    expect(intel.contractFeedVersion).toBe(input.version);
    expect(intel.signatureDisposition).toBe("unavailable");
    expect(intel.sectionStates.maliciousContracts).toBe("fresh");
  });

  it("rejects malformed and incompatible snapshots explicitly", () => {
    const malformed = validateTransactionLayer2Snapshot({
      version: "layer2.1234567890abcdef",
      generatedAt: "2026-03-24T00:00:00.000Z",
      maliciousContracts: {},
      scamSignatures: [],
      sectionStates: {
        maliciousContracts: "missing",
        scamSignatures: "missing",
      },
    });

    expect(malformed).toMatchObject({
      ok: false,
      status: "malformed",
    });

    const incompatible = validateTransactionLayer2Snapshot({
      ...buildSnapshot([], "missing"),
      scamSignatures: [
        {
          selector: "0xdeadbeef",
        },
      ],
    });

    expect(incompatible).toMatchObject({
      ok: false,
      status: "incompatible",
    });
  });

  it("keeps empty valid snapshots deterministic and distinct from malformed input", () => {
    const emptySnapshot = buildSnapshot([], "missing");

    const first = validateTransactionLayer2Snapshot(emptySnapshot);
    const second = validateTransactionLayer2Snapshot(emptySnapshot);
    const malformed = validateTransactionLayer2Snapshot({
      ...emptySnapshot,
      maliciousContracts: {},
    });

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      ok: true,
      status: "empty",
      issues: [],
    });
    expect(malformed).toMatchObject({
      ok: false,
      status: "malformed",
    });

    if (!first.ok) {
      return;
    }

    const intel = resolveCanonicalTransactionIntel(
      first.snapshot,
      {
        eventKind: "transaction",
        targetAddress: "0x9999999999999999999999999999999999999999",
      },
      {
        originDisposition: "unavailable",
        allowlistFeedVersion: null,
        allowlistsState: "missing",
      }
    );

    expect(intel.contractDisposition).toBe("unavailable");
    expect(intel.sectionStates.maliciousContracts).toBe("missing");
  });
});
