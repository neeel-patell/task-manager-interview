import { describe, it, expect, beforeEach } from 'vitest'
import { TaskManager } from '../TaskManager'
import type { FilterState, SortState } from '../types'

// Vitest runs in happy-dom which provides localStorage
// TaskManager loads from localStorage on construction — clear before each test.
beforeEach(() => {
  localStorage.clear()
})

// ── Construction & mock data ──────────────────────────────────────────────────

describe('TaskManager construction', () => {
  it('loads mock data when localStorage is empty', () => {
    const tm = new TaskManager()
    expect(tm.tasks.length).toBeGreaterThanOrEqual(10)
  })

  it('exposes three default statuses', () => {
    const tm = new TaskManager()
    expect(tm.statuses).toContain('todo')
    expect(tm.statuses).toContain('in-progress')
    expect(tm.statuses).toContain('done')
  })

  it('seeds the member pool from mock data', () => {
    const tm = new TaskManager()
    expect(tm.members.length).toBeGreaterThan(0)
  })
})

// ── CRUD ─────────────────────────────────────────────────────────────────────

describe('createTask', () => {
  it('adds a task and persists to localStorage', () => {
    const tm = new TaskManager()
    const before = tm.tasks.length
    tm.createTask({
      title: 'New task',
      description: '',
      priority: 'high',
      dueDate: '2027-01-01',
      assignees: ['Alice'],
      status: 'todo',
      tags: [],
    })
    expect(tm.tasks.length).toBe(before + 1)
    const saved = JSON.parse(localStorage.getItem('tm-tasks') ?? '[]')
    expect(saved.some((t: { title: string }) => t.title === 'New task')).toBe(true)
  })

  it('assigns a unique id and createdAt', () => {
    const tm = new TaskManager()
    tm.createTask({
      title: 'Task A',
      description: '',
      priority: 'low',
      dueDate: '2027-06-01',
      assignees: ['Bob'],
      status: 'todo',
      tags: [],
    })
    const task = tm.tasks.find((t) => t.title === 'Task A')!
    expect(task.id).toBeTruthy()
    expect(task.createdAt).toBeTruthy()
  })
})

describe('updateTask', () => {
  it('updates only the provided fields', () => {
    const tm = new TaskManager()
    const task = tm.tasks[0]
    const originalTitle = task.title
    tm.updateTask(task.id, { priority: 'low' })
    const updated = tm.tasks.find((t) => t.id === task.id)!
    expect(updated.priority).toBe('low')
    expect(updated.title).toBe(originalTitle)
  })

  it('persists the update to localStorage', () => {
    const tm = new TaskManager()
    const task = tm.tasks[0]
    tm.updateTask(task.id, { title: 'Updated title' })
    const saved = JSON.parse(localStorage.getItem('tm-tasks') ?? '[]')
    expect(saved.find((t: { id: string }) => t.id === task.id).title).toBe('Updated title')
  })

  it('does nothing for an unknown id', () => {
    const tm = new TaskManager()
    const before = tm.tasks.length
    tm.updateTask('does-not-exist', { title: 'Ghost' })
    expect(tm.tasks.length).toBe(before)
  })
})

describe('deleteTask', () => {
  it('removes the task', () => {
    const tm = new TaskManager()
    const task = tm.tasks[0]
    const before = tm.tasks.length
    tm.deleteTask(task.id)
    expect(tm.tasks.length).toBe(before - 1)
    expect(tm.tasks.find((t) => t.id === task.id)).toBeUndefined()
  })

  it('persists the deletion', () => {
    const tm = new TaskManager()
    const id = tm.tasks[0].id
    tm.deleteTask(id)
    const saved = JSON.parse(localStorage.getItem('tm-tasks') ?? '[]')
    expect(saved.find((t: { id: string }) => t.id === id)).toBeUndefined()
  })
})

// ── moveTo ────────────────────────────────────────────────────────────────────

describe('moveTo', () => {
  it('moves a task to the target status', () => {
    const tm = new TaskManager()
    const todo = tm.tasks.find((t) => t.status === 'todo')!
    tm.moveTo(todo.id, 'done')
    expect(tm.tasks.find((t) => t.id === todo.id)!.status).toBe('done')
  })

  it('does nothing for an unknown task id', () => {
    const tm = new TaskManager()
    const snapshot = [...tm.tasks.map((t) => t.status)]
    tm.moveTo('ghost-id', 'done')
    expect(tm.tasks.map((t) => t.status)).toEqual(snapshot)
  })
})

// ── Status management ─────────────────────────────────────────────────────────

