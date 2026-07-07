import { computed, ref } from 'vue'
import {
  ACTIVE_STATES,
  DONE_STATES,
  PROBLEM_STATES,
  type AgentTask,
  type TaskFilter,
  type TasksResponse,
} from '~/types/agent'
import { githubRequest, tasksPath, type ApiResponse } from '~/utils/githubApi'
import { getResolvedSettings } from '~/composables/useSettings'

/**
 * Tasks composable + smart polling engine.
 *
 * Data flow:
 *  - Initial load (and every ~10 min, and on manual refresh) does a FULL fetch,
 *    paginating up to 5 pages of 100 to build the complete list.
 *  - Between full refreshes we POLL a *stable* URL: page 1 sorted by
 *    updated_at desc, with `since=<anchor>`, so we only pull recently-updated
 *    tasks and merge them by id. Because the URL is stable between full
 *    refreshes, the stored ETag stays valid and unchanged data comes back as a
 *    cheap 304 (which doesn't count against the rate limit). This satisfies
 *    both the "conditional requests" and "incremental fetch" requirements at
 *    once, and they cooperate rather than fight.
 *
 * Adaptive interval:
 *  - 12s while any task is queued/in_progress/waiting_for_user.
 *  - Backs off 60s -> 120s once everything is settled.
 *  - Any state transition (or manual refresh / tab becoming visible) snaps back
 *    to the fast interval.
 *
 * Assumptions (preview API):
 *  - Polls read only page 1 of the `since` window; if >100 tasks change inside
 *    one interval, the 10-min full refresh reconciles. In practice a single
 *    user won't have 100 tasks change in 12s.
 *  - Archived/deleted tasks are reconciled by the periodic full refresh, since
 *    a `since` poll can't report removals.
 */

const PER_PAGE = 100
const MAX_PAGES = 5
const FAST_INTERVAL = 12_000
const BACKOFF_INTERVALS = [60_000, 120_000]
const FULL_REFRESH_INTERVAL = 10 * 60_000

// ---- module-level singleton state (shared across the client app) ----------
const tasks = ref<AgentTask[]>([])
const loading = ref(false) // initial load, nothing to show yet
const refreshing = ref(false) // a background request is in flight
const error = ref<{ status: number; message: string } | null>(null)
const authError = ref(false) // a 401 was seen -> route to settings
const lastUpdated = ref<Date | null>(null) // last time data actually changed
const lastChecked = ref<Date | null>(null) // last successful request (incl. 304)
const rateLimitedUntil = ref<number | null>(null) // epoch seconds, or null
const filter = ref<TaskFilter>('all')

// non-reactive internals
let etags = new Map<string, string>()
let sinceAnchor: string | null = null
let lastFullFetchAt = 0
let backoffLevel = 0
let pollTimer: ReturnType<typeof setTimeout> | null = null
let aborter: AbortController | null = null
let started = false
let visibilityHandler: (() => void) | null = null

// ---- helpers ---------------------------------------------------------------
const isActive = (t: AgentTask) => (ACTIVE_STATES as string[]).includes(t.state)
const idKey = (t: AgentTask) => String(t.id)

function sortByUpdatedDesc(list: AgentTask[]): AgentTask[] {
  return [...list].sort((a, b) => {
    const ta = new Date(a.updated_at).getTime() || 0
    const tb = new Date(b.updated_at).getTime() || 0
    return tb - ta
  })
}

/** Merge incoming tasks into the list by id. Returns whether anything changed. */
function mergeById(incoming: AgentTask[]): boolean {
  if (!incoming.length) return false
  const map = new Map(tasks.value.map((t) => [idKey(t), t]))
  let changed = false
  for (const t of incoming) {
    const prev = map.get(idKey(t))
    if (!prev || prev.state !== t.state || prev.updated_at !== t.updated_at) changed = true
    map.set(idKey(t), prev ? { ...prev, ...t } : t)
  }
  if (changed) tasks.value = sortByUpdatedDesc([...map.values()])
  return changed
}

/** Replace the whole list (full fetch). Returns whether anything changed. */
function replaceAll(incoming: AgentTask[]): boolean {
  const prev = new Map(tasks.value.map((t) => [idKey(t), t]))
  let changed = incoming.length !== tasks.value.length
  for (const t of incoming) {
    const old = prev.get(idKey(t))
    if (!old || old.state !== t.state || old.updated_at !== t.updated_at) changed = true
  }
  tasks.value = sortByUpdatedDesc(incoming)
  return changed
}

