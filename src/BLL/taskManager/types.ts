// ─────────────────────────────────────────────────────────────────────────────
// Core domain types
// ─────────────────────────────────────────────────────────────────────────────

// TaskStatus is now open-ended so users can add custom columns (boards).
// The three default slugs ('todo', 'in-progress', 'done') are still the
// canonical starting point; TypeScript enforces string, not a fixed union.
export type TaskStatus = string
export type TaskPriority = 'low' | 'medium' | 'high'
export type ViewMode = 'kanban' | 'list'
export type SortField = 'dueDate' | 'priority'
export type SortDirection = 'asc' | 'desc'

export interface Task {
  id: string
  title: string
  description: string
  priority: TaskPriority
  dueDate: string       // ISO date string (YYYY-MM-DD)
  assignees: string[]   // one or more team members
  status: TaskStatus
  tags: string[]
  createdAt: string     // ISO datetime string
}

export interface SortState {
  field: SortField
  direction: SortDirection
}

export interface FilterState {
  priority: TaskPriority | null
  assignee: string | null
  search: string
}

// status stores the human-readable label typed by the user in the form
// (e.g. "In Progress"). It is normalised to a slug on save.
export interface TaskFormState {
  title: string
  description: string
  priority: TaskPriority
  dueDate: string
  assignees: string[]   // chip multi-select; at least one required
  statusLabel: string   // display label — normalised to slug on submit
  tags: string[]        // selected tag array; chip multi-select in the UI
}

export interface TaskFormErrors {
  title?: string
  dueDate?: string
  assignees?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// ITaskManager — describes the full public API surface consumed by components.
// ─────────────────────────────────────────────────────────────────────────────

export interface ITaskManager {
  readonly tasks: Task[]
  readonly statuses: string[]                       // reactive ordered status list
  readonly members: string[]                        // managed pool of team members
  getTasksByStatus(status: TaskStatus): Task[]
  getFilteredByStatus(status: TaskStatus, filter: FilterState): Task[]
  moveTo(taskId: string, newStatus: TaskStatus): void
  createTask(data: Omit<Task, 'id' | 'createdAt'>): void
  updateTask(taskId: string, data: Partial<Omit<Task, 'id' | 'createdAt'>>): void
  deleteTask(taskId: string): void
  addStatus(slug: string): void                     // add a new board/column
  removeStatus(slug: string): void                  // remove board; tasks migrate to first remaining
  renameStatus(slug: string, label: string): void   // store a custom display label for a board
  getStatusLabel(slug: string): string              // custom label → auto-formatted fallback
  resolveStatus(input: string): string              // typed label/slug → authoritative slug
  addMember(name: string): void                     // add a team member to the pool
  removeMember(name: string): void                  // remove from pool; tasks keep existing assignees
  filterByPriority(tasks: Task[], priority: TaskPriority | null): Task[]
  filterByAssignee(tasks: Task[], assignee: string | null): Task[]
  filterAndSort(filter: FilterState, sort: SortState): Task[]
  getAssignees(): string[]
  isOverdue(task: Task): boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Component prop interfaces
// ─────────────────────────────────────────────────────────────────────────────

export interface KanbanBoardProps {
  manager: ITaskManager
}

export interface KanbanColumnProps {
  manager: ITaskManager
  status: TaskStatus
  label: string          // pre-formatted display label supplied by KanbanBoard
  filterState?: FilterState
}

export interface TaskCardProps {
  task: Task
  manager: ITaskManager
}

export interface ListViewProps {
  manager: ITaskManager
  paginated?: boolean
}

export interface ViewToggleProps {
  modelValue: ViewMode
}

export interface TaskModalProps {
  manager: ITaskManager
  task?: Task            // undefined → create mode
  defaultStatus?: TaskStatus
}

// ─────────────────────────────────────────────────────────────────────────────
// Emit type definitions
// ─────────────────────────────────────────────────────────────────────────────

export interface TaskCardEmitEvents {
  (e: 'edit', task: Task): void
  (e: 'delete', taskId: string): void
}

export interface KanbanColumnEmitEvents {
  (e: 'edit', task: Task): void
  (e: 'delete', taskId: string): void
  (e: 'create', status: TaskStatus): void
  (e: 'remove', status: TaskStatus): void
  (e: 'rename', status: TaskStatus, label: string): void
}

export interface KanbanBoardEmitEvents {
  (e: 'edit', task: Task): void
  (e: 'delete', taskId: string): void
  (e: 'create', status: TaskStatus): void
}

export interface ListViewEmitEvents {
  (e: 'edit', task: Task): void
  (e: 'delete', taskId: string): void
}

export interface ViewToggleEmitEvents {
  (e: 'update:modelValue', value: ViewMode): void
}

export interface TaskModalEmitEvents {
  (e: 'close'): void
}
