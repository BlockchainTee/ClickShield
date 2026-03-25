import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

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
    expect(firstSnapshot.sectionStates.maliciousContracts).toBe("ready");
    expect(firstSnapshot.maliciousContracts).toEqual([
      {
        chain: "evm",
        address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        source: "ofac",
        disposition: "block",
        confidence: 1,
        reasonCodes: ["OFAC_SANCTIONS_ADDRESS"],
      },
      {
        chain: "evm",
        address: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        source: "chainabuse",
        disposition: "warn",
        confidence: 0.92,
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
        confidence: 1,
        reasonCodes: ["OFAC_SANCTIONS_ADDRESS"],
      },
      {
        chain: "evm",
        address: "0xdddddddddddddddddddddddddddddddddddddddd",
        source: "chainabuse",
        disposition: "warn",
        confidence: 0.95,
        reasonCodes: ["CHAINABUSE_CHECKED_REPORT"],
      },
    ]);
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
      sectionStates: {
        maliciousContracts: "missing",
        scamSignatures: "missing",
      },
    });
  });

  it("filters unchecked, low-confidence, and invalid addresses from Chainabuse", () => {
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
            "not-an-address",
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
});
