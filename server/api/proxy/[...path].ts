/**
 * Dev-only transparent proxy for GitHub API requests.
 *
 * Why this exists:
 *   The GitHub Copilot agent-tasks preview API (/agents/tasks) may not
 *   include CORS headers, so browsers running the app from localhost block
 *   the cross-origin fetch before it leaves the machine. Routing the
 *   request through this same-origin Nitro handler avoids CORS entirely:
 *   the browser talks to localhost (same origin, no preflight), and this
 *   handler performs the actual fetch to GitHub server-side.
 *
 * This file only runs during `nuxt dev`. `nitro.static: true` means
 * server routes are excluded from the `nuxt generate` output, so the
 * production static bundle calls the GitHub API directly from the browser
 * (or via an optional user-configured CORS proxy URL in Settings).
 *
 * Security notes:
 *   - x-proxy-target is validated against an explicit allowlist before any
 *     outbound request is made. Only api.github.com and
 *     api.<subdomain>.ghe.com are accepted. Non-HTTPS schemes, IP addresses,
 *     and every other host (including private/loopback/link-local ranges)
 *     are rejected with 403, preventing SSRF attacks.
 *   - Only the four headers the GitHub API requires are forwarded to the
 *     upstream. Everything else (cookies, Origin, Host, x-proxy-target) is
 *     stripped so nothing unexpected reaches GitHub.
 *   - `credentials: 'omit'` on the outbound fetch ensures no cookies are
 *     sent to GitHub.
 *   - The token travels browser -> localhost -> GitHub, entirely within the
 *     developer's machine and never through any third-party service.
 */

/**
 * Returns true only for GitHub API hosts the app is allowed to reach.
 *
 * Allowed:
 *   - api.github.com
 *   - api.<subdomain>.ghe.com  (GHE.com data-residency tenants)
 *
 * Rejected:
 *   - Any non-HTTPS scheme (http:, file:, data:, javascript:, etc.)
 *   - IP address hostnames (blocks 10.x, 169.254.x, 127.x, ::1, etc.)
 *   - IPv6 bracket notation
 *   - Every host not matching the two patterns above
 */
function isAllowedTarget(raw: string): boolean {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return false
  }

  if (url.protocol !== 'https:') return false

  const host = url.hostname.toLowerCase()

  // Reject empty hostnames, bare IP addresses (numeric first char), and IPv6.
  // The allowlist below already rejects IPs, but this blocks unusual
  // encodings and DNS-rebinding tricks like api.169.254.x.x.nip.io.
  if (!host || /^\d/.test(host) || host.startsWith('[')) return false

  if (host === 'api.github.com') return true
  if (/^api\.[a-z0-9][a-z0-9-]*\.ghe\.com$/.test(host)) return true

  return false
}

export default defineEventHandler(async (event) => {
  const rawTarget = getRequestHeader(event, 'x-proxy-target') ?? ''

  if (!isAllowedTarget(rawTarget)) {
    throw createError({
      statusCode: 403,
      message: `Proxy target not allowed: ${rawTarget || '(empty)'}. Only api.github.com and api.*.ghe.com are permitted.`,
    })
  }

  // Strip trailing slashes from the validated target base.
  const targetBase = rawTarget.replace(/\/+$/, '')

  // Reconstruct the GitHub API path from the catch-all route param.
  // Example: path "agents/tasks" + query "?per_page=1" -> /agents/tasks?per_page=1
  const pathParts = getRouterParam(event, 'path') ?? ''
  const query = getQuery(event)
  const qs = new URLSearchParams(query as Record<string, string>).toString()
  const targetUrl = `${targetBase}/${pathParts}${qs ? `?${qs}` : ''}`

  // Forward only the headers the GitHub API requires.
  // Explicitly omit x-proxy-target, Host, Origin, Cookie, and every other
  // browser-added header so nothing unexpected reaches GitHub.
  const forwardHeaders: Record<string, string> = {}
  for (const h of ['authorization', 'accept', 'x-github-api-version', 'if-none-match']) {
    const val = getRequestHeader(event, h)
    if (val) forwardHeaders[h] = val
  }

  // proxyRequest pipes the response status, headers (ETag, x-ratelimit-*, etc.)
  // and body back to the browser transparently, including 304 Not Modified.
  return proxyRequest(event, targetUrl, {
    headers: forwardHeaders,
    fetchOptions: { credentials: 'omit' },
  })
})
