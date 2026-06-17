<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type {
  ListViewProps,
  ListViewEmitEvents,
  Task,
  TaskPriority,
  SortField,
  FilterState,
  SortState,
} from '../../BLL/taskManager/types'
import { getAvatarColor, getInitials, formatStatusLabel } from '../../BLL/taskManager/TaskManager'

const props = defineProps<ListViewProps>()
const emit = defineEmits<ListViewEmitEvents>()

// ── Filter + sort state lives in this component (presentation state) ──────

const filterState = ref<FilterState>({
  priority: null,
  assignee: null,
  search: '',
})

const sortState = ref<SortState>({
  field: 'dueDate',
  direction: 'asc',
})

const PAGE_SIZE = 10

const allSortedTasks = computed<Task[]>(() =>
  props.manager.filterAndSort(filterState.value, sortState.value),
)

const page = ref(1)

watch([filterState, sortState], () => { page.value = 1 }, { deep: true })

const totalPages = computed<number>(() => Math.max(1, Math.ceil(allSortedTasks.value.length / PAGE_SIZE)))

const sortedTasks = computed<Task[]>(() => {
  if (!props.paginated) return allSortedTasks.value
  const start = (page.value - 1) * PAGE_SIZE
  return allSortedTasks.value.slice(start, start + PAGE_SIZE)
})

const pageNumbers = computed<(number | '…')[]>(() => {
  const total = totalPages.value
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  if (page.value <= 4) return [1, 2, 3, 4, 5, '…', total]
  if (page.value >= total - 3) return [1, '…', total - 4, total - 3, total - 2, total - 1, total]
  return [1, '…', page.value - 1, page.value, page.value + 1, '…', total]
})

const assignees = computed<string[]>(() => props.manager.getAssignees())

// ── Sort helpers ──────────────────────────────────────────────────────────

function toggleSort(field: SortField): void {
  if (sortState.value.field === field) {
    sortState.value = {
      field,
      direction: sortState.value.direction === 'asc' ? 'desc' : 'asc',
    }
  } else {
    sortState.value = { field, direction: 'asc' }
  }
}

function sortIcon(field: SortField): string {
  if (sortState.value.field !== field) return '↕'
  return sortState.value.direction === 'asc' ? '↑' : '↓'
}

function setPriority(p: TaskPriority | null): void {
  filterState.value = { ...filterState.value, priority: p }
}

function setAssignee(a: string | null): void {
  filterState.value = { ...filterState.value, assignee: a }
}

function onPriorityChange(event: Event): void {
  const value = (event.target as HTMLSelectElement).value
  setPriority((value as TaskPriority) || null)
}

function onAssigneeChange(event: Event): void {
  const value = (event.target as HTMLSelectElement).value
  setAssignee(value || null)
}

// ── Display helpers ───────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// Known statuses get a colour class; custom statuses fall back to the neutral base chip style.
const KNOWN_STATUS_CLASSES = new Set(['todo', 'in-progress', 'done'])

function statusClass(status: string): string {
  return KNOWN_STATUS_CLASSES.has(status) ? `status--${status}` : 'status--custom'
}

