<script setup lang="ts">
import type { ViewToggleProps, ViewToggleEmitEvents, ViewMode } from '../../BLL/taskManager/types'

const props = defineProps<ViewToggleProps>()
const emit = defineEmits<ViewToggleEmitEvents>()

function select(mode: ViewMode): void {
  emit('update:modelValue', mode)
}
</script>

<template>
  <div class="toggle" role="group" aria-label="View mode">
    <button
      class="toggle-btn"
      :class="{ active: props.modelValue === 'kanban' }"
      title="Kanban board"
      aria-pressed="true"
      @click="select('kanban')"
    >
      <!-- Kanban grid icon -->
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="1" y="1" width="4" height="14" rx="1" fill="currentColor" />
        <rect x="6" y="1" width="4" height="10" rx="1" fill="currentColor" />
        <rect x="11" y="1" width="4" height="12" rx="1" fill="currentColor" />
      </svg>
      Kanban
    </button>
    <button
      class="toggle-btn"
      :class="{ active: props.modelValue === 'list' }"
      title="List view"
      @click="select('list')"
    >
      <!-- List rows icon -->
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="1" y="2" width="14" height="2.5" rx="1" fill="currentColor" />
        <rect x="1" y="6.5" width="14" height="2.5" rx="1" fill="currentColor" />
        <rect x="1" y="11" width="14" height="2.5" rx="1" fill="currentColor" />
      </svg>
      List
    </button>
  </div>
</template>

<style scoped>
.toggle {
  display: inline-flex;
  background: #3730A3;
  border: 1px solid #312E81;
  border-radius: var(--radius-md);
  padding: 2px;
  gap: 2px;
}

.toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-1);
  padding: 5px var(--sp-3);
  border-radius: calc(var(--radius-md) - 2px);
  font-size: 0.8125rem;
  font-weight: 500;
  color: #A5B4FC;
  transition:
    background var(--duration-fast) var(--ease),
    color var(--duration-fast) var(--ease);
}

.toggle-btn:hover:not(.active) {
  color: #C7D2FE;
  background: #4338CA;
}

.toggle-btn.active {
  background: #fff;
  color: #4338CA;
  font-weight: 700;
}
</style>
