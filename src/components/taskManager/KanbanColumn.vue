<script setup lang="ts">
import { computed, ref, nextTick } from 'vue'
import type {
  KanbanColumnProps,
  KanbanColumnEmitEvents,
  Task,
  TaskStatus,
} from '../../BLL/taskManager/types'
import TaskCard from './TaskCard.vue'

const props = withDefaults(defineProps<KanbanColumnProps>(), {
  filterState: () => ({ priority: null, assignee: null, search: '' }),
})
const emit = defineEmits<KanbanColumnEmitEvents>()

const columnTasks = computed<Task[]>(() =>
  props.manager.getFilteredByStatus(props.status, props.filterState ?? { priority: null, assignee: null, search: '' }),
)

// Core boards are protected: cannot be renamed or removed.
const PROTECTED = new Set(['todo', 'in-progress', 'done'])
const isProtected = computed<boolean>(() => PROTECTED.has(props.status))

const dotClass = computed<string>(() =>
  PROTECTED.has(props.status) ? `dot--${props.status}` : 'dot--custom',
)

// ── Inline label editing ──────────────────────────────────────────────────

const isEditingLabel = ref(false)
const editLabelValue = ref('')
const labelInputRef = ref<HTMLInputElement | null>(null)

async function startEditLabel(): Promise<void> {
  if (isProtected.value) return          // core boards are not renameable
  editLabelValue.value = props.label
  isEditingLabel.value = true
  await nextTick()
  labelInputRef.value?.select()
}

function commitEditLabel(): void {
  if (!isEditingLabel.value) return // prevent double-fire from Enter then blur
  isEditingLabel.value = false
  const trimmed = editLabelValue.value.trim()
  if (trimmed && trimmed !== props.label) {
    emit('rename', props.status as TaskStatus, trimmed)
  }
}

function cancelEditLabel(): void {
  isEditingLabel.value = false
}

// ── Card event forwarding ─────────────────────────────────────────────────

function onCardEdit(task: Task): void {
  emit('edit', task)
}

function onCardDelete(taskId: string): void {
  emit('delete', taskId)
}

function onRemoveBoard(): void {
  emit('remove', props.status as TaskStatus)
}

// ── Drag-and-drop (native HTML5 API) ──────────────────────────────────────

const isDragOver = ref(false)

function onDragOver(event: DragEvent): void {
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
}

function onDragEnter(event: DragEvent): void {
  event.preventDefault()
  isDragOver.value = true
}

function onDragLeave(event: DragEvent): void {
  const currentTarget = event.currentTarget as HTMLElement
  const related = event.relatedTarget as Node | null
  if (!related || !currentTarget.contains(related)) {
    isDragOver.value = false
  }
}

function onDrop(event: DragEvent): void {
  event.preventDefault()
  isDragOver.value = false
  const taskId = event.dataTransfer?.getData('text/plain') ?? ''
  if (taskId) {
    props.manager.moveTo(taskId, props.status)
  }
}
</script>

