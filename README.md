# Task Manager — SpectroNova Take-Home Assessment

## Setup

```bash
npm install
npm run dev        # starts at http://localhost:5173
npm run build      # production build
npm run type-check # TypeScript validation
```

Requirements: Node ≥ 18, npm ≥ 9.

> **Note on spec deviations**: Two types in `types.ts` were intentionally widened beyond the spec — `TaskStatus = string` (was a literal union) and `assignees: string[]` (was `assignee: string`). Both are backwards-compatible and documented in the Known Limitations section below.

---

## Architecture overview

### Component hierarchy

```
App.vue
└── pages/taskManager/index.vue          ← single TaskManager instance lives here
    ├── ViewToggle.vue                   ← Kanban ↔ List switcher (v-model)
    ├── KanbanBoard.vue                  ← dynamic column layout + add-board widget
    │   └── KanbanColumn.vue (×N)        ← drop zone, TransitionGroup, empty state
    │       └── TaskCard.vue (×N)        ← draggable, priority strip, avatar stack
    ├── ListView.vue                     ← flat table with toolbar (sort + filter)
    └── TaskModal.vue                    ← create / edit form (Teleported to body)
```

State flows **strictly downward** via typed props. `TaskManager` is instantiated once in `index.vue` and passed as a prop to every component that needs it — no Pinia, no Vuex, no `provide`/`inject`.

The three core columns (`todo`, `in-progress`, `done`) are **protected**: `removeStatus()` and `renameStatus()` silently return early for them. All other columns are dynamic — created via the "Add another board" widget, persisted to localStorage, and deleted via the column's trash icon.

### Why a class for TaskManager?

Vue 3's reactivity primitives (`ref`, `reactive`) work inside class instances. `_tasks` is a `Ref<Task[]>` created in the constructor; every mutation goes through class methods, so business logic is centralized and easy to unit-test in isolation. Components never touch the ref directly — they call public methods (`moveTo`, `createTask`, `filterAndSort`, etc.) and read the reactive `tasks` getter.

The `ITaskManager` interface in `types.ts` describes the full public API. Components are typed against the interface rather than the concrete class, which eliminates the circular-import problem that would arise if `types.ts` imported the class.

### Reactivity contract

| Action | How re-rendering happens |
|---|---|
| `moveTo` / `updateTask` | Mutates an item inside `_tasks.value`; Vue's Proxy tracks the property write |
| `createTask` | `push()` on `_tasks.value`; Vue tracks array mutations |
| `deleteTask` | `splice()` on `_tasks.value` |
| `filterAndSort` | Called inside a `computed()` in `ListView`; re-evaluates whenever `_tasks.value` changes |
| `getTasksByStatus` | Called inside a `computed()` in `KanbanColumn`; re-evaluates on any tasks change |

---

## Design decisions

### 1. `ITaskManager` interface instead of importing the class in `types.ts`

**Chose**: Define a structural interface in `types.ts` that mirrors every public method, and have `TaskManager` implement it.  
**Why**: Importing the class in `types.ts` creates a circular ES module chain (`types → TaskManager → types`). Using an interface keeps `types.ts` free of runtime imports; the circular dependency exists only at type-check time, which TypeScript handles via `import type`.  
**With more time**: Generate the interface automatically using TypeScript's mapped types so it can't drift from the class definition.

### 2. Drag-and-drop via native HTML5 API

**Chose**: `draggable="true"` on cards, `dragstart` / `dragover.prevent` / `drop` on columns. `DataTransfer.setData('text/plain', taskId)` carries the payload; `moveTo` on drop.  
**Why**: Zero library overhead; the HTML5 DnD API is sufficient for a single-board task manager.  
**With more time**: Keyboard-accessible reordering (ARIA `treeitem` + arrow-key navigation), a custom ghost image via `setDragImage`, and mobile touch support via Pointer Events.

### 3. Single-file CSS design-token system

