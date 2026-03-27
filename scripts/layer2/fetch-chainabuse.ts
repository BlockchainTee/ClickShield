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

function readFirstPresentValue(
  record: Record<string, unknown>,
  keys: readonly string[]
): unknown {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      return record[key];
    }
  }

  return undefined;
}

function failChainabuseParse(rejections: readonly string[]): never {
  throw new Error(
    `Chainabuse payload rejected malformed record(s): ${rejections.join("; ")}`
  );
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

function extractAddresses(
  report: Record<string, unknown>
): { readonly addresses: readonly string[]; readonly malformed: boolean } {
  const addressEntries = readArray(report, [
    "addresses",
    "walletAddresses",
    "cryptoAddresses",
  ]);
  const normalized = new Set<string>();
  let malformed = false;
  let sawAddressField = false;

  if (addressEntries) {
    for (const entry of addressEntries) {
      if (typeof entry === "string") {
        sawAddressField = true;
        const address = normalizePotentialEvmAddress(entry);
        if (address) {
          normalized.add(address);
        } else {
          malformed = true;
        }

        continue;
      }

      if (isRecord(entry)) {
        let foundAddressProperty = false;
        for (const key of ["address", "value", "walletAddress"]) {
          const candidate = entry[key];
          if (typeof candidate !== "string") {
            continue;
          }

          sawAddressField = true;
          foundAddressProperty = true;
          const address = normalizePotentialEvmAddress(candidate);
          if (address) {
            normalized.add(address);
          } else {
            malformed = true;
          }
        }

        if (!foundAddressProperty) {
          malformed = true;
        }
      } else {
        malformed = true;
      }
    }
  }

  const singleAddress =
    typeof report.address === "string" ? report.address : undefined;
  if (singleAddress) {
    sawAddressField = true;
    const normalizedAddress = normalizePotentialEvmAddress(singleAddress);
    if (normalizedAddress) {
      normalized.add(normalizedAddress);
    } else {
      malformed = true;
    }
  }

  if (!sawAddressField) {
    malformed = true;
  }

  return {
    addresses: [...normalized].sort(),
    malformed,
  };
}

export function parseChainabuseRecords(
  payload: unknown,
  minConfidence = DEFAULT_CHAINABUSE_CONFIDENCE_THRESHOLD
): readonly ChainabuseRecord[] {
  const reports = extractReports(payload);
  const aggregated = new Map<string, ChainabuseAggregate>();
  const rejections: string[] = [];

  for (const [index, entry] of reports.entries()) {
    const reportPath = `reports[${index}]`;
    if (!isRecord(entry)) {
      rejections.push(`${reportPath} must be an object`);
      continue;
    }

    const checked = readBoolean(entry, ["checked", "isChecked"]);
    if (checked !== true) {
      continue;
    }

    const confidence = readNumber(entry, ["confidence", "confidenceScore"]);
    if (confidence === null) {
      rejections.push(`${reportPath} confidence must be a finite number`);
      continue;
    }

    if (confidence < minConfidence) {
      continue;
    }

    const reportCountRaw = readFirstPresentValue(entry, [
      "reportCount",
      "reportsCount",
      "report_count",
    ]);
    const reportCount =
      reportCountRaw === undefined
        ? 1
        : readNumber(entry, ["reportCount", "reportsCount", "report_count"]);

    if (
      reportCount === null ||
      !Number.isInteger(reportCount) ||
      reportCount < 1
    ) {
      rejections.push(
        `${reportPath} reportCount must be a positive integer when present`
      );
      continue;
    }

    const { addresses, malformed } = extractAddresses(entry);
    if (malformed || addresses.length === 0) {
      rejections.push(
        `${reportPath} must provide only canonical non-zero EVM addresses`
      );
      continue;
    }

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

  if (rejections.length > 0) {
    failChainabuseParse(rejections);
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
