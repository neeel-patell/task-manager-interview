<script setup lang="ts">
import { computed, ref } from 'vue'
import type { TaskCardProps, TaskCardEmitEvents } from '../../BLL/taskManager/types'
import { getAvatarColor, getInitials } from '../../BLL/taskManager/TaskManager'

const props = defineProps<TaskCardProps>()
const emit = defineEmits<TaskCardEmitEvents>()

const isOverdue = computed<boolean>(() => props.manager.isOverdue(props.task))

interface AvatarItem { name: string; color: string; initials: string }

const avatarList = computed<AvatarItem[]>(() =>
  props.task.assignees.slice(0, 3).map((name) => ({
    name,
    color: getAvatarColor(name),
    initials: getInitials(name),
  })),
)

const overflowCount = computed<number>(() => Math.max(0, props.task.assignees.length - 3))

const formattedDueDate = computed<string>(() =>
  new Date(props.task.dueDate + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  }),
)

// ── Drag-and-drop ──────────────────────────────────────────────────────────

const isDragging = ref(false)

function onDragStart(event: DragEvent): void {
  if (!event.dataTransfer) return
  event.dataTransfer.setData('text/plain', props.task.id)
  event.dataTransfer.effectAllowed = 'move'
  isDragging.value = true
}

function onDragEnd(): void {
  isDragging.value = false
}
</script>

<template>
  <article
    class="card"
    :class="[`card--${props.task.priority}`, { 'card--dragging': isDragging }]"
    draggable="true"
    @dragstart="onDragStart"
    @dragend="onDragEnd"
    @click="emit('edit', props.task)"
  >
    <!-- Priority colour strip (Trello-style label bar at top) -->
    <div class="priority-strip" :class="`strip--${props.task.priority}`" />

<!-- Quick actions (visible on hover) -->
    <div class="card-actions" @click.stop>
      <button class="action-btn" title="Edit task" @click.stop="emit('edit', props.task)">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M8.5 1.5L10.5 3.5L3.5 10.5H1.5V8.5L8.5 1.5Z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
        </svg>
      </button>
      <button class="action-btn action-btn--delete" title="Delete task" @click.stop="emit('delete', props.task.id)">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M1.5 3h9M4.5 3V2h3v1M5 5v4M7 5v4M2.5 3l.5 6.5h6L10 3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>

    <!-- Card content -->
    <div class="card-body">
      <!-- Tag chips -->
      <div v-if="props.task.tags.length > 0" class="card-tags">
        <span v-for="tag in props.task.tags.slice(0, 3)" :key="tag" class="tag">{{ tag }}</span>
        <span v-if="props.task.tags.length > 3" class="tag tag--more">+{{ props.task.tags.length - 3 }}</span>
      </div>

      <!-- Title -->
      <h3 class="card-title">{{ props.task.title }}</h3>

      <!-- Description -->
      <p v-if="props.task.description" class="card-desc">{{ props.task.description }}</p>

      <!-- Footer: due date + priority badge + avatars -->
      <div class="card-footer">
        <div class="card-footer-left">
          <!-- Due date -->
          <span class="due-date" :class="{ 'due-date--overdue': isOverdue }">
            <svg
              v-if="isOverdue"
              width="11" height="11" viewBox="0 0 12 12" fill="none" aria-label="Overdue"
            >
              <path d="M6 1L11 10H1L6 1Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
              <path d="M6 5v2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
              <circle cx="6" cy="9" r="0.55" fill="currentColor"/>
            </svg>
            <svg
              v-else
              width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true"
            >
              <rect x="1" y="2" width="10" height="9" rx="1.5" stroke="currentColor" stroke-width="1.3"/>
              <path d="M1 5h10" stroke="currentColor" stroke-width="1.3"/>
              <path d="M4 1v2M8 1v2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
            </svg>
            {{ formattedDueDate }}
          </span>

          <!-- Priority badge -->
          <span class="priority-badge" :class="`priority--${props.task.priority}`">
            {{ props.task.priority }}
          </span>
        </div>

        <!-- Assignee avatars (stacked) -->
        <div class="avatar-stack" aria-label="Assignees">
          <div
            v-for="av in avatarList"
            :key="av.name"
            class="avatar"
            :style="{ background: av.color }"
            :title="av.name"
          >{{ av.initials }}</div>
          <div
            v-if="overflowCount > 0"
            class="avatar avatar--overflow"
            :title="`+${overflowCount} more`"
          >+{{ overflowCount }}</div>
        </div>
      </div>
    </div>
  </article>
