import { readFile } from "node:fs/promises";

import {
  extractEvmAddressesFromText,
  type OfacRecord,
} from "./normalize";

export interface FetchOfacOptions {
  readonly inputPath?: string;
  readonly inputUrl?: string;
  readonly fetchImpl?: typeof fetch;
}

async function loadOfacSource(options: FetchOfacOptions): Promise<string> {
  if (options.inputPath) {
    return readFile(options.inputPath, "utf8");
  }

  if (options.inputUrl) {
    const fetchImpl = options.fetchImpl ?? globalThis.fetch;
    if (typeof fetchImpl !== "function") {
      throw new Error("Global fetch is unavailable for OFAC download.");
    }

    const response = await fetchImpl(options.inputUrl);
    if (!response.ok) {
      throw new Error(`OFAC download failed with HTTP ${response.status}.`);
    }

    return response.text();
  }

  throw new Error(
    "OFAC ingestion requires either an inputPath or an inputUrl."
  );
}

export function parseOfacRecordsFromText(text: string): readonly OfacRecord[] {
  return extractEvmAddressesFromText(text).map(
    (address): OfacRecord => ({
      address,
      source: "ofac",
      disposition: "block",
      confidence: 1,
      reasonCodes: ["OFAC_SANCTIONS_ADDRESS"],
    })
  );
}

export async function fetchOfacRecords(
  options: FetchOfacOptions
): Promise<readonly OfacRecord[]> {
  const sourceText = await loadOfacSource(options);
  return parseOfacRecordsFromText(sourceText);
}