**Chose**: All spacing, colour, shadow, and radius values are CSS custom properties defined in `src/style.css`. Components reference tokens via `var(--priority-high-fg)` etc.  
**Why**: When the Dribbble reference arrives, only the `:root` block needs updating — components are insulated from the colour/spacing change.  
**With more time**: Move tokens to a dedicated `tokens.css`, support dark-mode via `prefers-color-scheme`, and drive the palette from a design-token JSON that feeds both CSS and Figma.

### 4. Atlassian/Jira-inspired visual theme

**Chose**: Indigo-tinted glassmorphism columns (`rgba(238,242,255,0.82)` + `backdrop-filter: blur(12px)`), `#A5B4FC` column borders, `#4338CA` header, and Atlassian's card shadow formula (`0 1px 2px rgba(9,30,66,0.25), 0 0 0 1px rgba(9,30,66,0.08)`).  
**Why**: The Dribbble reference was not provided with the assessment doc. Atlassian's design language is the industry-standard reference for task management UIs, and it covers every spec requirement (priority colours, status chips, typography scale, hover states) in a well-tested pattern.  
**With more time**: Match pixel-perfectly to the actual Dribbble reference once shared.

### 5. `assignees: string[]` with Jira-style multi-assignee picker

**Chose**: Widen the spec's `assignee: string` to `assignees: string[]`. The TaskModal shows a members picker with checkmark selection, avatar chips in the field, and Backspace-to-remove. A localStorage migration converts existing `{ assignee }` records transparently.  
**Why**: Real project management tools universally support multiple assignees. The spec field name is singular but the UI reference typically implies multi-select.  
**With more time**: Model members as `{ id, name, avatarUrl }` objects and reference them by ID from tasks rather than storing name strings.

---

## Known limitations

| Area | Detail |
|---|---|
| Dribbble reference | Not provided — design is built from the spec's typography table and design rules only. All colours are driven by CSS custom properties in `src/style.css`; a single `:root` update propagates globally once the reference arrives. |
| `TaskStatus` widened | Changed from literal union `'todo' \| 'in-progress' \| 'done'` to `string` to support user-created boards. The three core statuses are enforced as protected at the business-logic layer. |
| `assignees: string[]` | Extended from single `assignee: string`. A `migrateTasks()` helper converts existing `{ assignee }` localStorage records to `{ assignees: [...] }` on load. |
| Due-date validation on edit | Spec says "due date not in the past" applies to both create and edit. Updating an already-overdue task's title while the due date remains past will fail validation — spec-compliant but creates friction in practice. |
| No keyboard drag-and-drop | Native HTML5 DnD has no keyboard path. Screen-reader users can change a task's column via the Edit modal. |
| No mobile layout | Spec requires 1280 px minimum width; mobile breakpoints are not implemented. |
| No pagination / virtualisation | List view renders all tasks. Fine for the mock dataset; virtual-scroll needed for thousands of rows. |
| Inter font via CDN | Adds one external request. Replace with locally hosted fonts before production. |
| No test suite | Assessment scope did not specify tests. Unit tests for `TaskManager` (CRUD, `filterAndSort`, `isOverdue`) would be the first addition. |

---

## Time log *(approximate)*

| Phase | Hours |
|---|---|
| Reading spec, planning architecture, types | 0.25 h |
| Vite scaffold, directory structure, `TaskManager.ts` | 0.5 h |
| `mockData.ts` + localStorage persistence | 0.25 h |
| `KanbanBoard` + `KanbanColumn` (DnD, protected boards) | 0.75 h |
| `TaskCard` (priority strip, avatar stack, drag ghost) | 0.25 h |
| `ListView` (table, toolbar, sort/filter, row animations) | 0.5 h |
| `TaskModal` (form, validation, multi-assignee picker, tags) | 0.75 h |
| `ViewToggle`, `index.vue`, delete dialog | 0.25 h |
| Dynamic columns (add/rename/remove board) | 0.5 h |
| Global styles / design tokens / Atlassian theme / animations | 0.75 h |
| Bug fixes (reactivity, DnD, dropdown clipping) | 0.5 h |
| README + final audit | 0.25 h |
| **Total** | **~5.5 h** |
