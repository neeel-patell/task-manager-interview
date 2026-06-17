<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import type {
  KanbanBoardProps,
  KanbanBoardEmitEvents,
  TaskStatus,
  Task,
  FilterState,
  TaskPriority,
} from '../../BLL/taskManager/types'
import { formatStatusLabel, normalizeStatusSlug } from '../../BLL/taskManager/TaskManager'
import KanbanColumn from './KanbanColumn.vue'

const props = defineProps<KanbanBoardProps>()
const emit = defineEmits<KanbanBoardEmitEvents>()

const columns = computed(() =>
  props.manager.statuses.map((s) => ({ status: s, label: props.manager.getStatusLabel(s) })),
)

// ── Add board ─────────────────────────────────────────────────────────────

const showAddCol = ref(false)
const newColName = ref('')
const addColInputRef = ref<HTMLInputElement | null>(null)

async function openAddCol(): Promise<void> {
  showAddCol.value = true
  newColName.value = ''
  await nextTick()
  addColInputRef.value?.focus()
}

function commitAddCol(): void {
  const slug = normalizeStatusSlug(newColName.value, props.manager.statuses)
  if (slug) props.manager.addStatus(slug)
  showAddCol.value = false
  newColName.value = ''
}

function cancelAddCol(): void {
  showAddCol.value = false
  newColName.value = ''
}

// Commit on blur if there's text; cancel if empty.
// This prevents accidentally losing a typed board name when clicking elsewhere.
function onAddColBlur(): void {
  if (newColName.value.trim()) {
    commitAddCol()
  } else {
    cancelAddCol()
  }
}

// ── Remove board dialog ───────────────────────────────────────────────────

type TransferMode = 'existing' | 'new' | 'delete-all'

interface RemoveTarget { status: TaskStatus; label: string }

const removeTarget = ref<RemoveTarget | null>(null)
const transferMode = ref<TransferMode>('existing')
const transferExistingSlug = ref<string>('')
const transferNewName = ref<string>('')

const removeTaskCount = computed<number>(() =>
  removeTarget.value
    ? props.manager.getTasksByStatus(removeTarget.value.status).length
    : 0,
)

const otherStatuses = computed<{ status: string; label: string }[]>(() =>
  removeTarget.value
    ? props.manager.statuses
        .filter((s) => s !== removeTarget.value!.status)
        .map((s) => ({ status: s, label: formatStatusLabel(s) }))
    : [],
)

// Reset transfer state whenever we pick a new remove target.
watch(removeTarget, (val) => {
  if (val) {
    const others = props.manager.statuses.filter((s) => s !== val.status)
    transferMode.value = 'existing'
    transferExistingSlug.value = others[0] ?? ''
    transferNewName.value = ''
  }
})

function onRemove(status: TaskStatus): void {
  removeTarget.value = { status, label: formatStatusLabel(status) }
}

function cancelRemove(): void {
  removeTarget.value = null
}

function confirmRemove(): void {
  if (!removeTarget.value) return
  const slug = removeTarget.value.status
  const taskIds = props.manager.getTasksByStatus(slug).map((t) => t.id)

  if (taskIds.length === 0) {
    // Simple empty-board removal
    props.manager.removeStatus(slug)
  } else if (transferMode.value === 'existing' && transferExistingSlug.value) {
    // Move tasks to existing board, then remove
    taskIds.forEach((id) => props.manager.moveTo(id, transferExistingSlug.value))
    props.manager.removeStatus(slug)
  } else if (transferMode.value === 'new') {
    const newSlug = normalizeStatusSlug(transferNewName.value, props.manager.statuses)
    if (!newSlug) return
    props.manager.addStatus(newSlug)
    taskIds.forEach((id) => props.manager.moveTo(id, newSlug))
    props.manager.removeStatus(slug)
  } else if (transferMode.value === 'delete-all') {
    // deleteTask mutates the array; iterate a snapshot
    taskIds.forEach((id) => props.manager.deleteTask(id))
    props.manager.removeStatus(slug)
  }

  removeTarget.value = null
}

