import type { Task } from './types'

// Today is 2026-06-17 — dates before this are "in the past"

export const mockTasks: Task[] = [
  // ── OVERDUE #1 ── todo / high / dueDate past ─────────────────────────────
  {
    id: 'task-001',
    title: 'Implement OAuth2 login flow',
    description:
      'Add Google and GitHub OAuth2 providers using Supabase Auth. Include redirect handling, PKCE flow, and persistent session tokens. Coordinate with backend on allowed redirect URIs.',
    priority: 'high',
    dueDate: '2026-05-15',
    assignees: ['Sarah Chen', 'Marcus Williams'],
    status: 'todo',
    tags: ['auth', 'backend', 'security'],
    createdAt: '2026-04-01T09:00:00.000Z',
  },

  // ── OVERDUE #2 ── in-progress / high / dueDate past ──────────────────────
  {
    id: 'task-002',
    title: 'Fix race condition in payment processor',
    description:
      'Concurrent Stripe webhook events are producing duplicate transaction records. Add idempotency keys at the webhook handler level and introduce an optimistic lock on the invoices table.',
    priority: 'high',
    dueDate: '2026-06-10',
    assignees: ['Marcus Williams'],
    status: 'in-progress',
    tags: ['backend', 'blocked', 'payments'],
    createdAt: '2026-05-15T10:00:00.000Z',
  },

  // ── OVERDUE #3 ── todo / high / dueDate past ─────────────────────────────
  {
    id: 'task-003',
    title: 'Database migration: add audit trail tables',
    description:
      'Schema migration to introduce audit_events with indexed columns on (user_id, resource_type, created_at). Required for upcoming SOC 2 compliance review. Do not run during business hours.',
    priority: 'high',
    dueDate: '2026-06-05',
    assignees: ['Sarah Chen'],
    status: 'todo',
    tags: ['backend', 'database', 'compliance'],
    createdAt: '2026-05-10T14:00:00.000Z',
  },

  // ── In Progress ───────────────────────────────────────────────────────────
  {
    id: 'task-004',
    title: 'Write unit tests for UserService',
    description:
      'Achieve ≥ 80% branch coverage for UserService. Focus on plan upgrade/downgrade edge cases and seat-limit enforcement. Mock the billing gateway, not the DB.',
    priority: 'medium',
    dueDate: '2026-06-28',
    assignees: ['Jake Morrison'],
    status: 'in-progress',
    tags: ['testing', 'backend'],
    createdAt: '2026-05-22T11:00:00.000Z',
  },
  {
    id: 'task-005',
    title: 'CSV export for analytics dashboard',
    description:
      'Allow workspace admins to export filtered report data as CSV. Use streaming response to handle large result sets without OOM. Show a progress bar during generation.',
    priority: 'low',
    dueDate: '2026-07-15',
    assignees: ['Elena Rodriguez'],
    status: 'in-progress',
    tags: ['feature', 'reporting'],
    createdAt: '2026-06-01T09:30:00.000Z',
  },
  {
    id: 'task-006',
    title: 'Onboarding flow redesign',
    description:
      'Redesign the 5-step wizard based on Maze usability tests. Drop-off at step 3 (team invite) is 62%. Proposed fix: make invite optional and surface it post-activation instead.',
    priority: 'high',
    dueDate: '2026-07-20',
    assignees: ['Priya Sharma', 'Elena Rodriguez'],
    status: 'in-progress',
    tags: ['ux', 'onboarding'],
    createdAt: '2026-05-28T10:00:00.000Z',
  },
  {
    id: 'task-007',
    title: 'Optimize dashboard aggregation queries',
    description:
      'P95 latency for the main dashboard is 4.2 s on workspaces with 10 k+ records. Introduce a materialized view refreshed every 5 min and add Redis caching for the top-level counts.',
    priority: 'medium',
    dueDate: '2026-07-05',
    assignees: ['Marcus Williams'],
    status: 'in-progress',
    tags: ['backend', 'performance'],
    createdAt: '2026-06-08T14:00:00.000Z',
  },

  // ── Todo ──────────────────────────────────────────────────────────────────
  {
    id: 'task-008',
    title: 'Design system: update button variants',
    description:
      "Align primary, secondary, ghost, and destructive button styles with v2 of the Figma component library. Run a codebase-wide find-and-replace on deprecated class names once the new tokens land.",
    priority: 'medium',
    dueDate: '2026-07-01',
    assignees: ['Priya Sharma'],
    status: 'todo',
    tags: ['ux', 'design-system'],
    createdAt: '2026-05-20T08:30:00.000Z',
  },
  {
    id: 'task-009',
    title: 'Fix timezone offset bug in date pickers',
    description:
      "Due dates display one day earlier for users in UTC-5 and west. Root cause: parsing ISO strings without a timezone offset. Replace Date constructor with date-fns parseISO throughout.",
    priority: 'medium',
    dueDate: '2026-07-10',
    assignees: ['Jake Morrison'],
    status: 'todo',
    tags: ['bug', 'ux'],
    createdAt: '2026-06-05T16:00:00.000Z',
  },
  {
    id: 'task-010',
    title: 'RTL layout support for Arabic locale',
    description:
      'Add direction-aware CSS using logical properties (margin-inline-start instead of margin-left). Source Arabic translation strings from the Localazy project and wire up the locale switcher.',
    priority: 'low',
    dueDate: '2026-08-01',
    assignees: ['Elena Rodriguez'],
    status: 'todo',
    tags: ['i18n', 'feature'],
    createdAt: '2026-06-10T11:00:00.000Z',
  },
  {
    id: 'task-011',
    title: 'Spike: evaluate Drizzle ORM migration',
    description:
      'Prototype swapping the current Knex layer for Drizzle on the users module. Measure type-safety wins, migration ergonomics, and whether RLS policies survive the change.',
    priority: 'low',
    dueDate: '2026-07-25',
    assignees: ['Sarah Chen'],
    status: 'todo',
    tags: ['backend', 'research'],
    createdAt: '2026-06-12T13:00:00.000Z',
  },

  // ── Done ──────────────────────────────────────────────────────────────────
  {
    id: 'task-012',
    title: 'Set up CI/CD pipeline',
    description:
      'Configure GitHub Actions with jobs for type-check, lint, unit tests, and Vercel preview deployments on every PR. Add a required status check before merge to main.',
    priority: 'high',
    dueDate: '2026-05-30',
    assignees: ['Jake Morrison', 'Marcus Williams'],
    status: 'done',
    tags: ['devops', 'infrastructure'],
    createdAt: '2026-04-15T08:00:00.000Z',
  },
  {
    id: 'task-013',
    title: 'API rate limiting implementation',
    description:
      'Sliding-window rate limiting per workspace using Redis. Tiered limits by plan: 50 req/min (free), 500 req/min (pro), 2000 req/min (enterprise). Return 429 with Retry-After header.',
    priority: 'medium',
    dueDate: '2026-06-01',
    assignees: ['Marcus Williams'],
    status: 'done',
    tags: ['backend', 'security'],
    createdAt: '2026-04-20T09:00:00.000Z',
  },
  {
    id: 'task-014',
    title: 'Refactor legacy auth middleware',
    description:
      'Replace session-cookie middleware with the new JWT validation layer. Dual-run both systems behind a feature flag for two weeks before cutting over. Update integration tests.',
    priority: 'low',
    dueDate: '2026-06-15',
    assignees: ['Priya Sharma'],
    status: 'done',
    tags: ['backend', 'refactor', 'auth'],
    createdAt: '2026-05-01T13:00:00.000Z',
  },
]

/*
  Constraint checklist — verified against 2026-06-17 as "today":
  ✅  14 tasks (≥ 10)
  ✅  Statuses: todo (6), in-progress (5), done (3)
  ✅  Priorities:
       high:   001, 002, 003, 006, 012 = 5 (≥ 3)
       medium: 004, 007, 008, 009, 013 = 5 (≥ 3)
       low:    005, 010, 011, 014      = 4 (≥ 3)
  ✅  Overdue (dueDate < 2026-06-17, status ≠ done):
       001 (2026-05-15, todo), 002 (2026-06-10, in-progress), 003 (2026-06-05, todo) = 3
  ✅  Distinct assignees: Sarah Chen, Marcus Williams, Jake Morrison, Elena Rodriguez, Priya Sharma = 5 (≥ 4)
  ✅  Realistic titles/descriptions reflecting a real SaaS product backlog
  ✅  Tags on all 14 tasks (≥ 6)
  ✅  Multi-assignee tasks: 001, 006, 012 demonstrate the feature
*/
