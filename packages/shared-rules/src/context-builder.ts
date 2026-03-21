import type {
  NavigationContext,
  NavigationInput,
  DomainContext,
} from "./engine/types.js";
import { RULE_SET_VERSION } from "./engine/verdict.js";
import { extractHostname, extractRegistrableDomain } from "./normalize/domain.js";
import {
  looksLikeProtocolImpersonation,
  containsMintKeyword,
  containsWalletConnectPattern,
  hasHomoglyphs,
  isIpHost,
} from "./signals/domain-signals.js";
import { normalizeUrl } from "./normalize/url.js";

/**
 * Options for building a NavigationContext.
 * Clients provide what they know; signals are computed automatically.
 */
export interface BuildContextOptions {
  /** The raw URL being navigated to. */
  rawUrl: string;
  /** Domain age in hours. Null if unknown. */
  domainAgeHours?: number | null;
  /** Whether this domain is in a known-malicious feed. */
  isKnownMaliciousDomain?: boolean;
  /** Number of redirects observed. */
  redirectCount?: number;
  /** Final domain after redirect chain. */
  finalDomain?: string;
  /** Threat feed version, if available. */
  feedVersion?: string;
  /** Domain allowlist version, if available. */
  domainAllowlistVersion?: string;
}

/**
 * Build a NavigationContext from client-provided options.
 * Computes all signals automatically from the URL.
 *
 * @param opts - Options from the client.
 * @returns A fully-populated NavigationContext.
 */
export function buildNavigationContext(opts: BuildContextOptions): NavigationContext {
  const hostname = extractHostname(opts.rawUrl);
  const normalized = normalizeUrl(opts.rawUrl);
  let path = "";
  try {
    path = new URL(normalized).pathname;
  } catch {
    // leave empty
  }

  const impersonation = looksLikeProtocolImpersonation(opts.rawUrl);

  return {
    eventKind: "navigation",
    normalized: {
      url: normalized,
      hostname,
      path,
      registrableDomain: extractRegistrableDomain(hostname),
    },
    signals: {
      looksLikeProtocolImpersonation: impersonation !== null,
      impersonatedProtocol: impersonation?.target,
      domainAgeHours: opts.domainAgeHours ?? null,
      containsWalletConnectPattern: containsWalletConnectPattern(opts.rawUrl),
      containsMintKeyword: containsMintKeyword(opts.rawUrl),
      isKnownMaliciousDomain: opts.isKnownMaliciousDomain ?? false,
      isIpHost: isIpHost(opts.rawUrl),
      hasHomoglyphs: hasHomoglyphs(opts.rawUrl),
      redirectCount: opts.redirectCount ?? 0,
      finalDomain: opts.finalDomain ?? hostname,
    },
    intel: {
      feedVersion: opts.feedVersion,
      domainAllowlistVersion: opts.domainAllowlistVersion,
    },
    meta: {
      timestamp: new Date().toISOString(),
      ruleSetVersion: RULE_SET_VERSION,
    },
  };
}

/**
 * Convert a NavigationContext to a NavigationInput for the engine.
 * This is the bridge between the rich client context and the
 * engine's simpler input type.
 *
 * @param ctx - The NavigationContext to convert.
 * @returns A NavigationInput suitable for evaluate().
 */
export function contextToInput(ctx: NavigationContext): NavigationInput {
  const domainContext: DomainContext = {
    ageHours: ctx.signals.domainAgeHours,
    isKnownMalicious: ctx.signals.isKnownMaliciousDomain,
  };

  return {
    eventKind: "navigation",
    rawUrl: ctx.normalized.url,
    domainContext,
    containsWalletConnectPattern: ctx.signals.containsWalletConnectPattern,
    hasHomoglyphs: ctx.signals.hasHomoglyphs,
    redirectCount: ctx.signals.redirectCount,
    finalDomain: ctx.signals.finalDomain,
  };
}