// ── Drop onto "Add board" widget ─────────────────────────────────────────

const isAnyDragging = ref(false)
const isAddBoardDragOver = ref(false)

function onBoardDragStart(): void { isAnyDragging.value = true }
function onBoardDragEnd(): void {
  isAnyDragging.value = false
  isAddBoardDragOver.value = false
}

function generateNewBoardName(): string {
  const base = 'new-board'
  if (!props.manager.statuses.includes(base)) return base
  let i = 2
  while (props.manager.statuses.includes(`${base}-${i}`)) i++
  return `${base}-${i}`
}

function onAddBoardDragOver(event: DragEvent): void {
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
}

function onAddBoardDragEnter(event: DragEvent): void {
  event.preventDefault()
  isAddBoardDragOver.value = true
}

function onAddBoardDragLeave(event: DragEvent): void {
  const target = event.currentTarget as HTMLElement
  const related = event.relatedTarget as Node | null
  if (!related || !target.contains(related)) isAddBoardDragOver.value = false
}

function onAddBoardDrop(event: DragEvent): void {
  event.preventDefault()
  isAddBoardDragOver.value = false
  const taskId = event.dataTransfer?.getData('text/plain') ?? ''
  if (!taskId) return
  const slug = generateNewBoardName()
  props.manager.addStatus(slug)
  props.manager.moveTo(taskId, slug)
}

// ── Filter state ──────────────────────────────────────────────────────────

const filterState = ref<FilterState>({ priority: null, assignee: null, search: '' })

const assignees = computed<string[]>(() => props.manager.getAssignees())

const isFilterActive = computed<boolean>(() =>
  filterState.value.priority !== null ||
  filterState.value.assignee !== null ||
  filterState.value.search !== '',
)

const visibleTaskCount = computed<number>(() =>
  columns.value.reduce(
    (sum, col) => sum + props.manager.getFilteredByStatus(col.status, filterState.value).length,
    0,
  ),
)

function onPriorityChange(event: Event): void {
  const value = (event.target as HTMLSelectElement).value
  filterState.value = { ...filterState.value, priority: (value as TaskPriority) || null }
}

function onAssigneeChange(event: Event): void {
  const value = (event.target as HTMLSelectElement).value
  filterState.value = { ...filterState.value, assignee: value || null }
}

function clearFilters(): void {
  filterState.value = { priority: null, assignee: null, search: '' }
}

