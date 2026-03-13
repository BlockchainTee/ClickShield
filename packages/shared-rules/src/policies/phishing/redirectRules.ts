import type { RedirectChainContext } from '../../signals/redirectChain'
import {
  areRelatedHosts,
  finalHostIsUnrelatedToPriorMeaningfulHosts,
  getHostnameFromUrl,
  hasMultipleUnrelatedRedirectHops,
  isBrandHost,
  isInfrastructureHost,
  isTrackerHost,
} from '../../utils/redirectHelpers'

export type RedirectRuleId =
  | 'PHISH_REDIRECT_CHAIN_SHORTENER_TO_RISKY_FINAL'
  | 'PHISH_REDIRECT_CHAIN_TRACKER_TO_RISKY_FINAL'
  | 'PHISH_REDIRECT_CHAIN_MULTI_HOP_UNRELATED_DOMAIN'
  | 'PHISH_REDIRECT_CHAIN_BRAND_TO_UNRELATED_FINAL'

export type RedirectRuleSeverity = 'WARN' | 'BLOCK'

export interface RedirectRuleMatch {
  ruleId: RedirectRuleId
  severity: RedirectRuleSeverity
  matched: true
  evidence: {
    initialUrl: string
    finalUrl: string
    redirectCount: number
    redirectHosts: string[]
    crossDomainRedirect: boolean
    containsShortenerHop: boolean
    containsTrackerHop: boolean
  }
}

function buildMatch(
  ruleId: RedirectRuleId,
  severity: RedirectRuleSeverity,
  context: RedirectChainContext,
): RedirectRuleMatch {
  return {
    ruleId,
    severity,
    matched: true,
    evidence: {
      initialUrl: context.initialUrl,
      finalUrl: context.finalUrl,
      redirectCount: context.redirectCount,
      redirectHosts: [...context.redirectHosts],
      crossDomainRedirect: context.crossDomainRedirect,
      containsShortenerHop: context.containsShortenerHop,
      containsTrackerHop: context.containsTrackerHop,
    },
  }
}

function finalHostIsRisky(context: RedirectChainContext): boolean {
  if (!context.crossDomainRedirect) {
    return false
  }

  return finalHostIsUnrelatedToPriorMeaningfulHosts(context.redirectHosts)
}

function hasShortenerToRiskyFinal(context: RedirectChainContext): boolean {
  return context.containsShortenerHop && finalHostIsRisky(context)
}

function hasTrackerToRiskyFinal(context: RedirectChainContext): boolean {
  if (!context.containsTrackerHop) {
    return false
  }

  if (!finalHostIsRisky(context)) {
    return false
  }

  return context.redirectHosts.some((host) => isTrackerHost(host))
}

function hasBrandToUnrelatedFinal(context: RedirectChainContext): boolean {
  const initialHost = getHostnameFromUrl(context.initialUrl)
  const finalHost = getHostnameFromUrl(context.finalUrl)

  if (!isBrandHost(initialHost)) {
    return false
  }

  if (isInfrastructureHost(finalHost)) {
    return false
  }

  return !areRelatedHosts(initialHost, finalHost)
}

function hasMultiHopUnrelatedDomain(context: RedirectChainContext): boolean {
  if (context.redirectCount < 2) {
    return false
  }

  return hasMultipleUnrelatedRedirectHops(context.redirectHosts)
}

export function evaluateRedirectRules(context: RedirectChainContext): RedirectRuleMatch[] {
  const matches: RedirectRuleMatch[] = []

  if (hasShortenerToRiskyFinal(context)) {
    matches.push(
      buildMatch(
        'PHISH_REDIRECT_CHAIN_SHORTENER_TO_RISKY_FINAL',
        'BLOCK',
        context,
      ),
    )
  }

  if (hasTrackerToRiskyFinal(context)) {
    matches.push(
      buildMatch(
        'PHISH_REDIRECT_CHAIN_TRACKER_TO_RISKY_FINAL',
        'WARN',
        context,
      ),
    )
  }

  if (hasMultiHopUnrelatedDomain(context)) {
    matches.push(
      buildMatch(
        'PHISH_REDIRECT_CHAIN_MULTI_HOP_UNRELATED_DOMAIN',
        'BLOCK',
        context,
      ),
    )
  }

  if (hasBrandToUnrelatedFinal(context)) {
    matches.push(
      buildMatch(
        'PHISH_REDIRECT_CHAIN_BRAND_TO_UNRELATED_FINAL',
        'BLOCK',
        context,
      ),
    )
  }

  return matches
}
