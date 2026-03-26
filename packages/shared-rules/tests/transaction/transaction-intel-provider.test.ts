import { createHash } from "node:crypto";
import * as fs from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
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

function buildSnapshot(input: {
  readonly maliciousContracts: readonly unknown[];
  readonly maliciousContractsState: "ready" | "stale" | "missing";
  readonly scamSignatures?: readonly unknown[];
  readonly scamSignaturesState?: "ready" | "stale" | "missing";
}) {
  const scamSignatures = input.scamSignatures ?? [];
  const snapshotBody = {
    generatedAt: "2026-03-24T00:00:00.000Z",
    maliciousContracts: input.maliciousContracts,
    scamSignatures,
    metadata: {
      generatedAt: "2026-03-24T00:00:00.000Z",
      sources:
        input.maliciousContracts.length === 0 && scamSignatures.length === 0
          ? []
          : ["chainabuse", "internal", "ofac"].filter((source) =>
              input.maliciousContracts.some(
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
            ),
    } as const,
    sectionStates: {
      maliciousContracts: input.maliciousContractsState,
      scamSignatures:
        input.scamSignaturesState ??
        (scamSignatures.length === 0 ? "missing" : "ready"),
    } as const,
  };

  return {
    version: buildSnapshotVersion(snapshotBody),
    ...snapshotBody,
  };
}

function buildValidatedSnapshot(input: {
  readonly maliciousContracts: readonly unknown[];
  readonly maliciousContractsState: "ready" | "stale" | "missing";
  readonly scamSignatures?: readonly unknown[];
  readonly scamSignaturesState?: "ready" | "stale" | "missing";
}) {
  const result = validateTransactionLayer2Snapshot(buildSnapshot(input));

  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error("expected validated transaction snapshot");
  }

  return result.snapshot;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("transaction intel provider", () => {
  it("resolves exact malicious-contract matches and stable no-match results", () => {
    const provider = createTransactionIntelProvider(
      buildValidatedSnapshot(
        {
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
          maliciousContractsState: "ready",
        }
      )
    );

    const firstMatch = provider.lookupMaliciousContract({
      chain: "evm",
      address: "0x9999999999999999999999999999999999999999",
    });
    const secondMatch = provider.lookupMaliciousContract({
      chain: "evm",
      address: "0x9999999999999999999999999999999999999999",
    });
    const firstMiss = provider.lookupMaliciousContract({
      chain: "evm",
      address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    });
    const secondMiss = provider.lookupMaliciousContract({
      chain: "evm",
      address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    });

    expect(firstMatch).toBe(secondMatch);
    expect(firstMatch).toMatchObject({
      lookupFamily: "contract",
      matched: true,
      disposition: "malicious",
      matchedSection: "maliciousContracts",
      sectionState: "fresh",
    });
    expect(firstMatch.record).toEqual({
      chain: "evm",
      address: "0x9999999999999999999999999999999999999999",
      source: "ofac",
      disposition: "block",
      confidence: "high",
      reasonCodes: ["OFAC_SANCTIONS_ADDRESS"],
    });

    expect(firstMiss).toBe(secondMiss);
    expect(firstMiss).toMatchObject({
      lookupFamily: "contract",
      matched: false,
      disposition: "no_match",
      sectionState: "fresh",
      record: null,
    });
  });

  it("keeps empty validated snapshots deterministic and fail-safe", () => {
    const provider = createTransactionIntelProvider(
      buildValidatedSnapshot({
        maliciousContracts: [],
        maliciousContractsState: "missing",
      })
    );

    const firstCanonicalLookup = provider.lookupCanonicalTransactionIntel({
      eventKind: "transaction",
      targetAddress: "0x9999999999999999999999999999999999999999",
      signatureHash: null,
    });
    const secondCanonicalLookup = provider.lookupCanonicalTransactionIntel({
      eventKind: "transaction",
      targetAddress: "0x9999999999999999999999999999999999999999",
      signatureHash: null,
    });

    expect(firstCanonicalLookup).toBe(secondCanonicalLookup);
    expect(firstCanonicalLookup).toMatchObject({
      maliciousContract: {
        matched: false,
        disposition: "no_match",
        feedVersion: provider.snapshotVersion,
        sectionState: "missing",
        record: null,
      },
      scamSignature: {
        lookupFamily: "scam_signature",
        matched: false,
        disposition: "no_match",
        feedVersion: provider.snapshotVersion,
        sectionState: "missing",
        record: null,
      },
    });
  });

  it("resolves exact scam-signature matches with stable exact-key behavior", () => {
    const signatureHash =
      "0x1111111111111111111111111111111111111111111111111111111111111111";
    const provider = createTransactionIntelProvider(
      buildValidatedSnapshot({
        maliciousContracts: [],
        maliciousContractsState: "missing",
        scamSignatures: [
          {
            signatureHash,
            source: "internal",
            confidence: "high",
            reason: "Known scam typed-data signature",
          },
        ],
        scamSignaturesState: "ready",
      })
    );

    const firstMatch = provider.lookupScamSignature({
      normalizedKey: signatureHash,
    });
    const secondMatch = provider.lookupScamSignature({
      normalizedKey: signatureHash,
    });
    const miss = provider.lookupScamSignature({
      normalizedKey:
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    });

    expect(firstMatch).toBe(secondMatch);
    expect(firstMatch).toMatchObject({
      lookupFamily: "scam_signature",
      matched: true,
      disposition: "malicious",
      matchedSection: "scamSignatures",
      sectionState: "fresh",
      record: {
        signatureHash,
        source: "internal",
        confidence: "high",
        reason: "Known scam typed-data signature",
      },
    });
    expect(miss).toMatchObject({
      lookupFamily: "scam_signature",
      matched: false,
      disposition: "no_match",
      sectionState: "fresh",
      record: null,
    });
  });

  it("returns frozen provider results that cannot mutate active state", () => {
    const provider = createTransactionIntelProvider(
      buildValidatedSnapshot(
        {
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
          maliciousContractsState: "ready",
        }
      )
    );

    const lookup = provider.lookupCanonicalTransactionIntel({
      eventKind: "signature",
      targetAddress: "0x9999999999999999999999999999999999999999",
      signatureHash: null,
    });

    expect(Object.isFrozen(lookup)).toBe(true);
    expect(Object.isFrozen(lookup.maliciousContract)).toBe(true);
    expect(Object.isFrozen(lookup.maliciousContract.record)).toBe(true);
    expect(Object.isFrozen(lookup.maliciousContract.record?.reasonCodes)).toBe(true);
    expect(Reflect.set(lookup, "scamSignature", null)).toBe(false);
    expect(
      Reflect.set(lookup.maliciousContract.record!, "address", ZERO_ADDRESS)
    ).toBe(false);
    expect(
      Reflect.set(lookup.maliciousContract.record!.reasonCodes, 0, "MUTATED")
    ).toBe(false);

    const repeatedLookup = provider.lookupCanonicalTransactionIntel({
      eventKind: "signature",
      targetAddress: "0x9999999999999999999999999999999999999999",
      signatureHash: null,
    });

    expect(repeatedLookup).toBe(lookup);
    expect(repeatedLookup.maliciousContract.record?.address).toBe(
      "0x9999999999999999999999999999999999999999"
    );
    expect(repeatedLookup.maliciousContract.record?.reasonCodes).toEqual([
      "OFAC_SANCTIONS_ADDRESS",
    ]);
  });

  it("makes resolveCanonicalTransactionIntel a transparent provider passthrough", () => {
    const provider = createTransactionIntelProvider(
      buildValidatedSnapshot(
        {
          maliciousContracts: [
            {
              chain: "evm",
              address: "0x9999999999999999999999999999999999999999",
              source: "chainabuse",
              disposition: "warn",
              confidence: "medium",
              reason: "Chainabuse reports indicate elevated risk",
              reasonCodes: ["CHAINABUSE_REPORTED_ADDRESS"],
            },
          ],
          maliciousContractsState: "stale",
        }
      )
    );
    const lookup = {
      eventKind: "transaction" as const,
      targetAddress: "0x9999999999999999999999999999999999999999",
      signatureHash: null,
    };

    const providerLookup = provider.lookupCanonicalTransactionIntel(lookup);
    const wrapperLookup = resolveCanonicalTransactionIntel(provider, lookup);

    expect(wrapperLookup).toBe(providerLookup);
    expect("allowlistFeedVersion" in wrapperLookup).toBe(false);
    expect("originDisposition" in wrapperLookup).toBe(false);
    expect("sectionStates" in wrapperLookup).toBe(false);
    expect(wrapperLookup).toMatchObject({
      maliciousContract: {
        disposition: "malicious",
        feedVersion: provider.snapshotVersion,
        sectionState: "stale",
      },
      scamSignature: {
        disposition: "no_match",
        feedVersion: provider.snapshotVersion,
        sectionState: "missing",
        record: null,
      },
    });
  });

  it("remains synchronous, read-only, and in sync with generated surface bundles", () => {
    const fetchSpy = vi.fn(() => {
      throw new Error("unexpected fetch");
    });
    vi.stubGlobal("fetch", fetchSpy);

    const providerSource = fs.readFileSync(
      new URL("../../src/transaction/intel-provider.ts", import.meta.url),
      "utf8"
    );
    const desktopBundle = fs.readFileSync(
      new URL("../../../../desktop/src/lib/shared-rules.js", import.meta.url),
      "utf8"
    );
    const extensionBundle = fs.readFileSync(
      new URL("../../../../extension-web/lib/shared-rules.js", import.meta.url),
      "utf8"
    );
    const leakedKey = ["maliciousContract", "Index"].join("");

    const provider = createTransactionIntelProvider(
      buildValidatedSnapshot(
        {
          maliciousContracts: [
            {
              chain: "evm",
              address: "0x9999999999999999999999999999999999999999",
              source: "chainabuse",
              disposition: "warn",
              confidence: "medium",
              reason: "Chainabuse reports indicate elevated risk",
              reasonCodes: ["CHAINABUSE_REPORTED_ADDRESS"],
            },
          ],
          maliciousContractsState: "stale",
        }
      )
    );

    const result = provider.lookupCanonicalTransactionIntel({
      eventKind: "transaction",
      targetAddress: "0x9999999999999999999999999999999999999999",
      signatureHash: null,
    });

    expect(result).not.toBeInstanceOf(Promise);
    expect(result).toMatchObject({
      maliciousContract: {
        matched: true,
        disposition: "malicious",
        sectionState: "stale",
      },
    });

    expect(providerSource).toContain(
      "return provider.lookupCanonicalTransactionIntel(lookup);"
    );
    for (const bundle of [desktopBundle, extensionBundle]) {
      expect(bundle).toContain("lookupCanonicalTransactionIntel");
      expect(bundle).toContain(
        "return provider.lookupCanonicalTransactionIntel(lookup);"
      );
      expect(bundle).not.toContain(leakedKey);
    }

    expect(providerSource).not.toContain('from "node:fs"');
    expect(providerSource).not.toContain('from "fs"');
    expect(providerSource).not.toContain("fetch(");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