const PRIORITY_OPTIONS: { value: TaskPriority | null; label: string }[] = [
  { value: null,     label: 'All priorities' },
  { value: 'high',   label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low',    label: 'Low' },
]

// ── Column event forwarding ───────────────────────────────────────────────

function onEdit(task: Task): void { emit('edit', task) }
function onDelete(taskId: string): void { emit('delete', taskId) }
function onCreate(status: TaskStatus): void { emit('create', status) }
function onRename(status: TaskStatus, label: string): void { props.manager.renameStatus(status, label) }
</script>

<template>
  <div class="board-frame">
    <!-- ── Filter toolbar ──────────────────────────────────────────────── -->
    <div class="board-toolbar">
      <div class="toolbar-left">
        <div class="search-wrap">
          <svg class="search-icon" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <circle cx="6" cy="6" r="4.5" stroke="#94A3B8" stroke-width="1.3"/>
            <path d="M10 10L13 13" stroke="#94A3B8" stroke-width="1.3" stroke-linecap="round"/>
          </svg>
          <input
            v-model="filterState.search"
            class="search-input"
            type="search"
            placeholder="Search tasks…"
            aria-label="Search tasks"
          />
        </div>

        <select
          class="filter-select"
          :value="filterState.priority ?? ''"
          aria-label="Filter by priority"
          @change="onPriorityChange"
        >
          <option
            v-for="opt in PRIORITY_OPTIONS"
            :key="String(opt.value)"
            :value="opt.value ?? ''"
          >{{ opt.label }}</option>
        </select>

        <select
          class="filter-select"
          :value="filterState.assignee ?? ''"
          aria-label="Filter by assignee"
          @change="onAssigneeChange"
        >
          <option value="">All assignees</option>
          <option v-for="a in assignees" :key="a" :value="a">{{ a }}</option>
        </select>

        <button
          v-if="isFilterActive"
          class="clear-btn"
          @click="clearFilters"
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
            <path d="M1.5 1.5l8 8M9.5 1.5l-8 8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
          </svg>
          Clear
        </button>
      </div>

      <div class="toolbar-right">
        <span class="task-count">{{ visibleTaskCount }} task{{ visibleTaskCount !== 1 ? 's' : '' }}</span>
      </div>
    </div>

    <div class="board-scroll" @dragstart="onBoardDragStart" @dragend="onBoardDragEnd">
      <div class="board">
      <KanbanColumn
        v-for="(col, idx) in columns"
        :key="col.status"
        v-motion
        :initial="{ opacity: 0, y: 28, scale: 0.97 }"
        :enter="{
          opacity: 1, y: 0, scale: 1,
          transition: { duration: 400, delay: idx * 70, easing: 'easeOutExpo' }
        }"
        :manager="props.manager"
        :status="col.status"
        :label="col.label"
        :filter-state="filterState"
        @edit="onEdit"
        @delete="onDelete"
        @create="onCreate"
        @remove="onRemove"
        @rename="onRename"
      />

      <!-- Add board widget — expands into a prominent drop zone while dragging -->
      <div
        class="add-col-widget"
        :class="{
          'add-col-widget--dragging':  isAnyDragging && !showAddCol,
          'add-col-widget--drag-over': isAddBoardDragOver,
        }"
        @dragover="onAddBoardDragOver"
        @dragenter="onAddBoardDragEnter"
        @dragleave="onAddBoardDragLeave"
        @drop="onAddBoardDrop"
      >
        <!-- Drag-expand state: shown while any card is being dragged -->
        <div v-if="isAnyDragging && !showAddCol" class="add-col-drop-zone">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
            <rect x="1.5" y="1.5" width="25" height="25" rx="5" stroke="currentColor" stroke-width="1.75" stroke-dasharray="4 3"/>
            <path d="M14 8v12M8 14h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <span class="add-col-drop-label">Drop here to create<br>a new board</span>
        </div>

        <!-- Normal state: input form or "+ Add another board" button -->
        <template v-else>
          <div v-if="showAddCol" class="add-col-form">
            <input
              ref="addColInputRef"
              v-model="newColName"
              class="add-col-input"
              type="text"
              placeholder="Board name…"
              autocomplete="off"
              @keydown.enter="commitAddCol"
              @keydown.escape="cancelAddCol"
              @blur="onAddColBlur"
            />
            <div class="add-col-actions">
              <button class="add-col-confirm" @click="commitAddCol">Add board</button>
              <button class="add-col-cancel" @click="cancelAddCol">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M3 3l8 8M11 3L3 11" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
                </svg>
              </button>
            </div>
          </div>
          <button v-else class="add-col-btn" @click="openAddCol">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            Add another board
          </button>
        </template>
      </div>
      </div>
    </div>
  </div>

  <!-- ── Remove board dialog ─────────────────────────────────────────────── -->
  <Teleport to="body">
    <Transition name="overlay">
      <div
        v-if="removeTarget"
        class="overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="remove-board-title"
        @click.self="cancelRemove"
      >
        <div class="remove-dialog">

          <!-- ── Simple confirmation: board is empty ── -->
          <template v-if="removeTaskCount === 0">
            <div class="dialog-icon dialog-icon--warn" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M4 6h16M9 6V4h6v2M10 11v6M14 11v6M5 6l1 14h12l1-14" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <h3 id="remove-board-title" class="dialog-title">
              Remove "{{ removeTarget.label }}" board?
            </h3>
            <p class="dialog-body">
              This board is empty. It will be permanently removed.
            </p>
            <div class="dialog-actions">
              <button class="btn-secondary" @click="cancelRemove">Cancel</button>
              <button class="btn-danger" @click="confirmRemove">Remove board</button>
            </div>
          </template>

          <!-- ── Transfer dialog: board has tasks ── -->
          <template v-else>
            <div class="dialog-icon dialog-icon--warn" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <h3 id="remove-board-title" class="dialog-title">
              Remove "{{ removeTarget.label }}" board
            </h3>
            <p class="dialog-body">
              This board has <strong>{{ removeTaskCount }} task{{ removeTaskCount !== 1 ? 's' : '' }}</strong>.
              Choose what should happen to them:
            </p>

            <!-- Option cards -->
            <div class="transfer-options">
              <!-- Move to existing board -->
              <button
                class="transfer-card"
                :class="{ 'transfer-card--active': transferMode === 'existing' }"
                type="button"
                @click="transferMode = 'existing'"
              >
                <div class="transfer-card-header">
                  <div class="transfer-radio" :class="{ 'transfer-radio--on': transferMode === 'existing' }" aria-hidden="true" />
                  <div class="transfer-card-label">
                    <span class="transfer-card-title">Move to existing board</span>
                    <span class="transfer-card-sub">Tasks migrate to a board you choose</span>
                  </div>
                </div>
                <select
                  v-if="transferMode === 'existing'"
                  v-model="transferExistingSlug"
                  class="transfer-select"
                  @click.stop
                >
                  <option
                    v-for="s in otherStatuses"
                    :key="s.status"
                    :value="s.status"
                  >
                    {{ s.label }}
                  </option>
                </select>
              </button>

              <!-- Move to new board -->
              <button
                class="transfer-card"
                :class="{ 'transfer-card--active': transferMode === 'new' }"
                type="button"
                @click="transferMode = 'new'"
              >
                <div class="transfer-card-header">
                  <div class="transfer-radio" :class="{ 'transfer-radio--on': transferMode === 'new' }" aria-hidden="true" />
                  <div class="transfer-card-label">
                    <span class="transfer-card-title">Move to new board</span>
                    <span class="transfer-card-sub">Create a new board and transfer tasks there</span>
                  </div>
                </div>
                <input
                  v-if="transferMode === 'new'"
                  v-model="transferNewName"
                  class="transfer-input"
                  type="text"
                  placeholder="New board name…"
                  autocomplete="off"
                  @click.stop
                />
              </button>

              <!-- Delete all tasks -->
              <button
                class="transfer-card transfer-card--danger-opt"
                :class="{ 'transfer-card--active transfer-card--danger-active': transferMode === 'delete-all' }"
                type="button"
                @click="transferMode = 'delete-all'"
              >
                <div class="transfer-card-header">
                  <div
                    class="transfer-radio"
                    :class="{ 'transfer-radio--on transfer-radio--danger': transferMode === 'delete-all' }"
                    aria-hidden="true"
                  />
                  <div class="transfer-card-label">
                    <span class="transfer-card-title">Delete all tasks</span>
                    <span class="transfer-card-sub">
                      Permanently removes {{ removeTaskCount }} task{{ removeTaskCount !== 1 ? 's' : '' }} — cannot be undone
                    </span>
                  </div>
                </div>
              </button>
            </div>

            <div class="dialog-actions">
              <button class="btn-secondary" @click="cancelRemove">Cancel</button>
              <button
                class="btn-danger"
                :disabled="transferMode === 'new' && !transferNewName.trim()"
                @click="confirmRemove"
              >
                {{ transferMode === 'delete-all' ? 'Delete tasks & remove board' : 'Move tasks & remove board' }}
              </button>
            </div>
          </template>

        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* ── Board frame ─────────────────────────────────────────────────────────── */