describe('addStatus / removeStatus / renameStatus', () => {
  it('adds a new status', () => {
    const tm = new TaskManager()
    tm.addStatus('review')
    expect(tm.statuses).toContain('review')
  })

  it('does not add a duplicate status', () => {
    const tm = new TaskManager()
    const before = tm.statuses.length
    tm.addStatus('todo')
    expect(tm.statuses.length).toBe(before)
  })

  it('removes a custom status and migrates tasks to fallback', () => {
    const tm = new TaskManager()
    tm.addStatus('review')
    const task = tm.tasks[0]
    tm.moveTo(task.id, 'review')
    tm.removeStatus('review')
    expect(tm.statuses).not.toContain('review')
    expect(tm.tasks.find((t) => t.id === task.id)!.status).not.toBe('review')
  })

  it('protects core statuses from removal', () => {
    const tm = new TaskManager()
    tm.removeStatus('todo')
    expect(tm.statuses).toContain('todo')
  })

  it('protects core statuses from rename', () => {
    const tm = new TaskManager()
    tm.renameStatus('todo', 'Backlog')
    expect(tm.getStatusLabel('todo')).toBe('To Do')
  })

  it('renames a custom status', () => {
    const tm = new TaskManager()
    tm.addStatus('review')
    tm.renameStatus('review', 'Code Review')
    expect(tm.getStatusLabel('review')).toBe('Code Review')
  })
})

// ── Member management ─────────────────────────────────────────────────────────

describe('addMember / removeMember', () => {
  it('adds a new member', () => {
    const tm = new TaskManager()
    tm.addMember('Charlie Brown')
    expect(tm.members).toContain('Charlie Brown')
  })

  it('does not add a duplicate member', () => {
    const tm = new TaskManager()
    const first = tm.members[0]
    const before = tm.members.length
    tm.addMember(first)
    expect(tm.members.length).toBe(before)
  })

  it('removes a member from the pool', () => {
    const tm = new TaskManager()
    const first = tm.members[0]
    tm.removeMember(first)
    expect(tm.members).not.toContain(first)
  })
})

// ── isOverdue ─────────────────────────────────────────────────────────────────

describe('isOverdue', () => {
  it('returns true for a past-due task not in done', () => {
    const tm = new TaskManager()
    const task = { ...tm.tasks[0], dueDate: '2020-01-01', status: 'todo' }
    expect(tm.isOverdue(task)).toBe(true)
  })

  it('returns false for a done task regardless of date', () => {
    const tm = new TaskManager()
    const task = { ...tm.tasks[0], dueDate: '2020-01-01', status: 'done' }
    expect(tm.isOverdue(task)).toBe(false)
  })

  it('returns false for a future due date', () => {
    const tm = new TaskManager()
    const task = { ...tm.tasks[0], dueDate: '2099-12-31', status: 'todo' }
    expect(tm.isOverdue(task)).toBe(false)
  })
})

// ── filterAndSort ─────────────────────────────────────────────────────────────

describe('filterAndSort', () => {
  const defaultSort: SortState = { field: 'dueDate', direction: 'asc' }
  const emptyFilter: FilterState = { priority: null, assignee: null, search: '' }

  it('returns all tasks with no filter applied', () => {
    const tm = new TaskManager()
    expect(tm.filterAndSort(emptyFilter, defaultSort).length).toBe(tm.tasks.length)
  })

  it('filters by priority', () => {
    const tm = new TaskManager()
    const result = tm.filterAndSort({ ...emptyFilter, priority: 'high' }, defaultSort)
    expect(result.every((t) => t.priority === 'high')).toBe(true)
  })

  it('filters by assignee', () => {
    const tm = new TaskManager()
    const assignee = tm.tasks[0].assignees[0]
    const result = tm.filterAndSort({ ...emptyFilter, assignee }, defaultSort)
    expect(result.every((t) => t.assignees.includes(assignee))).toBe(true)
  })

  it('filters by search text (matches title)', () => {
    const tm = new TaskManager()
    const title = tm.tasks[0].title.slice(0, 5).toLowerCase()
    const result = tm.filterAndSort({ ...emptyFilter, search: title }, defaultSort)
    expect(result.every((t) => t.title.toLowerCase().includes(title))).toBe(true)
  })

  it('sorts by due date ascending', () => {
    const tm = new TaskManager()
    const result = tm.filterAndSort(emptyFilter, { field: 'dueDate', direction: 'asc' })
    for (let i = 1; i < result.length; i++) {
      expect(result[i].dueDate >= result[i - 1].dueDate).toBe(true)
    }
  })

  it('sorts by priority descending (high first)', () => {
    const tm = new TaskManager()
    const result = tm.filterAndSort(emptyFilter, { field: 'priority', direction: 'asc' })
    const order = ['high', 'medium', 'low']
    for (let i = 1; i < result.length; i++) {
      expect(order.indexOf(result[i].priority)).toBeGreaterThanOrEqual(
        order.indexOf(result[i - 1].priority),
      )
    }
  })
})

// ── getFilteredByStatus ───────────────────────────────────────────────────────

describe('getFilteredByStatus', () => {
  it('returns only tasks for the given status', () => {
    const tm = new TaskManager()
    const filter: FilterState = { priority: null, assignee: null, search: '' }
    const result = tm.getFilteredByStatus('todo', filter)
    expect(result.every((t) => t.status === 'todo')).toBe(true)
  })

  it('applies priority filter within a status', () => {
    const tm = new TaskManager()
    const filter: FilterState = { priority: 'high', assignee: null, search: '' }
    const result = tm.getFilteredByStatus('todo', filter)
    expect(result.every((t) => t.status === 'todo' && t.priority === 'high')).toBe(true)
  })
})
