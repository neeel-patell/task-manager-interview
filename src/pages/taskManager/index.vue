<script setup lang="ts">
import { ref } from 'vue'
import { TaskManager } from '../../BLL/taskManager/TaskManager'
import type { Task, ViewMode, TaskStatus } from '../../BLL/taskManager/types'
import KanbanBoard from '../../components/taskManager/KanbanBoard.vue'
import ListView from '../../components/taskManager/ListView.vue'
import ViewToggle from '../../components/taskManager/ViewToggle.vue'
import TaskModal from '../../components/taskManager/TaskModal.vue'

// ── Single TaskManager instance — the only place it is ever created ──────────
const manager = new TaskManager()

// ── View mode (persisted in localStorage) ───────────────────────────────────
const VIEW_KEY = 'tm-view-mode'

const viewMode = ref<ViewMode>(
  (localStorage.getItem(VIEW_KEY) as ViewMode | null) ?? 'kanban',
)

function setViewMode(mode: ViewMode): void {
  viewMode.value = mode
  localStorage.setItem(VIEW_KEY, mode)
}

// ── Modal state ──────────────────────────────────────────────────────────────
const modalOpen = ref(false)
const editingTask = ref<Task | undefined>(undefined)
const modalDefaultStatus = ref<TaskStatus>('todo')

function openCreateModal(status: TaskStatus = 'todo'): void {
  editingTask.value = undefined
  modalDefaultStatus.value = status
  modalOpen.value = true
}

function openEditModal(task: Task): void {
  editingTask.value = task
  modalOpen.value = true
}

function closeModal(): void {
  modalOpen.value = false
  editingTask.value = undefined
}

// ── Delete confirmation ──────────────────────────────────────────────────────
const deleteTarget = ref<Task | null>(null)

function requestDelete(taskId: string): void {
  const task = manager.tasks.find((t) => t.id === taskId)
  if (task) deleteTarget.value = task
}

function confirmDelete(): void {
  if (deleteTarget.value) {
    manager.deleteTask(deleteTarget.value.id)
    deleteTarget.value = null
  }
}

function cancelDelete(): void {
  deleteTarget.value = null
}
</script>

<template>
  <div class="page">
    <!-- ── App header ──────────────────────────────────────────────────── -->
    <header
      v-motion
      :initial="{ opacity: 0, y: -16 }"
      :enter="{ opacity: 1, y: 0, transition: { duration: 380, easing: 'easeOutExpo' } }"
      class="app-header"
    >
      <div class="header-inner">
        <div class="header-brand">
          <div class="brand-logo" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="2" y="2" width="7" height="7" rx="1.5" fill="#fff" opacity="0.9"/>
              <rect x="11" y="2" width="7" height="7" rx="1.5" fill="#fff" opacity="0.5"/>
              <rect x="2" y="11" width="7" height="7" rx="1.5" fill="#fff" opacity="0.5"/>
              <rect x="11" y="11" width="7" height="7" rx="1.5" fill="#fff" opacity="0.9"/>
            </svg>
          </div>
          <div class="brand-text">
            <h1 class="page-title">Task Manager</h1>
            <p class="page-subtitle">Personal workspace</p>
          </div>
        </div>
        <div class="header-controls">
          <ViewToggle :model-value="viewMode" @update:model-value="setViewMode" />
          <button class="btn-new-task" @click="openCreateModal()">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
            </svg>
            Create
          </button>
        </div>
      </div>
    </header>

    <!-- ── Main content ────────────────────────────────────────────────── -->
    <main
      v-motion
      :initial="{ opacity: 0 }"
      :enter="{ opacity: 1, transition: { duration: 300, delay: 120 } }"
      class="app-main"
    >
      <KanbanBoard
        v-if="viewMode === 'kanban'"
        :manager="manager"
        @edit="openEditModal"
        @delete="requestDelete"
        @create="openCreateModal"
      />
      <ListView
        v-else
        :manager="manager"
        @edit="openEditModal"
        @delete="requestDelete"
      />
    </main>

    <!-- ── Task modal (create / edit) ─────────────────────────────────── -->
    <TaskModal
      v-if="modalOpen"
      :manager="manager"
      :task="editingTask"
      :default-status="modalDefaultStatus"
      @close="closeModal"
    />

    <!-- ── Delete confirmation dialog ─────────────────────────────────── -->
    <Teleport to="body">
      <Transition name="overlay">
        <div
          v-if="deleteTarget"
          class="overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          @click.self="cancelDelete"
        >
          <div class="confirm-dialog">
            <h3 id="confirm-title" class="confirm-title">Delete task?</h3>
            <p class="confirm-body">
              <strong>{{ deleteTarget.title }}</strong> will be permanently removed and
              cannot be recovered.
            </p>
            <div class="confirm-actions">
              <button class="btn-secondary" @click="cancelDelete">Cancel</button>
              <button class="btn-danger" @click="confirmDelete">Delete</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

/* ── Header ─────────────────────────────────────────────────────────────── */

.app-header {
  position: sticky;
  top: 0;
  z-index: 50;
  background: #4338CA;
  border-bottom: 1px solid #3730A3;
  box-shadow: 0 2px 4px 0 rgba(9, 30, 66, 0.20);
}

.header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--sp-3) var(--sp-5);
  max-width: 1600px;
  margin: 0 auto;
  width: 100%;
}

.header-brand {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
}

.brand-logo {
  width: 36px;
  height: 36px;
  background: #3730A3;
  border: 1px solid #312E81;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.brand-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.page-title {
  font-size: 1.5rem;   /* spec: 24px / 1.5rem / 700 */
  font-weight: 700;
  color: #fff;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.page-subtitle {
  font-size: 0.6875rem;
  color: rgba(255, 255, 255, 0.65);
  font-weight: 400;
  line-height: 1;
}

.header-controls {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
}

.btn-new-task {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  padding: 7px var(--sp-4);
  background: #fff;
  color: #4338CA;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 700;
  border: 1px solid #fff;
  transition: background var(--duration-fast) var(--ease), color var(--duration-fast) var(--ease);
  white-space: nowrap;
}
.btn-new-task:hover {
  background: #EEF2FF;
  color: #3730A3;
}

/* ── Main ───────────────────────────────────────────────────────────────── */

.app-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ── Delete confirm dialog ──────────────────────────────────────────────── */

.overlay {
  position: fixed;
  inset: 0;
  background: var(--bg-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.confirm-dialog {
  background: var(--bg-surface);
  border-radius: var(--radius-lg);
  padding: var(--sp-6);
  width: 400px;
  box-shadow: var(--shadow-xl);
}

.confirm-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: var(--sp-2);
}

.confirm-body {
  font-size: 0.875rem;
  color: var(--text-secondary);
  line-height: 1.5;
  margin-bottom: var(--sp-6);
}

.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--sp-3);
}

/* ── Overlay transition ─────────────────────────────────────────────────── */

.overlay-enter-active,
.overlay-leave-active {
  transition: opacity var(--duration-normal) var(--ease);
}
.overlay-enter-from,
.overlay-leave-to {
  opacity: 0;
}
</style>
