<template>
  <a
    class="task"
    :href="task.html_url"
    target="_blank"
    rel="noopener noreferrer"
    :aria-label="`Open task ${task.name} on GitHub (opens in a new tab)`"
  >
    <div class="task__main">
      <div class="task__top">
        <StateBadge :state="task.state" />
        <span v-if="pr" class="task__pr" :title="prTitle">
          <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" fill="currentColor">
            <path
              d="M7.177 3.073 9.573.677A.25.25 0 0 1 10 .854v4.792a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm-2.25.75a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm10.5 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM3.75 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25-.75a2.25 2.25 0 0 0-.75-4.372V6a.75.75 0 0 0-.75-.75h-1.5a.75.75 0 0 0 0 1.5h.75v.628a2.251 2.251 0 1 0 3 2.872Z"
            />
          </svg>
          {{ prLabel }}
        </span>
      </div>

      <h3 class="task__name">{{ task.name || 'Untitled task' }}</h3>

      <div class="task__meta">
        <span class="task__time" :title="absoluteUpdated">Updated {{ relativeUpdated }}</span>
        <span v-if="sessionCount != null" class="task__sessions" aria-hidden="true">·</span>
        <span v-if="sessionCount != null" class="task__sessions">
          {{ sessionCount }} {{ sessionCount === 1 ? 'session' : 'sessions' }}
        </span>
      </div>
    </div>

    <span class="task__open" aria-hidden="true">
      <svg viewBox="0 0 16 16" width="15" height="15" fill="currentColor">
        <path
          d="M3.75 2h3.5a.75.75 0 0 1 0 1.5h-3.5a.25.25 0 0 0-.25.25v8.5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25v-3.5a.75.75 0 0 1 1.5 0v3.5A1.75 1.75 0 0 1 12.25 14h-8.5A1.75 1.75 0 0 1 2 12.25v-8.5C2 2.784 2.784 2 3.75 2Zm6.854-1h4.146a.25.25 0 0 1 .25.25V5.4a.25.25 0 0 1-.427.177L13.03 4.03 9.28 7.78a.75.75 0 0 1-1.06-1.06l3.75-3.75-1.543-1.543A.25.25 0 0 1 10.604 1Z"
        />
      </svg>
    </span>
  </a>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { findPullArtifact, type AgentTask } from '~/types/agent'
import { formatAbsoluteTime, formatRelativeTime } from '~/utils/time'

const props = defineProps<{ task: AgentTask; now: number }>()

const relativeUpdated = computed(() => formatRelativeTime(props.task.updated_at, props.now))
const absoluteUpdated = computed(() => formatAbsoluteTime(props.task.updated_at))

const sessionCount = computed(() =>
  typeof props.task.session_count === 'number' ? props.task.session_count : null,
)

const pr = computed(() => findPullArtifact(props.task))
const prLabel = computed(() => {
  const num = pr.value?.data?.number
  return num != null ? `PR #${num}` : 'PR'
})
const prTitle = computed(() => 'This task has an associated pull request')
</script>

<style scoped>
.task {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--border-1);
  border-radius: var(--radius);
  background: var(--surface-1);
  color: inherit;
  text-decoration: none;
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    transform 0.05s ease;
}
.task:hover {
  border-color: var(--border-2);
  background: var(--surface-2);
}
.task:active {
  transform: translateY(1px);
}
.task:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.task__main {
  min-width: 0; /* allow name to truncate */
  flex: 1;
}

.task__top {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.35rem;
}

.task__pr {
  display: inline-flex;
  align-items: center;
  gap: 0.3em;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
  padding: 0.1em 0.5em;
  border-radius: 999px;
}

.task__name {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.35;
  color: var(--text-1);
  /* clamp to two lines */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.task__meta {
  margin-top: 0.3rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
  font-size: 0.82rem;
  color: var(--text-2);
}

.task__open {
  flex: none;
  color: var(--text-3);
  display: inline-flex;
}
.task:hover .task__open {
  color: var(--accent);
}
</style>
