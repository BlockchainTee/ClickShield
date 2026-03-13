import { describe, expect, it } from 'vitest'
import { buildRedirectChainContext } from '../signals/redirectChain'
import { evaluateRedirectRules } from '../policies/phishing/redirectRules'

describe('redirectRules', () => {
  it('validates safe same-domain redirect', () => {
    const context = buildRedirectChainContext({
      initialUrl: 'https://accounts.example.com/login',
      redirectUrls: ['https://www.example.com/session/start'],
    })

    expect(context).toEqual({
      initialUrl: 'https://accounts.example.com/login',
      finalUrl: 'https://www.example.com/session/start',
      redirectCount: 1,
      redirectHosts: ['accounts.example.com', 'www.example.com'],
      crossDomainRedirect: false,
      containsShortenerHop: false,
      containsTrackerHop: false,
    })

    expect(evaluateRedirectRules(context)).toEqual([])
  })

  it('detects a shortener redirect attack', () => {
    const context = buildRedirectChainContext({
      initialUrl: 'https://twitter.com/brand/status/12345',
      redirectUrls: [
        'https://bit.ly/promo-offer',
        'https://login-alert-security-check.com/verify',
      ],
    })

    const matches = evaluateRedirectRules(context)

    expect(matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'PHISH_REDIRECT_CHAIN_SHORTENER_TO_RISKY_FINAL',
          severity: 'BLOCK',
        }),
        expect.objectContaining({
          ruleId: 'PHISH_REDIRECT_CHAIN_MULTI_HOP_UNRELATED_DOMAIN',
          severity: 'BLOCK',
        }),
        expect.objectContaining({
          ruleId: 'PHISH_REDIRECT_CHAIN_BRAND_TO_UNRELATED_FINAL',
          severity: 'BLOCK',
        }),
      ]),
    )
  })

  it('detects a tracker redirect attack', () => {
    const context = buildRedirectChainContext({
      initialUrl: 'https://reddit.com/r/security/comments/abcdef',
      redirectUrls: [
        'https://out.reddit.com/t3_abcdef?url=https%3A%2F%2Fwallet-recovery-help.net',
        'https://wallet-recovery-help.net',
      ],
    })

    const matches = evaluateRedirectRules(context)

    expect(matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'PHISH_REDIRECT_CHAIN_TRACKER_TO_RISKY_FINAL',
          severity: 'WARN',
        }),
        expect.objectContaining({
          ruleId: 'PHISH_REDIRECT_CHAIN_MULTI_HOP_UNRELATED_DOMAIN',
          severity: 'BLOCK',
        }),
        expect.objectContaining({
          ruleId: 'PHISH_REDIRECT_CHAIN_BRAND_TO_UNRELATED_FINAL',
          severity: 'BLOCK',
        }),
      ]),
    )
  })

  it('detects a multi-hop redirect attack', () => {
    const context = buildRedirectChainContext({
      initialUrl: 'https://news.example.org/story',
      redirectUrls: [
        'https://t.co/offer',
        'https://offers-mailer.co/claim',
        'https://credential-check-security.net/login',
      ],
    })

    const matches = evaluateRedirectRules(context)

    expect(matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'PHISH_REDIRECT_CHAIN_SHORTENER_TO_RISKY_FINAL',
          severity: 'BLOCK',
        }),
        expect.objectContaining({
          ruleId: 'PHISH_REDIRECT_CHAIN_MULTI_HOP_UNRELATED_DOMAIN',
          severity: 'BLOCK',
        }),
      ]),
    )
  })

  it('detects a brand redirect hijack', () => {
    const context = buildRedirectChainContext({
      initialUrl: 'https://linkedin.com/jobs/view/123456789',
      redirectUrls: ['https://employment-verify-portal-secure.com/candidate'],
    })

    const matches = evaluateRedirectRules(context)

    expect(matches).toEqual([
      expect.objectContaining({
        ruleId: 'PHISH_REDIRECT_CHAIN_BRAND_TO_UNRELATED_FINAL',
        severity: 'BLOCK',
      }),
    ])
  })
})