<template>
  <div
    class="column"
    :class="{ 'column--drag-over': isDragOver }"
    @dragover="onDragOver"
    @dragenter="onDragEnter"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <!-- Column header -->
    <div class="column-header">
      <div class="column-meta">
        <span class="column-dot" :class="dotClass" aria-hidden="true" />
        <input
          v-if="isEditingLabel"
          ref="labelInputRef"
          v-model="editLabelValue"
          class="column-label-input"
          type="text"
          @keydown.enter.prevent="commitEditLabel"
          @keydown.escape.prevent="cancelEditLabel"
          @blur="commitEditLabel"
        />
        <h2
          v-else
          class="column-label"
          :class="{ 'column-label--editable': !isProtected }"
          :title="isProtected ? undefined : 'Click to rename'"
          @click="startEditLabel"
        >
          {{ props.label }}
        </h2>
        <span class="column-count">{{ columnTasks.length }}</span>
      </div>
      <div class="column-header-actions">
        <button
          class="header-icon-btn"
          :title="`Add card to ${props.label}`"
          @click="emit('create', props.status as TaskStatus)"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
        <button
          v-if="!isProtected"
          class="header-icon-btn header-icon-btn--danger"
          :title="`Remove ${props.label} board`"
          @click="onRemoveBoard"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M2 3.5h10M5.5 3.5V2.5h3v1M6 6v5M8 6v5M3 3.5l.75 8.5h6.5L11 3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Card list -->
    <div class="column-body">
      <TransitionGroup name="card" tag="div" class="cards-list">
        <TaskCard
          v-for="(task, idx) in columnTasks"
          :key="task.id"
          v-motion
          :initial="{ opacity: 0, y: 14, scale: 0.98 }"
          :enter="{
            opacity: 1, y: 0, scale: 1,
            transition: { duration: 300, delay: idx * 40, easing: 'easeOutExpo' }
          }"
          :task="task"
          :manager="props.manager"
          @edit="onCardEdit"
          @delete="onCardDelete"
        />
      </TransitionGroup>

      <!-- Empty state -->
      <div v-if="columnTasks.length === 0" class="empty-state">
        <template v-if="props.status === 'todo'">
          <svg class="empty-icon" viewBox="0 0 48 48" fill="none" aria-hidden="true">
            <rect x="6" y="20" width="36" height="22" rx="3" stroke="currentColor" stroke-width="2"/>
            <path d="M6 30H16L20 35H28L32 30H42" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
            <path d="M24 6V19M18 13L24 19L30 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <p class="empty-label">Drop tasks here</p>
        </template>
        <template v-else-if="props.status === 'in-progress'">
          <svg class="empty-icon" viewBox="0 0 48 48" fill="none" aria-hidden="true">
            <circle cx="24" cy="24" r="17" stroke="currentColor" stroke-width="2"/>
            <path d="M24 14V24L31 28" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="24" cy="24" r="17" stroke="#C7D2FE" stroke-width="2" stroke-dasharray="26 80" stroke-dashoffset="-13" stroke-linecap="round"/>
          </svg>
          <p class="empty-label">Nothing in progress</p>
        </template>
        <template v-else-if="props.status === 'done'">
          <svg class="empty-icon" viewBox="0 0 48 48" fill="none" aria-hidden="true">
            <circle cx="24" cy="24" r="17" stroke="currentColor" stroke-width="2"/>
            <path d="M15 24L21 30L33 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <p class="empty-label">No completed tasks</p>
        </template>
        <template v-else>
          <svg class="empty-icon" viewBox="0 0 48 48" fill="none" aria-hidden="true">
            <rect x="9" y="12" width="30" height="24" rx="3" stroke="currentColor" stroke-width="2"/>
            <path d="M16 24h16M24 18v12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <p class="empty-label">No tasks yet</p>
        </template>
      </div>
    </div>

    <!-- Footer: Add a card (Trello-style) -->
    <div class="column-footer">
      <button
        class="add-card-btn"
        @click="emit('create', props.status as TaskStatus)"
      >
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
          <path d="M6.5 1.5v10M1.5 6.5h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
        Add a card
      </button>
    </div>
  </div>
</template>

<style scoped>
/* ── Column shell (Trello-style container) ───────────────────────────────── */

.column {
  width: 272px;
  min-width: 272px;
  max-width: 272px;
  display: flex;
  flex-direction: column;
  background: var(--bg-column);
  backdrop-filter: blur(12px) saturate(160%);
  -webkit-backdrop-filter: blur(12px) saturate(160%);
  border-radius: var(--radius-lg);
  border: 1.5px solid var(--border-column);
  max-height: calc(100vh - 120px);
  box-shadow:
    0 4px 16px rgba(99, 102, 241, 0.10),
    0 1px 4px rgba(99, 102, 241, 0.06);
  transition:
    border-color var(--duration-fast) var(--ease),
    box-shadow var(--duration-fast) var(--ease);
}

