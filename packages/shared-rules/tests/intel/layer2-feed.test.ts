import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { validateTransactionLayer2Snapshot } from "../../src/index.js";
import {
  parseChainabuseRecords,
} from "../../../../scripts/layer2/fetch-chainabuse";
import {
  fetchOfacRecords,
  parseOfacRecordsFromText,
} from "../../../../scripts/layer2/fetch-ofac";
import {
  buildLayer2Snapshot,
  buildSafeFallbackSnapshot,
  serializeLayer2Snapshot,
  writeLayer2Snapshot,
} from "../../../../scripts/layer2/build-snapshot";
import { resolveLayer2BuildConfig } from "../../../../scripts/build-layer2-feed";
import { normalizeLayer2Records } from "../../../../scripts/layer2/normalize";

const GENERATED_AT = "2026-03-24T12:00:00.000Z";
const tempDirs: string[] = [];

afterEach(async () => {
  while (tempDirs.length > 0) {
    const directory = tempDirs.pop();
    if (!directory) {
      continue;
    }

    await rm(directory, { recursive: true, force: true });
  }
});

async function makeTempDir(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "clickshield-layer2-"));
  tempDirs.push(directory);
  return directory;
}

describe("Layer 2 feed builder", () => {
  it("builds the same snapshot for the same inputs and writes deterministic JSON", async () => {
    const directory = await makeTempDir();
    const ofacPath = join(directory, "ofac.txt");
    const chainabusePath = join(directory, "chainabuse.json");
    const outputPath = join(directory, "layer2-snapshot.json");

    await writeFile(
      ofacPath,
      [
        "OFAC sanctioned wallet 0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        "duplicate 0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      ].join("\n"),
      "utf8"
    );
    await writeFile(
      chainabusePath,
      JSON.stringify({
        reports: [
          {
            checked: true,
            confidence: 0.92,
            reportCount: 4,
            addresses: [
              "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            ],
          },
        ],
      }),
      "utf8"
    );

    const ofacRecords = await fetchOfacRecords({ inputPath: ofacPath });
    const chainabuseRecords = parseChainabuseRecords(
      JSON.parse(await readFile(chainabusePath, "utf8")) as unknown
    );

    const firstSnapshot = buildLayer2Snapshot({
      generatedAt: GENERATED_AT,
      ofacRecords,
      chainabuseRecords,
    });
    const secondSnapshot = buildLayer2Snapshot({
      generatedAt: GENERATED_AT,
      ofacRecords,
      chainabuseRecords,
    });

    expect(firstSnapshot).toEqual(secondSnapshot);
    expect(serializeLayer2Snapshot(firstSnapshot)).toBe(
      serializeLayer2Snapshot(secondSnapshot)
    );
    expect(validateTransactionLayer2Snapshot(firstSnapshot)).toMatchObject({
      ok: true,
      status: "valid",
    });
    expect(firstSnapshot.metadata).toEqual({
      generatedAt: GENERATED_AT,
      sources: ["chainabuse", "ofac"],
    });
    expect(firstSnapshot.sectionStates.maliciousContracts).toBe("ready");
    expect(firstSnapshot.maliciousContracts).toEqual([
      {
        chain: "evm",
        address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        source: "ofac",
        disposition: "block",
        confidence: "high",
        reason: "OFAC sanctions list match",
        reasonCodes: ["OFAC_SANCTIONS_ADDRESS"],
      },
      {
        chain: "evm",
        address: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        source: "chainabuse",
        disposition: "warn",
        confidence: "medium",
        reason: "Chainabuse checked reports indicate suspicious activity",
        reasonCodes: ["CHAINABUSE_CHECKED_REPORT"],
      },
    ]);

    await writeLayer2Snapshot(outputPath, firstSnapshot);
    expect(await readFile(outputPath, "utf8")).toBe(
      serializeLayer2Snapshot(firstSnapshot)
    );
  });

  it("dedupes records and lets OFAC override Chainabuse for the same address", () => {
    const ofacRecords = parseOfacRecordsFromText(
      "0xcccccccccccccccccccccccccccccccccccccccc"
    );
    const chainabuseRecords = parseChainabuseRecords({
      reports: [
        {
          checked: true,
          confidence: 0.7,
          reportCount: 1,
          addresses: [
            "0xcccccccccccccccccccccccccccccccccccccccc",
            "0xdddddddddddddddddddddddddddddddddddddddd",
          ],
        },
        {
          checked: true,
          confidence: 0.95,
          reportCount: 2,
          addresses: [
            "0xdddddddddddddddddddddddddddddddddddddddd",
          ],
        },
      ],
    });

    const snapshot = buildLayer2Snapshot({
      generatedAt: GENERATED_AT,
      ofacRecords,
      chainabuseRecords,
    });

    expect(snapshot.maliciousContracts).toEqual([
      {
        chain: "evm",
        address: "0xcccccccccccccccccccccccccccccccccccccccc",
        source: "ofac",
        disposition: "block",
        confidence: "high",
        reason: "OFAC sanctions list match",
        reasonCodes: ["OFAC_SANCTIONS_ADDRESS"],
      },
      {
        chain: "evm",
        address: "0xdddddddddddddddddddddddddddddddddddddddd",
        source: "chainabuse",
        disposition: "warn",
        confidence: "medium",
        reason: "Chainabuse checked reports indicate suspicious activity",
        reasonCodes: ["CHAINABUSE_CHECKED_REPORT"],
      },
    ]);
  });

  it("rejects malformed normalized compiler inputs instead of coercing them", () => {
    expect(() =>
      buildLayer2Snapshot({
        generatedAt: GENERATED_AT,
        ofacRecords: [
          {
            address: "0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
            source: "ofac",
            disposition: "block",
            confidence: 1,
            reasonCodes: ["OFAC_SANCTIONS_ADDRESS"],
          },
        ],
        chainabuseRecords: [],
      })
    ).toThrow("lowercase canonical EVM address");
  });

  it("uses explicit source precedence so weaker feeds cannot erase malicious entries", () => {
    const normalized = normalizeLayer2Records({
      ofacRecords: parseOfacRecordsFromText(
        "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
      ),
      chainabuseRecords: [
        {
          address: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
          source: "chainabuse",
          confidence: 0.99,
          disposition: "warn",
          reportCount: 3,
          reasonCodes: ["CHAINABUSE_CHECKED_REPORT"],
        },
      ],
    });

    expect(normalized.sources).toEqual(["chainabuse", "ofac"]);
    expect(normalized.records).toEqual([
      {
        chain: "evm",
        address: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        source: "ofac",
        disposition: "block",
        confidence: "high",
        reason: "OFAC sanctions list match",
        reasonCodes: ["OFAC_SANCTIONS_ADDRESS"],
      },
    ]);
  });

  it("produces the same canonical snapshot across reordered compiler inputs", () => {
    const first = buildLayer2Snapshot({
      generatedAt: GENERATED_AT,
      ofacRecords: [
        {
          address: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          source: "ofac",
          disposition: "block",
          confidence: 1,
          reasonCodes: ["OFAC_SANCTIONS_ADDRESS"],
        },
        {
          address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          source: "ofac",
          disposition: "block",
          confidence: 1,
          reasonCodes: ["OFAC_SANCTIONS_ADDRESS"],
        },
      ],
      chainabuseRecords: [
        {
          address: "0xcccccccccccccccccccccccccccccccccccccccc",
          source: "chainabuse",
          confidence: 0.91,
          disposition: "warn",
          reportCount: 2,
          reasonCodes: ["CHAINABUSE_CHECKED_REPORT"],
        },
        {
          address: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          source: "chainabuse",
          confidence: 0.99,
          disposition: "warn",
          reportCount: 5,
          reasonCodes: ["CHAINABUSE_CHECKED_REPORT"],
        },
      ],
    });
    const second = buildLayer2Snapshot({
      generatedAt: GENERATED_AT,
      ofacRecords: [
        {
          address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          source: "ofac",
          disposition: "block",
          confidence: 1,
          reasonCodes: ["OFAC_SANCTIONS_ADDRESS"],
        },
        {
          address: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          source: "ofac",
          disposition: "block",
          confidence: 1,
          reasonCodes: ["OFAC_SANCTIONS_ADDRESS"],
        },
      ],
      chainabuseRecords: [
        {
          address: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          source: "chainabuse",
          confidence: 0.99,
          disposition: "warn",
          reportCount: 5,
          reasonCodes: ["CHAINABUSE_CHECKED_REPORT"],
        },
        {
          address: "0xcccccccccccccccccccccccccccccccccccccccc",
          source: "chainabuse",
          confidence: 0.91,
          disposition: "warn",
          reportCount: 2,
          reasonCodes: ["CHAINABUSE_CHECKED_REPORT"],
        },
      ],
    });

    expect(second).toEqual(first);
  });

  it("maps Chainabuse only into suspicious-address intelligence and never scam signatures", () => {
    const snapshot = buildLayer2Snapshot({
      generatedAt: GENERATED_AT,
      ofacRecords: [],
      chainabuseRecords: [
        {
          address: "0xffffffffffffffffffffffffffffffffffffffff",
          source: "chainabuse",
          confidence: 0.91,
          disposition: "warn",
          reportCount: 1,
          reasonCodes: ["CHAINABUSE_CHECKED_REPORT"],
        },
      ],
    });

    expect(snapshot.maliciousContracts).toEqual([
      {
        chain: "evm",
        address: "0xffffffffffffffffffffffffffffffffffffffff",
        source: "chainabuse",
        disposition: "warn",
        confidence: "low",
        reason: "Chainabuse checked report indicates suspicious activity",
        reasonCodes: ["CHAINABUSE_CHECKED_REPORT"],
      },
    ]);
    expect(snapshot.scamSignatures).toEqual([]);
    expect(snapshot.sectionStates.scamSignatures).toBe("missing");
  });

  it("fails safe to a missing snapshot when malformed data cannot be normalized", () => {
    expect(() => parseChainabuseRecords({ unsupported: true })).toThrow(
      "reports array was not found"
    );

    const snapshot = buildSafeFallbackSnapshot(GENERATED_AT);

    expect(snapshot).toEqual({
      version: snapshot.version,
      generatedAt: GENERATED_AT,
      maliciousContracts: [],
      scamSignatures: [],
      metadata: {
        generatedAt: GENERATED_AT,
        sources: [],
      },
      sectionStates: {
        maliciousContracts: "missing",
        scamSignatures: "missing",
      },
    });
  });

  it("rejects malformed checked Chainabuse reports instead of silently dropping them", () => {
    expect(() =>
      parseChainabuseRecords({
        reports: [
          {
            checked: true,
            confidence: 0.87,
            addresses: [
              "not-an-address",
              "0x3333333333333333333333333333333333333333",
            ],
          },
        ],
      })
    ).toThrow("rejected malformed record");
  });

  it("filters unchecked and low-confidence Chainabuse reports without treating them as malformed", () => {
    const chainabuseRecords = parseChainabuseRecords({
      reports: [
        {
          checked: false,
          confidence: 0.99,
          addresses: [
            "0x1111111111111111111111111111111111111111",
          ],
        },
        {
          checked: true,
          confidence: 0.5,
          addresses: [
            "0x2222222222222222222222222222222222222222",
          ],
        },
        {
          checked: true,
          confidence: 0.87,
          addresses: [
            "0x3333333333333333333333333333333333333333",
          ],
        },
      ],
    });

    expect(chainabuseRecords).toEqual([
      {
        address: "0x3333333333333333333333333333333333333333",
        source: "chainabuse",
        confidence: 0.87,
        disposition: "warn",
        reportCount: 1,
        reasonCodes: ["CHAINABUSE_CHECKED_REPORT"],
      },
    ]);
  });

  it("keeps empty but successfully loaded feeds distinct from a missing snapshot", () => {
    const snapshot = buildLayer2Snapshot({
      generatedAt: GENERATED_AT,
      ofacRecords: [],
      chainabuseRecords: [],
      sourceStatuses: [
        { source: "chainabuse", status: "ready" },
        { source: "ofac", status: "ready" },
      ],
    });

    expect(snapshot.metadata.sources).toEqual([]);
    expect(snapshot.sectionStates).toEqual({
      maliciousContracts: "ready",
      scamSignatures: "missing",
    });
    expect(validateTransactionLayer2Snapshot(snapshot)).toMatchObject({
      ok: true,
      status: "empty",
    });
  });

  it("marks partially available source builds as stale instead of healthy", () => {
    const snapshot = buildLayer2Snapshot({
      generatedAt: GENERATED_AT,
      ofacRecords: parseOfacRecordsFromText(
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      ),
      chainabuseRecords: [],
      sourceStatuses: [
        { source: "chainabuse", status: "missing" },
        { source: "ofac", status: "ready" },
      ],
    });

    expect(snapshot.metadata.sources).toEqual(["ofac"]);
    expect(snapshot.sectionStates.maliciousContracts).toBe("stale");
  });

  it("requires explicit generatedAt config for reproducible snapshot builds", () => {
    expect(() => resolveLayer2BuildConfig([], {})).toThrow(
      "requires --generated-at or LAYER2_GENERATED_AT"
    );
  });
});
