import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import {
  normalizeLayer2Records,
  toCanonicalJson,
  toPrettyJson,
  type ChainabuseRecord,
  type JsonValue,
  type Layer2CompilerSource,
  type Layer2Snapshot,
  type OfacRecord,
} from "./normalize";

export interface Layer2BuildSourceStatus {
  readonly source: Layer2CompilerSource;
  readonly status: "ready" | "missing" | "failed";
}

export interface BuildLayer2SnapshotOptions {
  readonly generatedAt: string;
  readonly ofacRecords: readonly OfacRecord[];
  readonly chainabuseRecords: readonly ChainabuseRecord[];
  readonly sourceStatuses?: readonly Layer2BuildSourceStatus[];
}

const DEFAULT_SOURCE_STATUSES: readonly Layer2BuildSourceStatus[] = Object.freeze([
  { source: "chainabuse", status: "ready" },
  { source: "ofac", status: "ready" },
]);

function buildSnapshotVersion(snapshotBody: Omit<Layer2Snapshot, "version">): string {
  const digest = createHash("sha256")
    .update(
      toCanonicalJson(
        {
          maliciousContracts: snapshotBody.maliciousContracts,
          scamSignatures: snapshotBody.scamSignatures,
          metadata: snapshotBody.metadata,
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

  const sourceStatuses = [...(options.sourceStatuses ?? DEFAULT_SOURCE_STATUSES)]
    .sort((left, right) => left.source.localeCompare(right.source));
  const readySourceCount = sourceStatuses.filter(
    (entry) => entry.status === "ready"
  ).length;
  const allSourcesReady =
    sourceStatuses.length > 0 &&
    sourceStatuses.every((entry) => entry.status === "ready");
  const maliciousContractsState =
    readySourceCount === 0 ? "missing" : allSourcesReady ? "ready" : "stale";

  const snapshotBody: Omit<Layer2Snapshot, "version"> = {
    generatedAt: options.generatedAt,
    maliciousContracts: normalized.records,
    scamSignatures: [],
    metadata: {
      generatedAt: options.generatedAt,
      sources: normalized.sources,
    },
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
    sourceStatuses: [
      { source: "chainabuse", status: "missing" },
      { source: "ofac", status: "missing" },
    ],
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