.column--drag-over {
  border-color: var(--accent);
  box-shadow:
    0 0 0 3px rgba(99, 102, 241, 0.20),
    0 4px 16px rgba(99, 102, 241, 0.15);
  background: rgba(224, 231, 255, 0.90);
}

/* ── Header ─────────────────────────────────────────────────────────────── */

.column-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--sp-3) var(--sp-3) var(--sp-2) var(--sp-3);
  flex-shrink: 0;
}

.column-meta {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  min-width: 0;
}

.column-dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}
.dot--todo        { background: var(--status-todo); }
.dot--in-progress { background: var(--status-in-progress); }
.dot--done        { background: var(--status-done); }
.dot--custom      { background: var(--text-muted); }

.column-label {
  font-size: 0.8125rem;   /* spec: 13px / 0.8rem / 600 */
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.column-label--editable {
  cursor: text;
  border-radius: var(--radius-sm);
  padding: 2px 4px;
  margin: -2px -4px;
  transition: background var(--duration-fast) var(--ease);
}
.column-label--editable:hover { background: rgba(99, 102, 241, 0.10); }

.column-label-input {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-secondary);
  background: var(--bg-surface);
  border: 2px solid var(--accent);
  border-radius: var(--radius-sm);
  outline: none;
  padding: 2px 6px;
  width: 130px;
}

.column-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  background: rgba(99, 102, 241, 0.12);
  color: var(--accent);
  border: 1px solid rgba(99, 102, 241, 0.20);
  border-radius: var(--radius-full);
  font-size: 0.6875rem;
  font-weight: 700;
  flex-shrink: 0;
}

.column-header-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease);
  flex-shrink: 0;
}

.column:hover .column-header-actions { opacity: 1; }

.header-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-md);
  color: var(--text-muted);
  transition:
    color var(--duration-fast) var(--ease),
    background var(--duration-fast) var(--ease);
}
.header-icon-btn:hover { color: var(--accent); background: rgba(99, 102, 241, 0.10); }
.header-icon-btn--danger:hover { color: var(--danger); background: var(--danger-light); }

/* ── Body (scrollable cards area) ───────────────────────────────────────── */

.column-body {
  flex: 1;
  overflow-y: auto;
  padding: 0 var(--sp-2) var(--sp-2);
  display: flex;
  flex-direction: column;
  gap: 0;
}

.cards-list {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  padding-top: var(--sp-2);
}

/* ── Empty state ────────────────────────────────────────────────────────── */

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--sp-8) var(--sp-4) var(--sp-4);
  text-align: center;
  color: var(--text-muted);
}

.empty-icon {
  width: 48px;
  height: 48px;
  margin-bottom: var(--sp-3);
  opacity: 0.4;
}

.empty-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-muted);
}

/* ── Footer: Add a card button ───────────────────────────────────────────── */

.column-footer {
  padding: var(--sp-2) var(--sp-2) var(--sp-2);
  flex-shrink: 0;
}

.add-card-btn {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  width: 100%;
  padding: var(--sp-2) var(--sp-3);
  border-radius: var(--radius-md);
  color: var(--text-muted);
  font-size: 0.8125rem;
  font-weight: 500;
  transition:
    color var(--duration-fast) var(--ease),
    background var(--duration-fast) var(--ease);
  text-align: left;
}
.add-card-btn:hover {
  color: var(--accent);
  background: rgba(99, 102, 241, 0.08);
}

/* ── Card transition animations ─────────────────────────────────────────── */

.card-enter-active {
  transition: opacity var(--duration-slow) var(--ease), transform var(--duration-slow) var(--ease);
}
.card-leave-active {
  transition: opacity var(--duration-normal) var(--ease), transform var(--duration-normal) var(--ease);
}
.card-enter-from { opacity: 0; transform: translateY(-6px); }
.card-leave-to   { opacity: 0; transform: translateY(4px); }
.card-move       { transition: transform var(--duration-slow) var(--ease); }
</style>
