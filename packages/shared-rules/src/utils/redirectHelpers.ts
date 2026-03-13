const SHORTENER_HOSTS = new Set<string>([
  'bit.ly',
  't.co',
  'tinyurl.com',
  'goo.gl',
  'is.gd',
])

const TRACKER_HOSTS = new Set<string>([
  'ct.pinterest.com',
  'l.facebook.com',
  'out.reddit.com',
  'lnkd.in',
  'linktr.ee',
])

const BRAND_HOSTS = new Set<string>([
  'twitter.com',
  'x.com',
  'facebook.com',
  'instagram.com',
  'linkedin.com',
  'reddit.com',
  'pinterest.com',
  'google.com',
  'youtube.com',
  'microsoft.com',
  'apple.com',
  'amazon.com',
  'paypal.com',
  'github.com',
  'dropbox.com',
  'adobe.com',
])

const MULTI_LABEL_PUBLIC_SUFFIXES = new Set<string>([
  'co.uk',
  'org.uk',
  'gov.uk',
  'ac.uk',
  'com.au',
  'net.au',
  'org.au',
  'co.nz',
  'co.jp',
  'com.br',
  'com.mx',
  'co.in',
  'com.sg',
])

export function normalizeUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim()

  if (trimmed.length === 0) {
    throw new Error('Redirect chain URL cannot be empty.')
  }

  const parsed = new URL(trimmed)
  parsed.hash = ''

  return parsed.toString()
}

export function getHostnameFromUrl(rawUrl: string): string {
  const parsed = new URL(rawUrl)
  return parsed.hostname.toLowerCase()
}

export function dedupeConsecutiveHosts(hosts: string[]): string[] {
  const deduped: string[] = []

  for (const host of hosts) {
    const normalizedHost = host.toLowerCase()
    const previousHost = deduped.length > 0 ? deduped[deduped.length - 1] : null

    if (previousHost !== normalizedHost) {
      deduped.push(normalizedHost)
    }
  }

  return deduped
}

export function getRegistrableDomain(hostname: string): string {
  const normalized = hostname.toLowerCase().trim()

  if (normalized.length === 0) {
    return normalized
  }

  const labels = normalized.split('.').filter((label) => label.length > 0)

  if (labels.length <= 2) {
    return normalized
  }

  const publicSuffixCandidate = `${labels[labels.length - 2]}.${labels[labels.length - 1]}`

  if (MULTI_LABEL_PUBLIC_SUFFIXES.has(publicSuffixCandidate) && labels.length >= 3) {
    return `${labels[labels.length - 3]}.${publicSuffixCandidate}`
  }

  return `${labels[labels.length - 2]}.${labels[labels.length - 1]}`
}

export function areRelatedHosts(leftHost: string, rightHost: string): boolean {
  const left = leftHost.toLowerCase()
  const right = rightHost.toLowerCase()

  if (left === right) {
    return true
  }

  return getRegistrableDomain(left) === getRegistrableDomain(right)
}

export function isCrossDomainRedirect(initialUrl: string, finalUrl: string): boolean {
  const initialHost = getHostnameFromUrl(initialUrl)
  const finalHost = getHostnameFromUrl(finalUrl)

  return !areRelatedHosts(initialHost, finalHost)
}

export function isShortenerHost(hostname: string): boolean {
  return SHORTENER_HOSTS.has(hostname.toLowerCase())
}

export function isTrackerHost(hostname: string): boolean {
  return TRACKER_HOSTS.has(hostname.toLowerCase())
}

export function isBrandHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase()

  if (BRAND_HOSTS.has(normalized)) {
    return true
  }

  const registrableDomain = getRegistrableDomain(normalized)
  return BRAND_HOSTS.has(registrableDomain)
}

export function isInfrastructureHost(hostname: string): boolean {
  return isShortenerHost(hostname) || isTrackerHost(hostname)
}

export function getMeaningfulHosts(hosts: string[]): string[] {
  return hosts
    .map((host) => host.toLowerCase())
    .filter((host) => host.length > 0)
    .filter((host) => !isInfrastructureHost(host))
}

export function finalHostIsUnrelatedToPriorMeaningfulHosts(hosts: string[]): boolean {
  if (hosts.length < 2) {
    return false
  }

  const meaningfulHosts = getMeaningfulHosts(hosts)

  if (meaningfulHosts.length < 2) {
    return false
  }

  const finalHost = meaningfulHosts[meaningfulHosts.length - 1]
  const priorHosts = meaningfulHosts.slice(0, -1)

  return priorHosts.every((host) => !areRelatedHosts(host, finalHost))
}

export function countUnrelatedAdjacentTransitions(hosts: string[]): number {
  let count = 0

  for (let index = 0; index < hosts.length - 1; index += 1) {
    const currentHost = hosts[index]
    const nextHost = hosts[index + 1]

    if (!areRelatedHosts(currentHost, nextHost)) {
      count += 1
    }
  }

  return count
}

export function hasMultipleUnrelatedRedirectHops(hosts: string[]): boolean {
  if (hosts.length < 3) {
    return false
  }

  const unrelatedTransitions = countUnrelatedAdjacentTransitions(hosts)
  return unrelatedTransitions >= 2 && finalHostIsUnrelatedToPriorMeaningfulHosts(hosts)
}
