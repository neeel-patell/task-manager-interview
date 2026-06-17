# Task Manager — SpectroNova Take-Home Assessment

## Branch structure

| Branch | Purpose |
|---|---|
| `task-manager-as-per-interview` | Original submission — feature-complete v1 exactly as assessed |
| `limitations-resolved` | All known v1 limitations resolved (see table below) |
| `main` | Merge of both branches — full history of v1 and limitations-resolved |

> **Live demo:** `/` serves v1, `/v2` serves the limitations-resolved build — both routes run from the same dev server and the same Vercel deployment.

---

## Setup

```bash
npm install
npm run dev        # starts at http://localhost:5173
npm run build      # production build
npm run type-check # TypeScript validation
npm run test       # Vitest unit suite (32 tests)
```

Requirements: Node ≥ 18, npm ≥ 9.

> **Note on spec deviations**: Two types in `types.ts` were intentionally widened beyond the spec — `TaskStatus = string` (was a literal union) and `assignees: string[]` (was `assignee: string`). Both are backwards-compatible and documented in the Known Limitations section below.

---

## Architecture overview

### Component hierarchy

```
App.vue  (RouterView)
├── /   → pages/taskManager/index.vue   ← v1 (original submission)
│   ├── ViewToggle.vue                  ← Kanban ↔ List switcher (v-model)
│   ├── KanbanBoard.vue                 ← dynamic columns, filter toolbar, drag-expand drop zone
│   │   └── KanbanColumn.vue (×N)       ← drop zone, TransitionGroup, empty state, status dot
│   │       └── TaskCard.vue (×N)       ← draggable, priority strip, avatar stack, Move-to menu
│   ├── ListView.vue                    ← flat table, sort + filter toolbar
│   │                                     (paginated prop off in v1 — all tasks shown at once)
│   └── TaskModal.vue                   ← create / edit form (Teleported to body)
└── /v2 → pages/v2/index.vue            ← limitations-resolved build
    └── (same component tree; ListView receives :paginated="true" → 10 rows + page bar)
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
| `getFilteredByStatus` | Called inside a `computed()` in `KanbanColumn`; re-evaluates on any tasks change |

---

## Design decisions

### 1. `ITaskManager` interface instead of importing the class in `types.ts`

**Chose**: Define a structural interface in `types.ts` that mirrors every public method, and have `TaskManager` implement it.  
**Why**: Importing the class in `types.ts` creates a circular ES module chain (`types → TaskManager → types`). Using an interface keeps `types.ts` free of runtime imports; the circular dependency exists only at type-check time, which TypeScript handles via `import type`.  
**With more time**: Generate the interface automatically using TypeScript's mapped types so it can't drift from the class definition.

### 2. Drag-and-drop via native HTML5 API

**Chose**: `draggable="true"` on cards, `dragstart` / `dragover.prevent` / `drop` on columns. `DataTransfer.setData('text/plain', taskId)` carries the payload; `moveTo` on drop. The "Add another board" widget is also a drop target — dropping a card onto it auto-creates a new column and moves the card there.  
**Why**: Zero library overhead; the HTML5 DnD API is sufficient for a single-board task manager.  
**With more time**: Custom ghost image via `setDragImage`, mobile touch support via Pointer Events.

### 3. Single-file CSS design-token system

**Chose**: All spacing, colour, shadow, and radius values are CSS custom properties defined in `src/style.css`. Components reference tokens via `var(--priority-high-fg)` etc.  
**Why**: When the Dribbble reference arrives, only the `:root` block needs updating — components are insulated from the colour/spacing change.  
**With more time**: Move tokens to a dedicated `tokens.css`, support dark-mode via `prefers-color-scheme`.

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

| Area | Detail | Status |
|---|---|---|
| Dribbble reference | Not provided — design is built from the spec's typography table and design rules only. All colours are driven by CSS custom properties in `src/style.css`; a single `:root` update propagates globally once the reference arrives. | Open |
| `TaskStatus` widened | Changed from literal union `'todo' \| 'in-progress' \| 'done'` to `string` to support user-created boards. The three core statuses are enforced as protected at the business-logic layer. | By design |
| `assignees: string[]` | Extended from single `assignee: string`. A `migrateTasks()` helper converts existing `{ assignee }` localStorage records to `{ assignees: [...] }` on load. | By design |
| Due-date validation on edit | Spec says "due date not in the past" for both create and edit. In v1, editing an overdue task's title while the date remains past would block the save. | **Fixed in limitations-resolved** — validation only rejects a past date when the date field itself changes |
| No keyboard drag-and-drop | Native HTML5 DnD has no keyboard path. Screen-reader users could only change column via the Edit modal. | **Fixed in limitations-resolved** — "Move to" button on each card opens a keyboard-navigable ARIA menu |
| No mobile layout | Spec requires 1280 px minimum width; mobile breakpoints were not implemented. | **Fixed in limitations-resolved** — responsive CSS added (`@media 768px` / `480px`); `min-width` lowered to 320 px |
| No pagination | List view rendered all tasks at once. | **Fixed in limitations-resolved** — numbered pagination (10 rows/page, `‹ 1 2 … n ›` bar); gated behind a `paginated` prop so v1 route is unaffected |
| Inter font via CDN | Adds one external network request on every page load. | **Fixed in limitations-resolved** — `@fontsource/inter` bundled locally via npm; zero CDN requests |
| No test suite | Assessment scope did not specify tests. | **Fixed in limitations-resolved** — 32 Vitest unit tests covering CRUD, `filterAndSort`, `isOverdue`, `getFilteredByStatus`, member + status management |
| No Kanban filters | Priority/assignee/search filters existed in List view but not on the Kanban board. | **Fixed in limitations-resolved** — filter toolbar above Kanban board shares the same `FilterState` contract |
| Status dot visibility | Column-header status dots used colours too close to the indigo column background (`#6366F1` in-progress on `#EEF2FF` bg). | **Fixed in both branches** — dots updated to violet-700 / emerald-600 / slate-500; size 8 px → 10 px with white ring |
| Add-board drag affordance | Dragging a card gave no visible hint that dropping on the "Add another board" widget creates a new column. | **Fixed in both branches** — widget expands into a tall dashed drop zone showing "Drop here to create a new board" while any card is being dragged |

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