const PRIORITY_OPTIONS: { value: TaskPriority | null; label: string }[] = [
  { value: null,     label: 'All priorities' },
  { value: 'high',   label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low',    label: 'Low' },
]
</script>

<template>
  <div class="list-view">
    <!-- ── Toolbar ──────────────────────────────────────────────────────── -->
    <div class="toolbar">
      <div class="toolbar-left">
        <!-- Search -->
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

        <!-- Priority filter -->
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
          >
            {{ opt.label }}
          </option>
        </select>

        <!-- Assignee filter -->
        <select
          class="filter-select"
          :value="filterState.assignee ?? ''"
          aria-label="Filter by assignee"
          @change="onAssigneeChange"
        >
          <option value="">All assignees</option>
          <option v-for="a in assignees" :key="a" :value="a">{{ a }}</option>
        </select>
      </div>

      <div class="toolbar-right">
        <span class="task-count">
          {{ allSortedTasks.length }} task{{ allSortedTasks.length !== 1 ? 's' : '' }}
        </span>
      </div>
    </div>

    <!-- ── Table ────────────────────────────────────────────────────────── -->
    <div class="table-wrap">
      <table class="task-table">
        <thead>
          <tr>
            <th class="col-priority">
              <button class="sort-btn" title="Sort by priority" @click="toggleSort('priority')">
                <span class="sort-icon" aria-hidden="true">{{ sortIcon('priority') }}</span>
              </button>
            </th>
            <th class="col-title">Title</th>
            <th class="col-status">Status</th>
            <th class="col-due">
              <button class="sort-btn" @click="toggleSort('dueDate')">
                Due <span class="sort-icon" aria-hidden="true">{{ sortIcon('dueDate') }}</span>
              </button>
            </th>
            <th class="col-assignee">Assignee</th>
            <th class="col-tags">Tags</th>
            <th class="col-actions" aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="task in sortedTasks"
            :key="task.id"
            class="task-row"
            @click="emit('edit', task)"
          >
            <!-- Priority -->
            <td class="col-priority">
              <div class="priority-icon-wrap" :class="`priority-icon--${task.priority}`" :title="task.priority">
                <!-- High: red up arrow -->
                <svg v-if="task.priority === 'high'" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-label="High priority">
                  <path d="M7 11V3M3.5 6.5L7 3L10.5 6.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <!-- Medium: amber equal/right -->
                <svg v-else-if="task.priority === 'medium'" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-label="Medium priority">
                  <path d="M2.5 5h9M2.5 9h9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
                <!-- Low: blue down arrow -->
                <svg v-else width="14" height="14" viewBox="0 0 14 14" fill="none" aria-label="Low priority">
                  <path d="M7 3v8M3.5 7.5L7 11L10.5 7.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
            </td>

            <!-- Title -->
            <td class="col-title">
              <span class="row-title">{{ task.title }}</span>
            </td>

            <!-- Status -->
            <td class="col-status">
              <span class="status-chip" :class="statusClass(task.status)">
                {{ formatStatusLabel(task.status) }}
              </span>
            </td>

            <!-- Due date -->
            <td class="col-due">
              <span
                class="due-cell"
                :class="{ 'due-cell--overdue': manager.isOverdue(task) }"
              >
                <svg
                  v-if="manager.isOverdue(task)"
                  width="11"
                  height="11"
                  viewBox="0 0 12 12"
                  fill="none"
                  aria-label="Overdue"
                >
                  <path d="M6 1L11 10H1L6 1Z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
                  <path d="M6 5v2.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                  <circle cx="6" cy="9" r="0.6" fill="currentColor"/>
                </svg>
                {{ formatDate(task.dueDate) }}
              </span>
            </td>

            <!-- Assignee -->
            <td class="col-assignee">
              <div class="assignee-cell">
                <div class="avatar-stack">
                  <div
                    v-for="name in task.assignees.slice(0, 3)"
                    :key="name"
                    class="avatar"
                    :style="{ background: getAvatarColor(name) }"
                    :title="name"
                  >
                    {{ getInitials(name) }}
                  </div>
                  <div
                    v-if="task.assignees.length > 3"
                    class="avatar avatar--overflow"
                    :title="`+${task.assignees.length - 3} more`"
                  >
                    +{{ task.assignees.length - 3 }}
                  </div>
                </div>
                <span class="assignee-name">
                  {{ task.assignees.length === 1
                      ? task.assignees[0]
                      : `${task.assignees[0]} +${task.assignees.length - 1}` }}
                </span>
              </div>
            </td>

            <!-- Tags -->
            <td class="col-tags">
              <div class="tags-cell">
                <span v-for="tag in task.tags.slice(0, 2)" :key="tag" class="tag">{{ tag }}</span>
                <span v-if="task.tags.length > 2" class="tag tag--more">+{{ task.tags.length - 2 }}</span>
              </div>
            </td>

            <!-- Actions -->
            <td class="col-actions">
              <div class="row-actions">
                <button
                  class="action-btn"
                  title="Edit"
                  @click.stop="emit('edit', task)"
                >
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                    <path d="M9.5 1.5L11.5 3.5L4 11H2V9L9.5 1.5Z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
                  </svg>
                </button>
                <button
                  class="action-btn action-btn--delete"
                  title="Delete"
                  @click.stop="emit('delete', task.id)"
                >
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                    <path d="M2 3.5h9M5 3.5V2.5h3v1M5.5 5.5v4M7.5 5.5v4M3 3.5l.5 7h6l.5-7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
              </div>
            </td>
          </tr>

          <!-- Empty state -->
          <tr v-if="sortedTasks.length === 0">
            <td colspan="7" class="empty-row">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
                <circle cx="20" cy="20" r="18" stroke="#CBD5E1" stroke-width="2"/>
                <path d="M13 20h14M20 13v14" stroke="#CBD5E1" stroke-width="2" stroke-linecap="round"/>
              </svg>
              <p>No tasks match your filters</p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ── Pagination (v2 only — enabled via paginated prop) ──────────── -->
    <div v-if="paginated && totalPages > 1" class="pagination" role="navigation" aria-label="Pagination">
      <button
        class="page-btn page-btn--arrow"
        :disabled="page === 1"
        aria-label="Previous page"
        @click="page--"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M9 11L5 7l4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>

      <template v-for="n in pageNumbers" :key="n">
        <span v-if="n === '…'" class="page-ellipsis">…</span>
        <button
          v-else
          class="page-btn"
          :class="{ 'page-btn--active': page === n }"
          :aria-label="`Page ${n}`"
          :aria-current="page === n ? 'page' : undefined"
          @click="page = n"
        >{{ n }}</button>
      </template>

      <button
        class="page-btn page-btn--arrow"
        :disabled="page === totalPages"
        aria-label="Next page"
        @click="page++"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M5 3l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.list-view {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  background: var(--bg-base);
}

/* ── Toolbar ────────────────────────────────────────────────────────────── */

.toolbar {
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
  color: var(--text-muted);
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
  transition: border-color var(--duration-fast) var(--ease), box-shadow var(--duration-fast) var(--ease), width var(--duration-normal) var(--ease), background var(--duration-fast) var(--ease);
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
  transition: border-color var(--duration-fast) var(--ease), background var(--duration-fast) var(--ease);
}
.filter-select:focus { border-color: var(--accent); background: var(--bg-surface); }

.task-count {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-weight: 500;
  background: var(--bg-column);
  padding: 4px var(--sp-3);
  border-radius: var(--radius-full);
  border: 1px solid var(--border);
}

/* ── Table wrapper ──────────────────────────────────────────────────────── */

.table-wrap {
  flex: 1;
  overflow: auto;
  padding: var(--sp-4) var(--sp-5);
}

.task-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 860px;
  background: var(--bg-surface);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

/* ── Table head ─────────────────────────────────────────────────────────── */

.task-table thead tr {
  border-bottom: 2px solid var(--border);
  background: var(--bg-column);
}

.task-table th {
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--text-muted);
  text-align: left;
  padding: var(--sp-2) var(--sp-3);
  white-space: nowrap;
}

