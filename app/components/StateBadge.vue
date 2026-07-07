<template>
  <span class="badge" :class="`badge--${variant}`" :title="`State: ${state}`">
    <span class="badge__dot" aria-hidden="true" />
    <span class="badge__label">{{ label }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TaskState } from '~/types/agent'

const props = defineProps<{ state: TaskState }>()

/**
 * Map each known state to a colour variant. Unknown/preview states fall through
 * to `unknown` (gray) and render their raw string, so the UI never breaks when
 * GitHub introduces a new state.
 */
const VARIANTS: Record<string, string> = {
  in_progress: 'progress',
  queued: 'queued',
  waiting_for_user: 'attention',
  completed: 'success',
  failed: 'danger',
  timed_out: 'danger',
  cancelled: 'muted',
  idle: 'muted',
}

const variant = computed(() => VARIANTS[props.state] ?? 'unknown')

/** "in_progress" -> "In progress", "waiting_for_user" -> "Waiting for user". */
const label = computed(() => {
  const spaced = String(props.state).replace(/_/g, ' ').trim()
  if (!spaced) return 'Unknown'
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
})
</script>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
  padding: 0.2em 0.6em;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 600;
  line-height: 1.4;
  white-space: nowrap;
  border: 1px solid var(--badge-border, transparent);
  background: var(--badge-bg, var(--surface-2));
  color: var(--badge-fg, var(--text-1));
}

.badge__dot {
  width: 0.5em;
  height: 0.5em;
  border-radius: 50%;
  background: var(--badge-fg, currentColor);
  flex: none;
}

/* Colour variants use CSS custom props resolved against the theme (main.css) */
.badge--progress {
  --badge-bg: var(--state-progress-bg);
  --badge-fg: var(--state-progress-fg);
  --badge-border: var(--state-progress-border);
}
.badge--queued {
  --badge-bg: var(--state-queued-bg);
  --badge-fg: var(--state-queued-fg);
  --badge-border: var(--state-queued-border);
}
.badge--attention {
  --badge-bg: var(--state-attention-bg);
  --badge-fg: var(--state-attention-fg);
  --badge-border: var(--state-attention-border);
}
.badge--success {
  --badge-bg: var(--state-success-bg);
  --badge-fg: var(--state-success-fg);
  --badge-border: var(--state-success-border);
}
.badge--danger {
  --badge-bg: var(--state-danger-bg);
  --badge-fg: var(--state-danger-fg);
  --badge-border: var(--state-danger-border);
}
.badge--muted,
.badge--unknown {
  --badge-bg: var(--state-muted-bg);
  --badge-fg: var(--state-muted-fg);
  --badge-border: var(--state-muted-border);
}

/* in_progress: subtle pulse to signal live activity */
.badge--progress .badge__dot {
  animation: badge-pulse 1.6s ease-in-out infinite;
}
/* waiting_for_user is visually loud — pulse it too so it grabs attention */
.badge--attention .badge__dot {
  animation: badge-pulse 1.2s ease-in-out infinite;
}

@keyframes badge-pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.35;
    transform: scale(0.7);
  }
}

@media (prefers-reduced-motion: reduce) {
  .badge__dot {
    animation: none !important;
  }
}
</style>
