import {
  calculateDomainRiskScore,
  DomainRiskResult
} from '../../signals/domainRiskScore'

export type DomainRiskSeverity = 'ALLOW' | 'WARN' | 'BLOCK'

export interface DomainRiskContext {
  domain: string
  domainAgeHours: number | null
  redirectCount: number
}

export interface DomainRiskEvaluation {
  ruleId: 'PHISH_DOMAIN_RISK_SCORE'
  severity: DomainRiskSeverity
  evidence: {
    score: number
    signals: string[]
  }
}

const BLOCK_THRESHOLD = 80
const WARN_THRESHOLD = 50

/**
 * Layer-1 phishing rule evaluating deterministic domain risk score.
 *
 * @param ctx - Navigation context
 * @returns DomainRiskEvaluation
 */
export function evaluateDomainRiskRule(
  ctx: DomainRiskContext
): DomainRiskEvaluation {
  const result: DomainRiskResult = calculateDomainRiskScore(
    ctx.domain,
    ctx.domainAgeHours,
    ctx.redirectCount
  )

  let severity: DomainRiskSeverity = 'ALLOW'

  if (result.score >= BLOCK_THRESHOLD) {
    severity = 'BLOCK'
  } else if (result.score >= WARN_THRESHOLD) {
    severity = 'WARN'
  }

  return {
    ruleId: 'PHISH_DOMAIN_RISK_SCORE',
    severity,
    evidence: {
      score: result.score,
      signals: result.signals
    }
  }
}