function clearTimer() {
  if (pollTimer) {
    clearTimeout(pollTimer)
    pollTimer = null
  }
}

function scheduleNext(delayMs: number) {
  clearTimer()
  pollTimer = setTimeout(() => {
    void runPoll()
  }, delayMs)
}

function computeInterval(changed: boolean): number {
  const anyActive = tasks.value.some(isActive)
  if (anyActive || changed) {
    backoffLevel = 0
    return FAST_INTERVAL
  }
  const idx = Math.min(backoffLevel, BACKOFF_INTERVALS.length - 1)
  backoffLevel = Math.min(backoffLevel + 1, BACKOFF_INTERVALS.length - 1)
  return BACKOFF_INTERVALS[idx] ?? FAST_INTERVAL
}

/** Decide how a failed request affects polling. */
type FailureKind = 'auth' | 'ratelimit' | 'error' | 'aborted'
function handleFailure(res: ApiResponse<unknown>): FailureKind {
  if (res.errorMessage === 'aborted') return 'aborted'
  if (res.status === 401) {
    authError.value = true
    return 'auth'
  }
  if (
    (res.status === 403 || res.status === 429) &&
    res.rateLimit.remaining === 0 &&
    res.rateLimit.reset
  ) {
    rateLimitedUntil.value = res.rateLimit.reset
    return 'ratelimit'
  }
  error.value = { status: res.status, message: res.errorMessage ?? 'Request failed.' }
  return 'error'
}

function finishCycle(changed: boolean) {
  if (rateLimitedUntil.value) {
    const nowSec = Date.now() / 1000
    const waitMs = Math.max(1000, (rateLimitedUntil.value - nowSec) * 1000 + 1000)
    scheduleNext(waitMs)
    return
  }
  scheduleNext(computeInterval(changed))
}

// ---- network ---------------------------------------------------------------
async function fetchAllPages(
  signal: AbortSignal,
): Promise<{ ok: boolean; tasks: AgentTask[]; failure?: ApiResponse<unknown> }> {
  const { apiBase, token, corsProxyUrl } = getResolvedSettings()
  const all: AgentTask[] = []
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const path = tasksPath({ per_page: PER_PAGE, page, sort: 'updated_at', direction: 'desc' })
    const res = await githubRequest<TasksResponse>(apiBase, path, { token, signal, corsProxyUrl })
    if (!res.ok) return { ok: false, tasks: all, failure: res }
    const batch = res.data?.tasks ?? []
    all.push(...batch)
    if (batch.length < PER_PAGE) break // reached the last page
  }
  return { ok: true, tasks: all }
}

async function pollSince(
  signal: AbortSignal,
): Promise<{ status: 'ok' | 'not_modified' | 'fail'; changed: boolean; failure?: ApiResponse<unknown> }> {
  const { apiBase, token, corsProxyUrl } = getResolvedSettings()
  const path = tasksPath({
    per_page: PER_PAGE,
    sort: 'updated_at',
    direction: 'desc',
    ...(sinceAnchor ? { since: sinceAnchor } : {}),
  })
  const res = await githubRequest<TasksResponse>(apiBase, path, {
    token,
    etag: etags.get(path) ?? null,
    signal,
    corsProxyUrl,
  })
  if (res.notModified) return { status: 'not_modified', changed: false }
  if (!res.ok) return { status: 'fail', changed: false, failure: res }
  if (res.etag) etags.set(path, res.etag)
  const changed = mergeById(res.data?.tasks ?? [])
  return { status: 'ok', changed }
}

