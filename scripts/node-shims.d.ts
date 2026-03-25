declare module "node:crypto" {
  interface Hash {
    update(data: string): Hash;
    digest(encoding: "hex"): string;
  }

  export function createHash(algorithm: string): Hash;
}

declare module "node:fs/promises" {
  export function mkdir(
    path: string,
    options?: { recursive?: boolean }
  ): Promise<string | undefined>;

  export function readFile(
    path: string,
    encoding: "utf8"
  ): Promise<string>;

  export function writeFile(
    path: string,
    data: string,
    encoding: "utf8"
  ): Promise<void>;
}

declare module "node:path" {
  export function dirname(path: string): string;
  export function resolve(...paths: readonly string[]): string;
}

declare const process: {
  argv: readonly string[];
  cwd(): string;
  env: Record<string, string | undefined>;
  exitCode?: number;
};
