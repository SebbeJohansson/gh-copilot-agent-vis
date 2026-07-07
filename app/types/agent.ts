/**
 * Types for the GitHub Copilot **agent tasks** REST API (public preview,
 * verified July 2026). The API version header is `2026-03-10`.
 *
 * IMPORTANT: This is a preview API; the shape WILL change and undocumented
 * fields may appear. Every interface below therefore tolerates unknown extra
 * fields (via index signatures) and unknown `state` values (via the open
 * `TaskState` union). Do not add runtime assumptions that reject unknown data.
 */

/**
 * Known task states. The trailing `(string & {})` keeps the literal
 * autocompletion while still accepting any raw string the preview API might
 * introduce, so unknown states can be rendered verbatim instead of crashing.
 */
export type KnownTaskState =
  | 'queued'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'idle'
  | 'waiting_for_user'
  | 'timed_out'
  | 'cancelled'

// eslint-disable-next-line @typescript-eslint/ban-types
export type TaskState = KnownTaskState | (string & {})

/** States that mean the agent is actively working or is blocked on the user. */
export const ACTIVE_STATES: KnownTaskState[] = ['queued', 'in_progress', 'waiting_for_user']

/** States surfaced by the "Done" filter chip. */
export const DONE_STATES: KnownTaskState[] = ['completed']

/** States surfaced by the "Problems" filter chip. */
export const PROBLEM_STATES: KnownTaskState[] = ['failed', 'timed_out', 'cancelled']

/**
 * An artifact attached to a task. The only one we care about for v1 is a PR:
 * `{ provider: "github", type: "pull", data: { id } }`. Assumption (preview
 * API): `data` may also carry `number`/`html_url` on some hosts, so we keep it
 * loosely typed.
 */
export interface TaskArtifact {
  provider?: string
  type?: string
  data?: {
    id?: number | string
    number?: number
    html_url?: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

/**
 * The task creator. Shape is not fully documented for the preview API, so we
 * only type the fields we might display and tolerate the rest.
 */
export interface TaskCreator {
  id?: number
  login?: string
  avatar_url?: string
  html_url?: string
  type?: string
  [key: string]: unknown
}

/** A single agent task. */
export interface AgentTask {
  id: number | string
  name: string
  html_url: string
  state: TaskState
  session_count?: number
  /** Repository id (the API returns the numeric id here, not a full object). */
  repository?: number
  creator?: TaskCreator | null
  creator_type?: string
  artifacts?: TaskArtifact[]
  created_at: string
  updated_at: string
  archived_at?: string | null
  // Tolerate any additional preview-only fields without losing type-safety
  // on the ones we do use.
  [key: string]: unknown
}

/** The list endpoint wraps results as `{ "tasks": [...] }`. */
export interface TasksResponse {
  tasks: AgentTask[]
  [key: string]: unknown
}

/** Query parameters accepted by the tasks endpoints. */
export interface TaskQuery {
  /** Max 100 (enforced by the API). */
  per_page?: number
  page?: number
  sort?: 'updated_at' | 'created_at'
  direction?: 'asc' | 'desc'
  /** Comma-separated list of states, e.g. `queued,in_progress`. */
  state?: string
  is_archived?: boolean
  /** ISO 8601 timestamp; only return tasks updated at or after this time. */
  since?: string
  creator_id?: number
}

/** UI filter identifiers for the filter chips. */
export type TaskFilter = 'all' | 'active' | 'done' | 'problems'

/** Returns true for a PR artifact so the UI can show a "PR" indicator. */
export function findPullArtifact(task: AgentTask): TaskArtifact | undefined {
  return task.artifacts?.find((a) => a?.type === 'pull' && a?.provider === 'github')
}
