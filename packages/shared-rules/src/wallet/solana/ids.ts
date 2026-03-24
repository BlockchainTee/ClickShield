import { serializeCanonicalJson, sha256Hex } from "../../intel/hash.js";

type CanonicalJsonValue =
  | null
  | boolean
  | number
  | string
  | readonly CanonicalJsonValue[]
  | { readonly [key: string]: CanonicalJsonValue };

/**
 * Builds a stable short identifier from a canonical JSON payload.
 */
export function buildStableId(
  prefix: string,
  payload: CanonicalJsonValue
): string {
  return `${prefix}_${sha256Hex(serializeCanonicalJson(payload)).slice(0, 24)}`;
}
