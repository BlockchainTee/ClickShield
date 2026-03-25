import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import {
  normalizeLayer2Records,
  toCanonicalJson,
  toPrettyJson,
  type ChainabuseRecord,
  type JsonValue,
  type Layer2Snapshot,
  type OfacRecord,
} from "./normalize";

export interface BuildLayer2SnapshotOptions {
  readonly generatedAt: string;
  readonly ofacRecords: readonly OfacRecord[];
  readonly chainabuseRecords: readonly ChainabuseRecord[];
  readonly degraded?: boolean;
}

function buildSnapshotVersion(snapshotBody: Omit<Layer2Snapshot, "version">): string {
  const digest = createHash("sha256")
    .update(
      toCanonicalJson(
        {
          maliciousContracts: snapshotBody.maliciousContracts,
          scamSignatures: snapshotBody.scamSignatures,
          sectionStates: snapshotBody.sectionStates,
        } as unknown as JsonValue
      )
    )
    .digest("hex")
    .slice(0, 16);

  return `layer2.${digest}`;
}

export function buildLayer2Snapshot(
  options: BuildLayer2SnapshotOptions
): Layer2Snapshot {
  const normalized = normalizeLayer2Records({
    ofacRecords: options.ofacRecords,
    chainabuseRecords: options.chainabuseRecords,
  });

  const maliciousContractsState =
    normalized.records.length === 0
      ? "missing"
      : options.degraded
        ? "stale"
        : "ready";

  const snapshotBody: Omit<Layer2Snapshot, "version"> = {
    generatedAt: options.generatedAt,
    maliciousContracts: normalized.records,
    scamSignatures: [],
    sectionStates: {
      maliciousContracts: maliciousContractsState,
      scamSignatures: "missing",
    },
  };

  return {
    version: buildSnapshotVersion(snapshotBody),
    ...snapshotBody,
  };
}

export function buildSafeFallbackSnapshot(generatedAt: string): Layer2Snapshot {
  return buildLayer2Snapshot({
    generatedAt,
    ofacRecords: [],
    chainabuseRecords: [],
    degraded: true,
  });
}

export function serializeLayer2Snapshot(snapshot: Layer2Snapshot): string {
  return toPrettyJson(snapshot as unknown as JsonValue);
}

export async function writeLayer2Snapshot(
  outputPath: string,
  snapshot: Layer2Snapshot
): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, serializeLayer2Snapshot(snapshot), "utf8");
}
