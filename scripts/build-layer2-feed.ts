import { resolve } from "node:path";

import {
  fetchChainabuseRecords,
  type FetchChainabuseOptions,
} from "./layer2/fetch-chainabuse";
import {
  fetchOfacRecords,
  type FetchOfacOptions,
} from "./layer2/fetch-ofac";
import {
  buildLayer2Snapshot,
  buildSafeFallbackSnapshot,
  writeLayer2Snapshot,
} from "./layer2/build-snapshot";
import type {
  ChainabuseRecord,
  OfacRecord,
} from "./layer2/normalize";

type CliConfigKey =
  | "chainabuseApiKey"
  | "chainabuseApiKeyHeader"
  | "chainabusePath"
  | "chainabuseUrl"
  | "generatedAt"
  | "minConfidence"
  | "ofacPath"
  | "ofacUrl"
  | "output";

interface CliConfig {
  readonly chainabuseApiKey?: string;
  readonly chainabuseApiKeyHeader?: string;
  readonly chainabusePath?: string;
  readonly chainabuseUrl?: string;
  readonly generatedAt?: string;
  readonly minConfidence?: string;
  readonly ofacPath?: string;
  readonly ofacUrl?: string;
  readonly output?: string;
}

function parseCliConfig(argv: readonly string[]): CliConfig {
  const config: Partial<Record<CliConfigKey, string>> = {};

  for (const argument of argv) {
    if (!argument.startsWith("--")) {
      continue;
    }

    const [rawKey, ...valueParts] = argument.slice(2).split("=");
    const value = valueParts.join("=");
    if (!value) {
      continue;
    }

    switch (rawKey) {
      case "chainabuse-api-key":
        config.chainabuseApiKey = value;
        break;
      case "chainabuse-api-key-header":
        config.chainabuseApiKeyHeader = value;
        break;
      case "chainabuse-path":
        config.chainabusePath = value;
        break;
      case "chainabuse-url":
        config.chainabuseUrl = value;
        break;
      case "generated-at":
        config.generatedAt = value;
        break;
      case "min-confidence":
        config.minConfidence = value;
        break;
      case "ofac-path":
        config.ofacPath = value;
        break;
      case "ofac-url":
        config.ofacUrl = value;
        break;
      case "output":
        config.output = value;
        break;
      default:
        break;
    }
  }

  return config;
}

function resolveConfig(): {
  readonly generatedAt: string;
  readonly outputPath: string;
  readonly ofacOptions: FetchOfacOptions;
  readonly chainabuseOptions: FetchChainabuseOptions;
} {
  const cli = parseCliConfig(process.argv.slice(2));
  const generatedAt =
    cli.generatedAt ?? process.env.LAYER2_GENERATED_AT ?? new Date().toISOString();
  const outputPath =
    cli.output ??
    process.env.LAYER2_OUTPUT_PATH ??
    resolve(
      process.cwd(),
      "packages/shared-rules/src/intel/generated/layer2-snapshot.json"
    );

  return {
    generatedAt,
    outputPath,
    ofacOptions: {
      inputPath: cli.ofacPath ?? process.env.LAYER2_OFAC_PATH,
      inputUrl: cli.ofacUrl ?? process.env.LAYER2_OFAC_URL,
    },
    chainabuseOptions: {
      inputPath:
        cli.chainabusePath ?? process.env.LAYER2_CHAINABUSE_PATH,
      apiUrl:
        cli.chainabuseUrl ??
        process.env.LAYER2_CHAINABUSE_URL ??
        process.env.CHAINABUSE_REPORTS_URL,
      apiKey: cli.chainabuseApiKey ?? process.env.CHAINABUSE_API_KEY,
      apiKeyHeader:
        cli.chainabuseApiKeyHeader ??
        process.env.CHAINABUSE_API_KEY_HEADER,
      minConfidence: Number(
        cli.minConfidence ??
          process.env.LAYER2_CHAINABUSE_MIN_CONFIDENCE ??
          "0.7"
      ),
    },
  };
}

async function main(): Promise<void> {
  const config = resolveConfig();
  const issues: string[] = [];
  let ofacRecords: readonly OfacRecord[] = [];
  let chainabuseRecords: readonly ChainabuseRecord[] = [];

  try {
    ofacRecords = [...(await fetchOfacRecords(config.ofacOptions))];
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown OFAC error";
    issues.push(`OFAC ingestion failed: ${message}`);
  }

  try {
    chainabuseRecords = [...(await fetchChainabuseRecords(config.chainabuseOptions))];
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "unknown Chainabuse error";
    issues.push(`Chainabuse ingestion failed: ${message}`);
  }

  const snapshot =
    issues.length === 0
      ? buildLayer2Snapshot({
          generatedAt: config.generatedAt,
          ofacRecords,
          chainabuseRecords,
        })
      : buildLayer2Snapshot({
          generatedAt: config.generatedAt,
          ofacRecords,
          chainabuseRecords,
          degraded: true,
        });

  await writeLayer2Snapshot(config.outputPath, snapshot);

  if (issues.length > 0) {
    for (const issue of issues) {
      console.error(issue);
    }

    process.exitCode = 1;
    return;
  }

  console.log(`Layer 2 snapshot written to ${config.outputPath}`);
}

void main().catch(async (error: unknown) => {
  const generatedAt =
    process.env.LAYER2_GENERATED_AT ?? new Date().toISOString();
  const outputPath =
    process.env.LAYER2_OUTPUT_PATH ??
    resolve(
      process.cwd(),
      "packages/shared-rules/src/intel/generated/layer2-snapshot.json"
    );
  const snapshot = buildSafeFallbackSnapshot(generatedAt);
  await writeLayer2Snapshot(outputPath, snapshot);
  const message = error instanceof Error ? error.message : "unknown error";
  console.error(`Layer 2 build failed safe: ${message}`);
  process.exitCode = 1;
});
