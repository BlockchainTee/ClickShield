import { describe, it, expect } from 'vitest'
import { evaluateDomainRiskRule } from '../policies/phishing/domainRiskRule'

describe('PHISH_DOMAIN_RISK_SCORE', () => {
  it('SAFE DOMAIN → ALLOW', () => {
    const result = evaluateDomainRiskRule({
      domain: 'google.com',
      domainAgeHours: 500,
      redirectCount: 0
    })

    expect(result.severity).toBe('ALLOW')
    expect(result.evidence.score).toBe(0)
    expect(result.evidence.signals.length).toBe(0)
  })

  it('MEDIUM RISK DOMAIN → WARN', () => {
    const result = evaluateDomainRiskRule({
      domain: 'walletconnect-support.com',
      domainAgeHours: 200,
      redirectCount: 0
    })

    expect(result.severity).toBe('WARN')
    expect(result.evidence.score).toBeGreaterThanOrEqual(50)
    expect(result.evidence.signals).toContain('CRYPTO_BRAND_KEYWORD')
    expect(result.evidence.signals).toContain('PHISHING_KEYWORD')
  })

  it('HIGH RISK DOMAIN → BLOCK', () => {
    const result = evaluateDomainRiskRule({
      domain: 'metamask-login-secure.xyz',
      domainAgeHours: 5,
      redirectCount: 2
    })

    expect(result.severity).toBe('BLOCK')
    expect(result.evidence.score).toBeGreaterThanOrEqual(80)
    expect(result.evidence.signals).toContain('NEW_DOMAIN_24H')
    expect(result.evidence.signals).toContain('CRYPTO_BRAND_KEYWORD')
    expect(result.evidence.signals).toContain('PHISHING_KEYWORD')
    expect(result.evidence.signals).toContain('SUSPICIOUS_TLD')
    expect(result.evidence.signals).toContain('REDIRECT_CHAIN')
  })
})
