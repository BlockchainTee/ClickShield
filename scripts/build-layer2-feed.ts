import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

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
  type Layer2BuildSourceStatus,
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

const LAYER2_OUTPUT_RELATIVE_PATH =
  "packages/shared-rules/src/intel/generated/layer2-snapshot.json";
const ISO_UTC_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

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

function isValidUtcTimestamp(value: string): boolean {
  return ISO_UTC_TIMESTAMP_PATTERN.test(value) && !Number.isNaN(Date.parse(value));
}

function resolveGeneratedAt(cli: CliConfig, env: NodeJS.ProcessEnv): string {
  const generatedAt = cli.generatedAt ?? env.LAYER2_GENERATED_AT;
  if (!generatedAt) {
    throw new Error(
      "Layer 2 build requires --generated-at or LAYER2_GENERATED_AT for reproducible snapshots."
    );
  }

  if (!isValidUtcTimestamp(generatedAt)) {
    throw new Error(
      "Layer 2 build generatedAt must be an ISO-8601 UTC timestamp."
    );
  }

  return generatedAt;
}

export function resolveLayer2BuildConfig(
  argv: readonly string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env
): {
  readonly generatedAt: string;
  readonly outputPath: string;
  readonly ofacOptions: FetchOfacOptions;
  readonly chainabuseOptions: FetchChainabuseOptions;
} {
  const cli = parseCliConfig(argv);
  const generatedAt = resolveGeneratedAt(cli, env);
  const outputPath =
    cli.output ??
    env.LAYER2_OUTPUT_PATH ??
    resolve(process.cwd(), LAYER2_OUTPUT_RELATIVE_PATH);

  return {
    generatedAt,
    outputPath,
    ofacOptions: {
      inputPath: cli.ofacPath ?? env.LAYER2_OFAC_PATH,
      inputUrl: cli.ofacUrl ?? env.LAYER2_OFAC_URL,
    },
    chainabuseOptions: {
      inputPath: cli.chainabusePath ?? env.LAYER2_CHAINABUSE_PATH,
      apiUrl:
        cli.chainabuseUrl ??
        env.LAYER2_CHAINABUSE_URL ??
        env.CHAINABUSE_REPORTS_URL,
      apiKey: cli.chainabuseApiKey ?? env.CHAINABUSE_API_KEY,
      apiKeyHeader:
        cli.chainabuseApiKeyHeader ?? env.CHAINABUSE_API_KEY_HEADER,
      minConfidence: Number(
        cli.minConfidence ??
          env.LAYER2_CHAINABUSE_MIN_CONFIDENCE ??
          "0.7"
      ),
    },
  };
}

function hasOfacSource(options: FetchOfacOptions): boolean {
  return Boolean(options.inputPath || options.inputUrl);
}

function hasChainabuseSource(options: FetchChainabuseOptions): boolean {
  if (options.inputPath) {
    return true;
  }

  if (!options.apiUrl) {
    return false;
  }

  return Boolean(options.apiKey);
}

function missingChainabuseConfig(options: FetchChainabuseOptions): string | null {
  if (options.inputPath) {
    return null;
  }

  if (!options.apiUrl) {
    return "Chainabuse ingestion not configured: expected --chainabuse-path or --chainabuse-url.";
  }

  if (!options.apiKey) {
    return "Chainabuse ingestion not configured: apiUrl requires CHAINABUSE_API_KEY or --chainabuse-api-key.";
  }

  return null;
}

async function main(): Promise<void> {
  const config = resolveLayer2BuildConfig();
  const issues: string[] = [];
  const sourceStatuses: Layer2BuildSourceStatus[] = [];
  let ofacRecords: readonly OfacRecord[] = [];
  let chainabuseRecords: readonly ChainabuseRecord[] = [];

  if (hasOfacSource(config.ofacOptions)) {
    try {
      ofacRecords = [...(await fetchOfacRecords(config.ofacOptions))];
      sourceStatuses.push({ source: "ofac", status: "ready" });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "unknown OFAC error";
      issues.push(`OFAC ingestion failed: ${message}`);
      sourceStatuses.push({ source: "ofac", status: "failed" });
    }
  } else {
    issues.push(
      "OFAC ingestion not configured: expected --ofac-path or --ofac-url."
    );
    sourceStatuses.push({ source: "ofac", status: "missing" });
  }

  const chainabuseConfigIssue = missingChainabuseConfig(config.chainabuseOptions);
  if (chainabuseConfigIssue === null && hasChainabuseSource(config.chainabuseOptions)) {
    try {
      chainabuseRecords = [
        ...(await fetchChainabuseRecords(config.chainabuseOptions)),
      ];
      sourceStatuses.push({ source: "chainabuse", status: "ready" });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "unknown Chainabuse error";
      issues.push(`Chainabuse ingestion failed: ${message}`);
      sourceStatuses.push({ source: "chainabuse", status: "failed" });
    }
  } else {
    issues.push(
      chainabuseConfigIssue ??
        "Chainabuse ingestion not configured: expected --chainabuse-path or --chainabuse-url."
    );
    sourceStatuses.push({ source: "chainabuse", status: "missing" });
  }

  const snapshot = buildLayer2Snapshot({
    generatedAt: config.generatedAt,
    ofacRecords,
    chainabuseRecords,
    sourceStatuses,
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

async function runCli(): Promise<void> {
  try {
    await main();
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    try {
      const config = resolveLayer2BuildConfig();
      const snapshot = buildSafeFallbackSnapshot(config.generatedAt);
      await writeLayer2Snapshot(config.outputPath, snapshot);
      console.error(`Layer 2 build failed safe: ${message}`);
    } catch (configError) {
      const configMessage =
        configError instanceof Error
          ? configError.message
          : "unknown config error";
      console.error(
        `Layer 2 build failed before snapshot generation: ${configMessage}`
      );
      console.error(`Original error: ${message}`);
    }
    process.exitCode = 1;
  }
}

const executedPath = process.argv[1];
if (
  executedPath &&
  import.meta.url === pathToFileURL(executedPath).href
) {
  void runCli();
}
