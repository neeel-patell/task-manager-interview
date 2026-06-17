# Task Manager — SpectroNova Take-Home Assessment

## Branch structure

| Branch | Purpose |
|---|---|
| `task-manager-as-per-interview` | **This branch** — original submission, feature-complete v1 |
| `limitations-resolved` | All known v1 limitations resolved (see Known limitations table) |
| `main` | Merge of both branches — full history |

> **Live demo:** this branch is served at `/` on the deployed app. The `limitations-resolved` improvements are at `/v2`.

---

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
    ├── KanbanBoard.vue                  ← dynamic columns, filter toolbar, drag-expand drop zone
    │   └── KanbanColumn.vue (×N)        ← drop zone, TransitionGroup, empty state, status dot
    │       └── TaskCard.vue (×N)        ← draggable, priority strip, avatar stack
    ├── ListView.vue                     ← flat table with toolbar (sort + filter, all tasks shown)
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
| `getFilteredByStatus` | Called inside a `computed()` in `KanbanColumn`; re-evaluates on any tasks change |

---

## Design decisions

### 1. `ITaskManager` interface instead of importing the class in `types.ts`

**Chose**: Define a structural interface in `types.ts` that mirrors every public method, and have `TaskManager` implement it.  
**Why**: Importing the class in `types.ts` creates a circular ES module chain (`types → TaskManager → types`). Using an interface keeps `types.ts` free of runtime imports; the circular dependency exists only at type-check time, which TypeScript handles via `import type`.  
**With more time**: Generate the interface automatically using TypeScript's mapped types so it can't drift from the class definition.

### 2. Drag-and-drop via native HTML5 API

**Chose**: `draggable="true"` on cards, `dragstart` / `dragover.prevent` / `drop` on columns. `DataTransfer.setData('text/plain', taskId)` carries the payload; `moveTo` on drop. Dropping a card onto the "Add another board" widget auto-creates a new column and moves the card there — the widget expands into a visible drop zone while dragging.  
**Why**: Zero library overhead; the HTML5 DnD API is sufficient for a single-board task manager.  
**With more time**: Custom ghost image via `setDragImage`, mobile touch support via Pointer Events.

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

Items marked **Resolved in limitations-resolved** are addressed in the `limitations-resolved` branch (accessible at `/v2` on the live demo).

| Area | Detail | Status |
|---|---|---|
| Dribbble reference | Not provided — design is built from the spec's typography table and design rules only. All colours are driven by CSS custom properties; a single `:root` update propagates globally once the reference arrives. | Open |
| `TaskStatus` widened | Changed from literal union to `string` to support user-created boards. Core statuses are protected at the business-logic layer. | By design |
| `assignees: string[]` | Extended from single `assignee: string`. A `migrateTasks()` helper converts existing records on load. | By design |
| Due-date validation on edit | Editing an overdue task's title while the date stays past blocks the save — spec-compliant but creates friction. | Resolved in `limitations-resolved` |
| No keyboard drag-and-drop | Native HTML5 DnD has no keyboard path. Column can be changed via the Edit modal as a workaround. | Resolved in `limitations-resolved` |
| No mobile layout | Spec requires 1280 px minimum width; mobile breakpoints are not implemented. | Resolved in `limitations-resolved` |
| No pagination | List view renders all tasks at once. Fine for the mock dataset; would need pagination for large datasets. | Resolved in `limitations-resolved` |
| Inter font via CDN | Adds one external network request on every page load. | Resolved in `limitations-resolved` |
| No test suite | Assessment scope did not specify tests. Unit tests for `TaskManager` would be the first addition. | Resolved in `limitations-resolved` |

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