// ---- poll cycle ------------------------------------------------------------
async function runPoll(force = false): Promise<void> {
  if (!started) return

  // Pause while the tab is hidden (unless explicitly forced, e.g. resume).
  if (!force && typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    return
  }

  // Respect an active rate-limit window.
  if (rateLimitedUntil.value) {
    const nowSec = Date.now() / 1000
    if (nowSec < rateLimitedUntil.value) {
      const waitMs = (rateLimitedUntil.value - nowSec) * 1000 + 1000
      scheduleNext(waitMs)
      return
    }
    rateLimitedUntil.value = null
  }

  // Cancel any in-flight request before starting a new one.
  aborter?.abort()
  aborter = new AbortController()
  const { signal } = aborter

  refreshing.value = true
  try {
    const needFull =
      force ||
      !sinceAnchor ||
      tasks.value.length === 0 ||
      Date.now() - lastFullFetchAt > FULL_REFRESH_INTERVAL

    if (needFull) {
      const result = await fetchAllPages(signal)
      if (signal.aborted) return
      if (!result.ok && result.failure) {
        const kind = handleFailure(result.failure)
        if (kind === 'auth') return void stop()
        if (kind === 'aborted') return
        finishCycle(false)
        return
      }
      error.value = null
      const changed = replaceAll(result.tasks)
      lastFullFetchAt = Date.now()
      sinceAnchor = new Date().toISOString()
      // A fresh full fetch means the stable poll URL changed -> drop old ETags.
      etags = new Map()
      lastChecked.value = new Date()
      if (changed || !lastUpdated.value) lastUpdated.value = new Date()
      finishCycle(changed)
    } else {
      const poll = await pollSince(signal)
      if (signal.aborted) return
      if (poll.status === 'fail' && poll.failure) {
        const kind = handleFailure(poll.failure)
        if (kind === 'auth') return void stop()
        if (kind === 'aborted') return
        finishCycle(false)
        return
      }
      error.value = null
      lastChecked.value = new Date()
      if (poll.status === 'ok' && poll.changed) lastUpdated.value = new Date()
      finishCycle(poll.changed)
    }
  } catch (e) {
    if (!signal.aborted) {
      error.value = { status: 0, message: 'Unexpected error while fetching tasks.' }
      finishCycle(false)
    }
  } finally {
    if (!signal.aborted) {
      loading.value = false
      refreshing.value = false
    }
  }
}

// ---- lifecycle -------------------------------------------------------------
function onVisibility() {
  if (typeof document === 'undefined') return
  if (document.visibilityState === 'visible') {
    // Resume immediately with a fresh check.
    backoffLevel = 0
    void runPoll(true)
  } else {
    // Hidden: stop scheduled polling and abort any in-flight request.
    clearTimer()
    aborter?.abort()
  }
}

function start() {
  if (started) return
  started = true
  authError.value = false
  error.value = null
  loading.value = tasks.value.length === 0
  if (typeof document !== 'undefined') {
    visibilityHandler = onVisibility
    document.addEventListener('visibilitychange', visibilityHandler)
  }
  void runPoll(true)
}

function stop() {
  started = false
  clearTimer()
  aborter?.abort()
  aborter = null
  refreshing.value = false
  if (visibilityHandler && typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', visibilityHandler)
    visibilityHandler = null
  }
}

/** Manual refresh: snap to a fresh full fetch immediately. */
function refreshNow() {
  backoffLevel = 0
  rateLimitedUntil.value = null
  error.value = null
  void runPoll(true)
}

/** Wipe everything (used on sign-out or when credentials change). */
function reset() {
  stop()
  tasks.value = []
  etags = new Map()
  sinceAnchor = null
  lastFullFetchAt = 0
  backoffLevel = 0
  lastUpdated.value = null
  lastChecked.value = null
  rateLimitedUntil.value = null
  error.value = null
  authError.value = false
  loading.value = false
  filter.value = 'all'
}

// ---- derived ---------------------------------------------------------------
const counts = computed(() => {
  const c = { all: tasks.value.length, active: 0, done: 0, problems: 0 }
  for (const t of tasks.value) {
    if ((ACTIVE_STATES as string[]).includes(t.state)) c.active += 1
    else if ((DONE_STATES as string[]).includes(t.state)) c.done += 1
    else if ((PROBLEM_STATES as string[]).includes(t.state)) c.problems += 1
  }
  return c
})

const filteredTasks = computed(() => {
  switch (filter.value) {
    case 'active':
      return tasks.value.filter((t) => (ACTIVE_STATES as string[]).includes(t.state))
    case 'done':
      return tasks.value.filter((t) => (DONE_STATES as string[]).includes(t.state))
    case 'problems':
      return tasks.value.filter((t) => (PROBLEM_STATES as string[]).includes(t.state))
    default:
      return tasks.value
  }
})

export function useTasks() {
  return {
    // state
    tasks,
    filteredTasks,
    counts,
    filter,
    loading,
    refreshing,
    error,
    authError,
    lastUpdated,
    lastChecked,
    rateLimitedUntil,
    // actions
    start,
    stop,
    refreshNow,
    reset,
  }
}