.board-frame {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ── Filter toolbar ──────────────────────────────────────────────────────── */

.board-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
  padding: var(--sp-3) var(--sp-5);
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}

.search-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: var(--sp-3);
  pointer-events: none;
}

.search-input {
  padding: 6px var(--sp-3) 6px 34px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: 0.8125rem;
  background: var(--bg-column);
  color: var(--text-primary);
  outline: none;
  width: 200px;
  transition:
    border-color var(--duration-fast) var(--ease),
    box-shadow var(--duration-fast) var(--ease),
    width var(--duration-normal) var(--ease),
    background var(--duration-fast) var(--ease);
}
.search-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
  background: var(--bg-surface);
  width: 240px;
}

.filter-select {
  padding: 6px var(--sp-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: 0.8125rem;
  background: var(--bg-column);
  color: var(--text-secondary);
  outline: none;
  cursor: pointer;
  font-weight: 500;
  transition:
    border-color var(--duration-fast) var(--ease),
    background var(--duration-fast) var(--ease);
}
.filter-select:focus { border-color: var(--accent); background: var(--bg-surface); }

.clear-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-1);
  padding: 6px var(--sp-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-muted);
  background: var(--bg-column);
  cursor: pointer;
  transition:
    color var(--duration-fast) var(--ease),
    border-color var(--duration-fast) var(--ease),
    background var(--duration-fast) var(--ease);
}
.clear-btn:hover {
  color: var(--danger);
  border-color: var(--danger);
  background: var(--danger-light);
}