.sort-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--text-muted);
  transition: color var(--duration-fast) var(--ease);
}
.sort-btn:hover { color: var(--text-secondary); }

.sort-icon { font-size: 0.75rem; }

/* ── Rows ───────────────────────────────────────────────────────────────── */

.task-row {
  border-bottom: 1px solid var(--border-light);
  transition:
    background var(--duration-fast) var(--ease),
    transform var(--duration-fast) var(--ease-spring);
  cursor: pointer;
  animation: slideUpFade 300ms var(--ease-out-expo) both;
}
.task-row:last-child { border-bottom: none; }
.task-row:hover {
  background: #F0F4FF;
  transform: translateX(2px);
}

/* Stagger row entrances */
.task-row:nth-child(1)  { animation-delay: 40ms; }
.task-row:nth-child(2)  { animation-delay: 70ms; }
.task-row:nth-child(3)  { animation-delay: 100ms; }
.task-row:nth-child(4)  { animation-delay: 130ms; }
.task-row:nth-child(5)  { animation-delay: 160ms; }
.task-row:nth-child(6)  { animation-delay: 190ms; }
.task-row:nth-child(7)  { animation-delay: 220ms; }
.task-row:nth-child(8)  { animation-delay: 250ms; }
.task-row:nth-child(9)  { animation-delay: 280ms; }
.task-row:nth-child(10) { animation-delay: 310ms; }

