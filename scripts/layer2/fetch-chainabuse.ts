import { readFile } from "node:fs/promises";

import {
  DEFAULT_CHAINABUSE_CONFIDENCE_THRESHOLD,
  isRecord,
  normalizePotentialEvmAddress,
  readArray,
  readBoolean,
  readNumber,
  type ChainabuseRecord,
} from "./normalize";

export interface FetchChainabuseOptions {
  readonly inputPath?: string;
  readonly apiUrl?: string;
  readonly apiKey?: string;
  readonly apiKeyHeader?: string;
  readonly minConfidence?: number;
  readonly fetchImpl?: typeof fetch;
}

interface ChainabuseAggregate {
  confidence: number;
  reportCount: number;
}

async function loadChainabuseSource(
  options: FetchChainabuseOptions
): Promise<unknown> {
  if (options.inputPath) {
    const text = await readFile(options.inputPath, "utf8");
    return JSON.parse(text) as unknown;
  }

  if (!options.apiUrl) {
    throw new Error(
      "Chainabuse ingestion requires either an inputPath or an apiUrl."
    );
  }

  if (!options.apiKey) {
    throw new Error("Missing Chainabuse API key.");
  }

  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new Error("Global fetch is unavailable for Chainabuse ingestion.");
  }

  const headerName = options.apiKeyHeader?.trim() || "x-api-key";
  const response = await fetchImpl(options.apiUrl, {
    headers: {
      [headerName]: options.apiKey,
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Chainabuse reports request failed with HTTP ${response.status}.`
    );
  }

  return (await response.json()) as unknown;
}

function extractReports(payload: unknown): readonly unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!isRecord(payload)) {
    throw new Error("Unsupported Chainabuse payload: expected an object or array.");
  }

  const directReports = readArray(payload, ["reports", "results", "items", "data"]);
  if (directReports) {
    return directReports;
  }

  const nestedData = payload.data;
  if (isRecord(nestedData)) {
    const nestedReports = readArray(nestedData, ["reports", "results", "items"]);
    if (nestedReports) {
      return nestedReports;
    }
  }

  throw new Error("Unsupported Chainabuse payload: reports array was not found.");
}

function extractAddresses(report: Record<string, unknown>): readonly string[] {
  const addressEntries = readArray(report, [
    "addresses",
    "walletAddresses",
    "cryptoAddresses",
  ]);
  const normalized = new Set<string>();

  if (addressEntries) {
    for (const entry of addressEntries) {
      if (typeof entry === "string") {
        const address = normalizePotentialEvmAddress(entry);
        if (address) {
          normalized.add(address);
        }

        continue;
      }

      if (isRecord(entry)) {
        for (const key of ["address", "value", "walletAddress"]) {
          const candidate = entry[key];
          if (typeof candidate !== "string") {
            continue;
          }

          const address = normalizePotentialEvmAddress(candidate);
          if (address) {
            normalized.add(address);
          }
        }
      }
    }
  }

  const singleAddress =
    typeof report.address === "string" ? report.address : undefined;
  if (singleAddress) {
    const normalizedAddress = normalizePotentialEvmAddress(singleAddress);
    if (normalizedAddress) {
      normalized.add(normalizedAddress);
    }
  }

  return [...normalized].sort();
}

export function parseChainabuseRecords(
  payload: unknown,
  minConfidence = DEFAULT_CHAINABUSE_CONFIDENCE_THRESHOLD
): readonly ChainabuseRecord[] {
  const reports = extractReports(payload);
  const aggregated = new Map<string, ChainabuseAggregate>();

  for (const entry of reports) {
    if (!isRecord(entry)) {
      continue;
    }

    const checked = readBoolean(entry, ["checked", "isChecked"]);
    if (checked !== true) {
      continue;
    }

    const confidence = readNumber(entry, ["confidence", "confidenceScore"]);
    if (confidence === null || confidence < minConfidence) {
      continue;
    }

    const addresses = extractAddresses(entry);
    if (addresses.length === 0) {
      continue;
    }

    const reportCount =
      readNumber(entry, ["reportCount", "reportsCount", "report_count"]) ?? 1;

    for (const address of addresses) {
      const current = aggregated.get(address);
      if (!current) {
        aggregated.set(address, {
          confidence,
          reportCount,
        });
        continue;
      }

      aggregated.set(address, {
        confidence: Math.max(current.confidence, confidence),
        reportCount: current.reportCount + reportCount,
      });
    }
  }

  return [...aggregated.entries()]
    .sort(([leftAddress], [rightAddress]) =>
      leftAddress.localeCompare(rightAddress)
    )
    .map(
      ([address, aggregate]): ChainabuseRecord => ({
        address,
        source: "chainabuse",
        confidence: aggregate.confidence,
        disposition: "warn",
        reportCount: aggregate.reportCount,
        reasonCodes: ["CHAINABUSE_CHECKED_REPORT"],
      })
    );
}

export async function fetchChainabuseRecords(
  options: FetchChainabuseOptions
): Promise<readonly ChainabuseRecord[]> {
  const payload = await loadChainabuseSource(options);
  return parseChainabuseRecords(
    payload,
    options.minConfidence ?? DEFAULT_CHAINABUSE_CONFIDENCE_THRESHOLD
  );
}