.task-count {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-weight: 500;
  background: var(--bg-column);
  padding: 4px var(--sp-3);
  border-radius: var(--radius-full);
  border: 1px solid var(--border);
}

.board-scroll {
  flex: 1;
  overflow: auto;
  padding: var(--sp-4) var(--sp-6) var(--sp-6);
  background-image: radial-gradient(circle, #C7D2FE 1px, transparent 1px);
  background-size: 24px 24px;
  background-color: #FFFFFF;
}

/* ── Board ───────────────────────────────────────────────────────────────── */

.board {
  display: flex;
  gap: var(--sp-3);
  align-items: flex-start;
  min-height: 100%;
}

/* ── Add board widget ────────────────────────────────────────────────────── */

.add-col-widget {
  flex-shrink: 0;
  width: 272px;
  min-width: 272px;
  align-self: flex-start;
  transition: min-height var(--duration-normal) var(--ease-out-expo);
}

/* Expand to a tall drop zone while any card is being dragged */
.add-col-widget--dragging {
  align-self: stretch;
  min-height: 160px;
}

.add-col-drop-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--sp-3);
  height: 100%;
  min-height: 160px;
  border-radius: var(--radius-lg);
  border: 2px dashed var(--border);
  color: var(--text-muted);
  background: var(--bg-column);
  transition:
    background var(--duration-fast) var(--ease),
    border-color var(--duration-fast) var(--ease),
    color var(--duration-fast) var(--ease);
}

.add-col-drop-label {
  font-size: 0.8125rem;
  font-weight: 500;
  text-align: center;
  line-height: 1.5;
}

.add-col-widget--drag-over .add-col-drop-zone {
  background: var(--accent-light);
  border-color: var(--accent);
  border-style: solid;
  color: var(--accent);
}

.add-col-btn {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-3) var(--sp-4);
  width: 100%;
  border-radius: var(--radius-lg);
  background: var(--bg-column);
  border: 1.5px dashed var(--border);
  color: var(--text-secondary);
  font-size: 0.8125rem;
  font-weight: 500;
  transition:
    color var(--duration-fast) var(--ease),
    background var(--duration-fast) var(--ease),
    border-color var(--duration-fast) var(--ease);
}
.add-col-btn:hover {
  background: var(--bg-surface);
  color: var(--accent);
  border-color: var(--accent);
}

.add-col-form {
  background: var(--bg-column);
  border-radius: var(--radius-lg);
  padding: var(--sp-3);
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}

.add-col-input {
  width: 100%;
  padding: var(--sp-2) var(--sp-3);
  border: 2px solid var(--accent);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 500;
  background: var(--bg-surface);
  color: var(--text-primary);
  outline: none;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
}

.add-col-actions {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}

.add-col-confirm {
  padding: var(--sp-2) var(--sp-3);
  background: var(--accent);
  color: #fff;
  border-radius: var(--radius-md);
  font-size: 0.8125rem;
  font-weight: 600;
  transition: background var(--duration-fast) var(--ease);
}
.add-col-confirm:hover { background: var(--accent-hover); }