.task-table td {
  padding: var(--sp-2) var(--sp-3);
  font-size: 0.875rem;
  vertical-align: middle;
}

.col-priority { width: 36px; text-align: center; }
.col-title    { width: auto; }
.col-status   { width: 130px; }
.col-due      { width: 120px; }
.col-assignee { width: 160px; }
.col-tags     { width: 140px; }
.col-actions  { width: 68px; }

.row-title {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 0.875rem;
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 400px;
}

/* ── Priority icon ──────────────────────────────────────────────────────── */

.priority-icon-wrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
}
.priority-icon--high   { color: var(--priority-high-fg); }
.priority-icon--medium { color: var(--priority-medium-fg); }
.priority-icon--low    { color: var(--priority-low-fg); }

/* ── Status chip ────────────────────────────────────────────────────────── */

.status-chip {
  display: inline-flex;
  align-items: center;
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 3px 8px;
  border-radius: var(--radius-sm);
  white-space: nowrap;
  color: var(--text-secondary);
  background: var(--bg-column);
}
.status--todo        { color: var(--status-todo);        background: #EBECF0; }
.status--in-progress { color: var(--status-in-progress); background: var(--accent-light); }
.status--done        { color: var(--status-done);        background: #E3FCEF; }

/* ── Due date ───────────────────────────────────────────────────────────── */

.due-cell {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.8125rem;
  color: var(--text-secondary);
}
.due-cell--overdue { color: var(--priority-high-fg); font-weight: 600; }

/* ── Assignee ───────────────────────────────────────────────────────────── */

.assignee-cell {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}

.avatar-stack {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.avatar {
  width: 24px;
  height: 24px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.5625rem;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
  border: 2px solid var(--bg-surface);
}
.avatar-stack .avatar:not(:first-child) { margin-left: -6px; }

.avatar--overflow {
  background: var(--bg-column) !important;
  color: var(--text-secondary);
  border-color: var(--bg-surface);
  font-size: 0.5rem;
}

.assignee-name {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── Tags ───────────────────────────────────────────────────────────────── */

.tags-cell {
  display: flex;
  align-items: center;
  gap: var(--sp-1);
  flex-wrap: nowrap;
}

.tag {
  font-size: 0.625rem;
  font-weight: 600;
  color: var(--text-secondary);
  background: var(--bg-column);
  border-radius: var(--radius-sm);
  padding: 2px 6px;
  white-space: nowrap;
}
.tag--more { color: var(--text-muted); }

/* ── Row actions ────────────────────────────────────────────────────────── */

.row-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease);
}
.task-row:hover .row-actions { opacity: 1; }

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  transition: color var(--duration-fast) var(--ease), background var(--duration-fast) var(--ease);
}
.action-btn:hover         { color: var(--accent); background: var(--accent-light); }
.action-btn--delete:hover { color: var(--danger); background: var(--danger-light); }

/* ── Pagination ─────────────────────────────────────────────────────────── */

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--sp-1);
  padding: var(--sp-3) var(--sp-5);
  border-top: 1px solid var(--border);
  background: var(--bg-surface);
  flex-shrink: 0;
}

.page-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 32px;
  padding: 0 var(--sp-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-secondary);
  background: var(--bg-surface);
  transition:
    border-color var(--duration-fast) var(--ease),
    background var(--duration-fast) var(--ease),
    color var(--duration-fast) var(--ease);
}
.page-btn:hover:not(:disabled) {
  border-color: var(--accent);
  background: var(--accent-light);
  color: var(--accent);
}
.page-btn--active {
  border-color: var(--accent);
  background: var(--accent);
  color: #fff;
  font-weight: 600;
}
.page-btn--active:hover { background: var(--accent-hover); }

.page-btn--arrow { color: var(--text-muted); }
.page-btn:disabled { opacity: 0.35; cursor: not-allowed; }

.page-ellipsis {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 32px;
  font-size: 0.875rem;
  color: var(--text-muted);
  user-select: none;
}

/* ── Empty row ──────────────────────────────────────────────────────────── */

.empty-row td {
  text-align: center;
  padding: 80px var(--sp-4);
  color: var(--text-muted);
}
.empty-row td p { margin-top: var(--sp-3); font-size: 0.875rem; }
</style>
