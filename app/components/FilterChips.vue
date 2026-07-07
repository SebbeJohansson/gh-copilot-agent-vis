<template>
  <div class="chips" role="tablist" aria-label="Filter tasks">
    <button
      v-for="chip in chips"
      :key="chip.id"
      type="button"
      role="tab"
      class="chip"
      :class="{ 'chip--active': modelValue === chip.id }"
      :aria-selected="modelValue === chip.id"
      @click="emit('update:modelValue', chip.id)"
    >
      <span class="chip__label">{{ chip.label }}</span>
      <span class="chip__count">{{ counts[chip.id] }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import type { TaskFilter } from '~/types/agent'

defineProps<{
  modelValue: TaskFilter
  counts: Record<TaskFilter, number>
}>()

const emit = defineEmits<{ 'update:modelValue': [value: TaskFilter] }>()

const chips: { id: TaskFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'done', label: 'Done' },
  { id: 'problems', label: 'Problems' },
]
</script>

<style scoped>
.chips {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 2px; /* room so focus ring isn't clipped */
}
.chips::-webkit-scrollbar {
  display: none;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  flex: none;
  min-height: 36px;
  padding: 0 0.85rem;
  border-radius: 999px;
  border: 1px solid var(--border-1);
  background: var(--surface-2);
  color: var(--text-2);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    background 0.15s ease,
    color 0.15s ease,
    border-color 0.15s ease;
}
.chip:hover {
  background: var(--surface-3);
  color: var(--text-1);
}
.chip--active {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-contrast);
}

.chip__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.4em;
  padding: 0 0.35em;
  height: 1.4em;
  border-radius: 999px;
  background: var(--surface-1);
  color: var(--text-2);
  font-size: 0.75rem;
  font-weight: 700;
}
.chip--active .chip__count {
  background: color-mix(in srgb, var(--accent-contrast) 22%, transparent);
  color: var(--accent-contrast);
}
</style>