.add-col-cancel {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-md);
  color: var(--text-muted);
  transition: color var(--duration-fast) var(--ease), background var(--duration-fast) var(--ease);
}
.add-col-cancel:hover { color: var(--text-secondary); background: var(--border-light); }

/* ── Remove board overlay ────────────────────────────────────────────────── */

.overlay {
  position: fixed;
  inset: 0;
  background: var(--bg-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  padding: var(--sp-4);
}

.remove-dialog {
  background: var(--bg-surface);
  border-radius: var(--radius-lg);
  padding: var(--sp-6);
  width: 100%;
  max-width: 460px;
  box-shadow: var(--shadow-xl);
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
}

/* ── Dialog header ───────────────────────────────────────────────────────── */

.dialog-icon {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.dialog-icon--warn {
  background: #FFF7ED;
  color: #D97706;
}

.dialog-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.3;
}

.dialog-body {
  font-size: 0.875rem;
  color: var(--text-secondary);
  line-height: 1.5;
  margin-top: calc(var(--sp-4) * -1);  /* collapse gap with title */
}

/* ── Transfer option cards ───────────────────────────────────────────────── */

.transfer-options {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}

.transfer-card {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  padding: var(--sp-3) var(--sp-4);
  border: 1.5px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-hover);
  text-align: left;
  transition:
    border-color var(--duration-fast) var(--ease),
    background var(--duration-fast) var(--ease);
  width: 100%;
  cursor: pointer;
}
.transfer-card:hover {
  border-color: var(--accent);
  background: var(--bg-surface);
}
.transfer-card--active {
  border-color: var(--accent);
  background: var(--accent-light);
}

.transfer-card--danger-opt:hover {
  border-color: var(--danger);
  background: var(--bg-surface);
}
.transfer-card--danger-active {
  border-color: var(--danger) !important;
  background: var(--danger-light) !important;
}

.transfer-card-header {
  display: flex;
  align-items: flex-start;
  gap: var(--sp-3);
}

/* Custom radio dot */
.transfer-radio {
  width: 16px;
  height: 16px;
  border-radius: var(--radius-full);
  border: 2px solid var(--border);
  flex-shrink: 0;
  margin-top: 2px;
  transition:
    border-color var(--duration-fast) var(--ease),
    background var(--duration-fast) var(--ease),
    box-shadow var(--duration-fast) var(--ease);
}
.transfer-radio--on {
  border-color: var(--accent);
  background: var(--accent);
  box-shadow: inset 0 0 0 3px var(--bg-surface);
}
.transfer-radio--danger {
  border-color: var(--danger) !important;
  background: var(--danger) !important;
}

.transfer-card-label {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.transfer-card-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
}

.transfer-card-sub {
  font-size: 0.75rem;
  color: var(--text-muted);
  line-height: 1.4;
}

.transfer-select {
  width: 100%;
  padding: var(--sp-2) var(--sp-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  background: var(--bg-surface);
  color: var(--text-primary);
  outline: none;
  cursor: pointer;
  transition: border-color var(--duration-fast) var(--ease);
}
.transfer-select:focus { border-color: var(--accent); }

.transfer-input {
  width: 100%;
  padding: var(--sp-2) var(--sp-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  background: var(--bg-surface);
  color: var(--text-primary);
  outline: none;
  transition:
    border-color var(--duration-fast) var(--ease),
    box-shadow var(--duration-fast) var(--ease);
}
.transfer-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
}

/* ── Dialog actions ──────────────────────────────────────────────────────── */

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--sp-3);
  padding-top: var(--sp-2);
  border-top: 1px solid var(--border);
}

button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* ── Overlay transition ──────────────────────────────────────────────────── */

.overlay-enter-active,
.overlay-leave-active {
  transition: opacity var(--duration-normal) var(--ease);
}
.overlay-enter-from,
.overlay-leave-to {
  opacity: 0;
}
</style>
