import type { TaskQuery } from '~/types/agent'

/**
 * Low-level GitHub API client for the agent tasks preview API.
 *
 * Uses plain `fetch` (not `$fetch`) on purpose: we need to read response
 * headers (ETag, rate-limit) and treat `304 Not Modified` as a first-class,
 * non-error outcome. `$fetch` throws on any non-2xx which makes 304 handling
 * awkward, so a thin wrapper is simpler and clearer here.
 *
 * Every request sends exactly the three required headers and nothing else that
 * could leak credentials. `credentials: 'omit'` guarantees no cookies are ever
 * attached — the bearer token is the only thing sent, and only to `apiBase`.
 */

export const GITHUB_API_VERSION = '2026-03-10'

export interface RateLimitInfo {
  remaining: number | null
  reset: number | null // epoch seconds
  limit: number | null
}

export interface ApiResponse<T> {
  status: number
  ok: boolean
  /** True when the server replied 304 (ETag matched) — data is unchanged. */
  notModified: boolean
  data: T | null
  etag: string | null
  rateLimit: RateLimitInfo
  /** Human-friendly error message, set when the request failed. */
  errorMessage?: string
}

function buildHeaders(token: string, etag?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': GITHUB_API_VERSION,
  }
  // Conditional request: a matching ETag yields a cheap 304 that does NOT
  // count against the primary rate limit, so fast polling stays inexpensive.
  if (etag) headers['If-None-Match'] = etag
  return headers
}

function parseRateLimit(res: Response): RateLimitInfo {
  const num = (v: string | null) => (v == null || v === '' ? null : Number(v))
  return {
    remaining: num(res.headers.get('x-ratelimit-remaining')),
    reset: num(res.headers.get('x-ratelimit-reset')),
    limit: num(res.headers.get('x-ratelimit-limit')),
  }
}

async function describeError(res: Response): Promise<string> {
  let apiMessage = ''
  try {
    const body = (await res.json()) as { message?: unknown }
    if (body && typeof body.message === 'string') apiMessage = body.message
  } catch {
    // non-JSON error body — ignore
  }
  let base: string
  switch (res.status) {
    case 401:
      base = 'Unauthorized (401): the token is invalid or expired.'
      break
    case 403:
      base =
        'Forbidden (403): the token is missing the “Agent tasks” repository permission (read), or your account/plan lacks access. Note: GitHub App installation tokens are rejected — use a fine-grained PAT or user token.'
      break
    case 404:
      base =
        'Not found (404): the API host looks wrong, or the agent tasks API is unavailable on this host.'
      break
    case 429:
      base = 'Rate limited (429): too many requests.'
      break
    default:
      base = `Request failed (${res.status}).`
  }
  return apiMessage ? `${base} — ${apiMessage}` : base
}

/**
 * Perform a single GET request. Never throws for HTTP errors — inspect the
 * returned `ApiResponse` (`ok`, `status`, `notModified`, `errorMessage`).
 */
export async function githubRequest<T>(
  apiBase: string,
  path: string,
  opts: { token: string; etag?: string | null; signal?: AbortSignal },
): Promise<ApiResponse<T>> {
  const url = `${apiBase}${path}`
  const empty: RateLimitInfo = { remaining: null, reset: null, limit: null }

  let res: Response
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: buildHeaders(opts.token, opts.etag),
      signal: opts.signal,
      credentials: 'omit',
      cache: 'no-store',
    })
  } catch (e) {
    // Distinguish an intentional abort from a real network/CORS failure.
    if (e instanceof DOMException && e.name === 'AbortError') {
      return {
        status: 0,
        ok: false,
        notModified: false,
        data: null,
        etag: null,
        rateLimit: empty,
        errorMessage: 'aborted',
      }
    }
    return {
      status: 0,
      ok: false,
      notModified: false,
      data: null,
      etag: null,
      rateLimit: empty,
      errorMessage:
        'Network error — could not reach the API host. Check the API host URL, your connection, or that the host allows CORS.',
    }
  }

  const rateLimit = parseRateLimit(res)
  const etag = res.headers.get('etag')

  if (res.status === 304) {
    return { status: 304, ok: true, notModified: true, data: null, etag, rateLimit }
  }

  if (!res.ok) {
    const errorMessage = await describeError(res)
    return { status: res.status, ok: false, notModified: false, data: null, etag, rateLimit, errorMessage }
  }

  let data: T | null = null
  try {
    data = (await res.json()) as T
  } catch {
    data = null
  }
  return { status: res.status, ok: true, notModified: false, data, etag, rateLimit }
}

/** Build the query string for the tasks endpoints from a typed query object. */
function buildQueryString(query: TaskQuery = {}): string {
  const params = new URLSearchParams()
  if (query.per_page != null) params.set('per_page', String(query.per_page))
  if (query.page != null) params.set('page', String(query.page))
  if (query.sort) params.set('sort', query.sort)
  if (query.direction) params.set('direction', query.direction)
  if (query.state) params.set('state', query.state)
  if (query.is_archived != null) params.set('is_archived', String(query.is_archived))
  if (query.since) params.set('since', query.since)
  if (query.creator_id != null) params.set('creator_id', String(query.creator_id))
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

/** Path for all tasks across accessible repos: `GET {apiBase}/agents/tasks`. */
export function tasksPath(query: TaskQuery = {}): string {
  return `/agents/tasks${buildQueryString(query)}`
}

/**
 * Path for per-repo tasks: `GET {apiBase}/agents/repos/{owner}/{repo}/tasks`.
 * Not used in v1, but provided so adding a per-repo view is trivial.
 */
export function repoTasksPath(owner: string, repo: string, query: TaskQuery = {}): string {
  return `/agents/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/tasks${buildQueryString(query)}`
}
