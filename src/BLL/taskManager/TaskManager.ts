import { ref } from 'vue'
import type { Ref } from 'vue'
import { mockTasks } from './mockData'
import type {
  Task,
  TaskStatus,
  TaskPriority,
  FilterState,
  SortState,
  ITaskManager,
} from './types'

// ─── Presentation helpers ────────────────────────────────────────────────────

const AVATAR_PALETTE: string[] = [
  '#6366F1',
  '#8B5CF6',
  '#EC4899',
  '#EF4444',
  '#F59E0B',
  '#10B981',
  '#06B6D4',
  '#3B82F6',
]

function hashString(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

export function getAvatarColor(name: string): string {
  return AVATAR_PALETTE[hashString(name) % AVATAR_PALETTE.length]
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((word) => word[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

// ─── Status label helpers ─────────────────────────────────────────────────────

// Well-known slugs get hand-crafted labels; everything else is auto-capitalised.
const KNOWN_STATUS_LABELS: Record<string, string> = {
  'todo':        'To Do',
  'in-progress': 'In Progress',
  'done':        'Done',
}

export function formatStatusLabel(slug: string): string {
  return (
    KNOWN_STATUS_LABELS[slug] ??
    slug
      .split(/[-_]+/)
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ''))
      .join(' ')
  )
}

/**
 * Convert a user-typed label back to a slug that matches an existing status
 * or produces a new consistent slug.
 *
 * Priority:
 *   1. Exact slug match (user typed the slug directly)
 *   2. Label match (user picked a formatted label from the datalist)
 *   3. Slugify the input
 */
export function normalizeStatusSlug(input: string, existingStatuses: string[]): string {
  const trimmed = input.trim()
  if (!trimmed) return 'todo'

  // 1 — direct slug hit
  const lc = trimmed.toLowerCase()
  if (existingStatuses.includes(lc)) return lc

  // 2 — label hit (e.g. user selected "In Progress" → matches 'in-progress')
  const byLabel = existingStatuses.find(
    (s) => formatStatusLabel(s).toLowerCase() === trimmed.toLowerCase(),
  )
  if (byLabel) return byLabel

  // 3 — slugify
  return lc.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

// ─── Default status order ─────────────────────────────────────────────────────

const DEFAULT_STATUSES: string[] = ['todo', 'in-progress', 'done']

const LS_TASKS = 'tm-tasks'
const LS_STATUSES = 'tm-statuses'
const LS_STATUS_LABELS = 'tm-status-labels'
const LS_MEMBERS = 'tm-members'

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

// Migrate persisted tasks that still use the legacy single-assignee shape.
type RawTask = Record<string, unknown>
function migrateTasks(raw: RawTask[]): Task[] {
  return raw.map((t) => ({
    ...t,
    assignees: Array.isArray(t['assignees'])
      ? (t['assignees'] as string[])
      : t['assignee']
      ? [t['assignee'] as string]
      : [],
  })) as Task[]
}

// ─────────────────────────────────────────────────────────────────────────────
// TaskManager
// ─────────────────────────────────────────────────────────────────────────────

export class TaskManager implements ITaskManager {
  private readonly _tasks: Ref<Task[]>
  private readonly _statuses: Ref<string[]>
  private readonly _statusLabels: Ref<Record<string, string>>
  private readonly _members: Ref<string[]>

  constructor() {
    // Tasks: restore from localStorage with single-assignee migration; fall back to mock data.
    const savedRaw = loadJSON<RawTask[] | null>(LS_TASKS, null)
    this._tasks = ref<Task[]>(savedRaw ? migrateTasks(savedRaw) : [...mockTasks])

    this._statuses = ref<string[]>(loadJSON<string[]>(LS_STATUSES, [...DEFAULT_STATUSES]))
    this._statusLabels = ref<Record<string, string>>(
      loadJSON<Record<string, string>>(LS_STATUS_LABELS, {}),
    )

    // Member pool: restore or seed from mock assignees.
    const defaultMembers = [...new Set(mockTasks.flatMap((t) => t.assignees))].sort()
    this._members = ref<string[]>(loadJSON<string[]>(LS_MEMBERS, defaultMembers))
  }

  private saveTasks(): void {
    localStorage.setItem(LS_TASKS, JSON.stringify(this._tasks.value))
  }

  private saveStatuses(): void {
    localStorage.setItem(LS_STATUSES, JSON.stringify(this._statuses.value))
  }

  private saveLabels(): void {
    localStorage.setItem(LS_STATUS_LABELS, JSON.stringify(this._statusLabels.value))
  }

  private saveMembers(): void {
    localStorage.setItem(LS_MEMBERS, JSON.stringify(this._members.value))
  }

  // ── Read ──────────────────────────────────────────────────────────────────

  get tasks(): Task[] {
    return this._tasks.value
  }

  get statuses(): string[] {
    return this._statuses.value
  }

  get members(): string[] {
    return this._members.value
  }

  getTasksByStatus(status: TaskStatus): Task[] {
    return this._tasks.value.filter((t) => t.status === status)
  }

  getFilteredByStatus(status: TaskStatus, filter: FilterState): Task[] {
    let result = this._tasks.value.filter((t) => t.status === status)
    result = this.filterByPriority(result, filter.priority)
    result = this.filterByAssignee(result, filter.assignee)
    if (filter.search.trim()) {
      const q = filter.search.toLowerCase()
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.assignees.some((a) => a.toLowerCase().includes(q)) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q)),
      )
    }
    return result
  }

  getAssignees(): string[] {
    return this._members.value
  }

  addMember(name: string): void {
    const trimmed = name.trim()
    if (trimmed && !this._members.value.includes(trimmed)) {
      this._members.value = [...this._members.value, trimmed].sort()
      this.saveMembers()
    }
  }

  removeMember(name: string): void {
    this._members.value = this._members.value.filter((m) => m !== name)
    this.saveMembers()
  }

  isOverdue(task: Task): boolean {
    if (task.status === 'done') return false
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return new Date(task.dueDate) < today
  }

  // ── Status management ─────────────────────────────────────────────────────

  // Core boards that cannot be removed or renamed.
  static readonly PROTECTED = new Set(['todo', 'in-progress', 'done'])

  addStatus(slug: string): void {
    const clean = slug.trim()
    if (clean && !this._statuses.value.includes(clean)) {
      this._statuses.value = [...this._statuses.value, clean]
      this.saveStatuses()
    }
  }

  removeStatus(slug: string): void {
    if (TaskManager.PROTECTED.has(slug)) return          // protect core boards
    const remaining = this._statuses.value.filter((s) => s !== slug)
    if (remaining.length === 0) return
    const fallback = remaining[0]
    this._tasks.value.forEach((t) => {
      if (t.status === slug) t.status = fallback
    })
    this.saveTasks()
    this._statuses.value = remaining
    this.saveStatuses()
    const labels = { ...this._statusLabels.value }
    delete labels[slug]
    this._statusLabels.value = labels
    this.saveLabels()
  }

  getStatusLabel(slug: string): string {
    return this._statusLabels.value[slug] ?? formatStatusLabel(slug)
  }

  renameStatus(slug: string, label: string): void {
    if (TaskManager.PROTECTED.has(slug)) return          // protect core board names
    const trimmed = label.trim()
    if (!trimmed) return
    this._statusLabels.value = { ...this._statusLabels.value, [slug]: trimmed }
    this.saveLabels()
  }

  // Resolves a user-typed string (label or slug) to an authoritative slug.
  // Checks custom labels first so renamed boards match correctly.
  resolveStatus(input: string): string {
    const trimmed = input.trim()
    if (!trimmed) return 'todo'
    const lc = trimmed.toLowerCase()
    // 1 — exact slug
    if (this._statuses.value.includes(lc)) return lc
    // 2 — custom label match
    const byCustom = this._statuses.value.find(
      (s) => (this._statusLabels.value[s] ?? '').toLowerCase() === lc,
    )
    if (byCustom) return byCustom
    // 3 — auto-formatted label match (e.g. "In Progress" → 'in-progress')
    const byFormatted = this._statuses.value.find(
      (s) => formatStatusLabel(s).toLowerCase() === lc,
    )
    if (byFormatted) return byFormatted
    // 4 — slugify the input as a new status
    return lc.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  }

  // ── Filtering / sorting ───────────────────────────────────────────────────

  filterByPriority(tasks: Task[], priority: TaskPriority | null): Task[] {
    if (!priority) return tasks
    return tasks.filter((t) => t.priority === priority)
  }

  filterByAssignee(tasks: Task[], assignee: string | null): Task[] {
    if (!assignee) return tasks
    return tasks.filter((t) => t.assignees.includes(assignee))
  }

  filterAndSort(filter: FilterState, sort: SortState): Task[] {
    let result = [...this._tasks.value]

    result = this.filterByPriority(result, filter.priority)
    result = this.filterByAssignee(result, filter.assignee)

    if (filter.search.trim()) {
      const q = filter.search.toLowerCase()
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.assignees.some((a) => a.toLowerCase().includes(q)) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q)),
      )
    }

    const PRIORITY_ORDER: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 }

    result.sort((a, b) => {
      let diff: number
      if (sort.field === 'dueDate') {
        diff = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      } else {
        diff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
      }
      return sort.direction === 'asc' ? diff : -diff
    })

    return result
  }

  // ── Write ─────────────────────────────────────────────────────────────────

  moveTo(taskId: string, newStatus: TaskStatus): void {
    const task = this._tasks.value.find((t) => t.id === taskId)
    if (task) {
      task.status = newStatus
      this.saveTasks()
    }
  }

  createTask(data: Omit<Task, 'id' | 'createdAt'>): void {
    const task: Task = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    }
    this._tasks.value.push(task)
    this.saveTasks()
  }

  updateTask(taskId: string, data: Partial<Omit<Task, 'id' | 'createdAt'>>): void {
    const index = this._tasks.value.findIndex((t) => t.id === taskId)
    if (index !== -1) {
      this._tasks.value[index] = { ...this._tasks.value[index], ...data }
      this.saveTasks()
    }
  }

  deleteTask(taskId: string): void {
    const index = this._tasks.value.findIndex((t) => t.id === taskId)
    if (index !== -1) {
      this._tasks.value.splice(index, 1)
      this.saveTasks()
    }
  }
}