</template>

<style scoped>
/* ── Card shell ─────────────────────────────────────────────────────────── */

.card {
  position: relative;
  background: var(--bg-surface);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-card);
  cursor: pointer;
  transition:
    box-shadow var(--duration-normal) var(--ease-out-expo),
    transform var(--duration-normal) var(--ease-spring);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  user-select: none;
  will-change: transform;
}

.card:hover {
  box-shadow: var(--shadow-card-hover);
  transform: translateY(-3px) scale(1.01);
}

.card:active {
  cursor: grabbing;
  transform: scale(0.97) translateY(0);
  box-shadow: var(--shadow-card);
  transition-duration: 80ms;
}

.card--dragging {
  opacity: 0.45;
  cursor: grabbing;
  transform: rotate(3deg) scale(0.95);
  box-shadow: var(--shadow-xl);
  transition: none;
}

/* ── Priority strip (Trello-style top label band) ───────────────────────── */

.priority-strip {
  height: 3px;
  border-radius: var(--radius-md) var(--radius-md) 0 0;
  flex-shrink: 0;
}
.strip--high   { background: var(--priority-high-fg); }
.strip--medium { background: var(--priority-medium-fg); }
.strip--low    { background: var(--priority-low-fg); }


/* ── Quick action overlay (top-right, on hover) ─────────────────────────── */

.card-actions {
  position: absolute;
  top: var(--sp-2);
  right: var(--sp-2);
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease);
  z-index: 2;
}

.card:hover .card-actions { opacity: 1; }

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: var(--radius-sm);
  background: var(--bg-surface);
  color: var(--text-muted);
  box-shadow: var(--shadow-sm);
  transition:
    color var(--duration-fast) var(--ease),
    background var(--duration-fast) var(--ease);
}
.action-btn:hover { color: var(--accent); background: var(--accent-light); }
.action-btn--delete:hover { color: var(--danger); background: var(--danger-light); }

/* ── Card body ──────────────────────────────────────────────────────────── */

.card-body {
  padding: var(--sp-3);
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}

/* ── Tags ───────────────────────────────────────────────────────────────── */

.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-1);
}

.tag {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--text-secondary);
  background: var(--bg-column);
  border-radius: var(--radius-sm);
  padding: 1px 6px;
  white-space: nowrap;
}
.tag--more { color: var(--text-muted); }

/* ── Title ──────────────────────────────────────────────────────────────── */

.card-title {
  font-size: 0.875rem;   /* spec: 14px / 0.875rem / 600 */
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;  /* spec: truncate at 1 line */
}

/* ── Description ────────────────────────────────────────────────────────── */

.card-desc {
  font-size: 0.75rem;
  color: var(--text-secondary);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ── Footer ─────────────────────────────────────────────────────────────── */

.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-2);
  margin-top: var(--sp-1);
}

.card-footer-left {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  flex-wrap: wrap;
}

/* ── Due date ───────────────────────────────────────────────────────────── */

.due-date {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 0.6875rem;  /* spec: 11px / 0.68rem / 400 meta label */
  font-weight: 400;
  color: var(--text-muted);
  background: var(--bg-column);
  border-radius: var(--radius-sm);
  padding: 2px 6px;
  white-space: nowrap;
}

.due-date--overdue {
  color: var(--priority-high-fg);
  background: var(--priority-high-bg);
  font-weight: 600;
}

/* ── Priority badge ─────────────────────────────────────────────────────── */

.priority-badge {
  font-size: 0.6875rem;  /* spec: 11px / 0.68rem / 600 */
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
}
.priority--high   { color: var(--priority-high-fg);   background: var(--priority-high-bg); }
.priority--medium { color: var(--priority-medium-fg); background: var(--priority-medium-bg); }
.priority--low    { color: var(--priority-low-fg);    background: var(--priority-low-bg); }

/* ── Assignee avatar stack ──────────────────────────────────────────────── */

.avatar-stack {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.avatar {
  width: 22px;
  height: 22px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.5625rem;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
  border: 2px solid var(--bg-surface);
  letter-spacing: 0.02em;
}

.avatar-stack .avatar:not(:first-child) { margin-left: -6px; }

.avatar--overflow {
  background: var(--bg-column) !important;
  color: var(--text-secondary);
  border-color: var(--bg-surface);
  font-size: 0.5rem;
}
</style>
