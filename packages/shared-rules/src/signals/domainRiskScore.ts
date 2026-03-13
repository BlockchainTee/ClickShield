/**
 * Domain risk scoring signal engine.
 * Combines deterministic phishing signals into a numerical score.
 */

export interface DomainRiskResult {
  score: number
  signals: string[]
}

const CRYPTO_BRAND_KEYWORDS: readonly string[] = [
  'metamask',
  'walletconnect',
  'coinbase',
  'uniswap',
  'opensea',
  'ledger',
  'phantom'
]

const PHISHING_KEYWORDS: readonly string[] = [
  'login',
  'verify',
  'secure',
  'auth',
  'recovery',
  'support',
  'update'
]

const SUSPICIOUS_TLDS: readonly string[] = [
  '.xyz',
  '.top',
  '.live',
  '.site',
  '.click',
  '.link'
]

/**
 * Calculates deterministic phishing risk score for a domain.
 *
 * @param domain - Fully qualified domain
 * @param domainAgeHours - Domain age in hours or null if unknown
 * @param redirectCount - Number of redirects in navigation chain
 * @returns DomainRiskResult containing score and triggered signals
 */
export function calculateDomainRiskScore(
  domain: string,
  domainAgeHours: number | null,
  redirectCount: number
): DomainRiskResult {
  const signals: string[] = []
  let score = 0

  const normalized = domain.toLowerCase()

  // DOMAIN AGE SIGNALS
  if (domainAgeHours !== null && domainAgeHours < 24) {
    score += 40
    signals.push('NEW_DOMAIN_24H')
  } else if (domainAgeHours !== null && domainAgeHours < 168) {
    score += 20
    signals.push('NEW_DOMAIN_7D')
  }

  // CRYPTO BRAND KEYWORDS
  if (CRYPTO_BRAND_KEYWORDS.some((k) => normalized.includes(k))) {
    score += 35
    signals.push('CRYPTO_BRAND_KEYWORD')
  }

  // PHISHING KEYWORDS
  if (PHISHING_KEYWORDS.some((k) => normalized.includes(k))) {
    score += 25
    signals.push('PHISHING_KEYWORD')
  }

  // SUSPICIOUS TLD
  if (SUSPICIOUS_TLDS.some((tld) => normalized.endsWith(tld))) {
    score += 15
    signals.push('SUSPICIOUS_TLD')
  }

  // REDIRECT CHAIN
  if (redirectCount > 1) {
    score += 20
    signals.push('REDIRECT_CHAIN')
  }

  return {
    score,
    signals
  }
}
