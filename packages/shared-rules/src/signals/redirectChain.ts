import {
  dedupeConsecutiveHosts,
  getHostnameFromUrl,
  isCrossDomainRedirect,
  isShortenerHost,
  isTrackerHost,
  normalizeUrl,
} from '../utils/redirectHelpers'

export interface RedirectChainContext {
  initialUrl: string
  finalUrl: string
  redirectCount: number
  redirectHosts: string[]
  crossDomainRedirect: boolean
  containsShortenerHop: boolean
  containsTrackerHop: boolean
}

export interface RedirectChainInput {
  initialUrl: string
  redirectUrls: string[]
}

function normalizeRedirectUrls(redirectUrls: string[]): string[] {
  return redirectUrls
    .filter((value): value is string => typeof value === 'string')
    .map((value) => normalizeUrl(value))
    .filter((value) => value.length > 0)
}

export function buildRedirectChainContext(input: RedirectChainInput): RedirectChainContext {
  const normalizedInitialUrl = normalizeUrl(input.initialUrl)
  const normalizedRedirectUrls = normalizeRedirectUrls(input.redirectUrls)

  const finalUrl =
    normalizedRedirectUrls.length > 0
      ? normalizedRedirectUrls[normalizedRedirectUrls.length - 1]
      : normalizedInitialUrl

  const orderedUrls = [normalizedInitialUrl, ...normalizedRedirectUrls]
  const redirectHosts = dedupeConsecutiveHosts(
    orderedUrls
      .map((url) => getHostnameFromUrl(url))
      .filter((host): host is string => host.length > 0),
  )

  const redirectCount = normalizedRedirectUrls.length
  const crossDomainRedirect = isCrossDomainRedirect(normalizedInitialUrl, finalUrl)
  const containsShortenerHop = redirectHosts.some((host) => isShortenerHost(host))
  const containsTrackerHop = redirectHosts.some((host) => isTrackerHost(host))

  return {
    initialUrl: normalizedInitialUrl,
    finalUrl,
    redirectCount,
    redirectHosts,
    crossDomainRedirect,
    containsShortenerHop,
    containsTrackerHop,
  }
}
