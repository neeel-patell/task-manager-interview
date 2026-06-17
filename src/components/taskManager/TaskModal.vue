<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import type {
  TaskModalProps,
  TaskModalEmitEvents,
  TaskFormState,
  TaskFormErrors,
  TaskPriority,
} from '../../BLL/taskManager/types'
import { getAvatarColor, getInitials } from '../../BLL/taskManager/TaskManager'

const props = defineProps<TaskModalProps>()
const emit = defineEmits<TaskModalEmitEvents>()

const isEditing = computed<boolean>(() => props.task !== undefined)
const modalTitle = computed<string>(() => (isEditing.value ? 'Edit Task' : 'New Task'))

// ── Form state ────────────────────────────────────────────────────────────

function buildInitialState(): TaskFormState {
  if (props.task) {
    return {
      title:       props.task.title,
      description: props.task.description,
      priority:    props.task.priority,
      dueDate:     props.task.dueDate,
      assignees:   [...props.task.assignees],
      statusLabel: props.manager.getStatusLabel(props.task.status),
      tags:        [...props.task.tags],
    }
  }
  return {
    title:       '',
    description: '',
    priority:    'medium',
    dueDate:     '',
    assignees:   [],
    statusLabel: props.manager.getStatusLabel(props.defaultStatus ?? 'todo'),
    tags:        [],
  }
}

const form = ref<TaskFormState>(buildInitialState())
const errors = ref<TaskFormErrors>({})

watch(
  () => props.task,
  () => {
    form.value = buildInitialState()
    errors.value = {}
    statusDropdownOpen.value = false
    assigneesDropdownOpen.value = false
    assigneesInputText.value = ''
  },
)

// ── Auto-focus ────────────────────────────────────────────────────────────

const titleInputRef = ref<HTMLInputElement | null>(null)

onMounted(async () => {
  await nextTick()
  titleInputRef.value?.focus()
})

// ── Status combobox ───────────────────────────────────────────────────────

const statusDropdownOpen = ref(false)

const filteredStatuses = computed<string[]>(() => {
  const q = form.value.statusLabel.trim().toLowerCase()
  if (!q) return props.manager.statuses
  return props.manager.statuses.filter(
    (s) =>
      props.manager.getStatusLabel(s).toLowerCase().includes(q) ||
      s.toLowerCase().includes(q),
  )
})

const isCustomStatus = computed<boolean>(() => {
  const q = form.value.statusLabel.trim().toLowerCase()
  if (!q) return false
  return !props.manager.statuses.some(
    (s) =>
      props.manager.getStatusLabel(s).toLowerCase() === q || s.toLowerCase() === q,
  )
})

function openStatusDropdown(): void {
  statusDropdownOpen.value = true
}

function toggleStatusDropdown(): void {
  statusDropdownOpen.value = !statusDropdownOpen.value
}

function selectStatus(slug: string): void {
  form.value.statusLabel = props.manager.getStatusLabel(slug)
  statusDropdownOpen.value = false
}

function onComboboxFocusOut(event: FocusEvent): void {
  const container = event.currentTarget as HTMLElement
  const related = event.relatedTarget as Node | null
  if (!related || !container.contains(related)) {
    statusDropdownOpen.value = false
  }
}

// ── Assignees chip multi-select ───────────────────────────────────────────

const assigneesInputText = ref('')
const assigneesDropdownOpen = ref(false)
const assigneesInputRef = ref<HTMLInputElement | null>(null)
const assigneesWrapFocused = ref(false)

const filteredMemberSuggestions = computed<string[]>(() => {
  const q = assigneesInputText.value.trim().toLowerCase()
  if (!q) return props.manager.members
  return props.manager.members.filter((m) => m.toLowerCase().includes(q))
})

const showCreateMember = computed<boolean>(() => {
  const q = assigneesInputText.value.trim()
  if (!q) return false
  return !props.manager.members.some((m) => m.toLowerCase() === q.toLowerCase())
})

function isAssigneeSelected(name: string): boolean {
  return form.value.assignees.includes(name)
}

function toggleAssignee(name: string): void {
  const idx = form.value.assignees.indexOf(name)
  if (idx === -1) {
    form.value.assignees.push(name)
  } else {
    form.value.assignees.splice(idx, 1)
  }
  if (errors.value.assignees) errors.value = { ...errors.value, assignees: undefined }
}

function removeAssigneeChip(name: string): void {
  form.value.assignees = form.value.assignees.filter((a) => a !== name)
}

function addCurrentInputAsAssignee(): void {
  const name = assigneesInputText.value.trim()
  if (!name) return
  // Auto-register to pool if new
  if (!props.manager.members.includes(name)) {
    props.manager.addMember(name)
  }
  if (!form.value.assignees.includes(name)) {
    form.value.assignees.push(name)
    if (errors.value.assignees) errors.value = { ...errors.value, assignees: undefined }
  }
  assigneesInputText.value = ''
}

function onAssigneesKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter') {
    event.preventDefault()
    if (assigneesInputText.value.trim()) {
      addCurrentInputAsAssignee()
    } else {
      assigneesDropdownOpen.value = false
    }
  } else if (event.key === 'Backspace' && !assigneesInputText.value) {
    form.value.assignees.pop()
  } else if (event.key === 'Escape') {
    assigneesDropdownOpen.value = false
  }
}

function onAssigneesFocusOut(event: FocusEvent): void {
  const container = event.currentTarget as HTMLElement
  const related = event.relatedTarget as Node | null
  if (!related || !container.contains(related)) {
    if (assigneesInputText.value.trim()) addCurrentInputAsAssignee()
    assigneesDropdownOpen.value = false
    assigneesWrapFocused.value = false
  }
}

function focusAssigneesInput(): void {
  assigneesInputRef.value?.focus()
}

// ── Tags multi-select ─────────────────────────────────────────────────────

const tagsInputText = ref('')
const tagsDropdownOpen = ref(false)
const tagsInputRef = ref<HTMLInputElement | null>(null)
const tagsWrapFocused = ref(false)

// Collect all tags from existing tasks for suggestions.
const allKnownTags = computed<string[]>(() => {
  const set = new Set<string>()
  props.manager.tasks.forEach((t) => t.tags.forEach((tag) => set.add(tag)))
  return [...set].sort()
})

// Show ALL known tags filtered by search text; selected state is shown via checkbox.
const filteredTagSuggestions = computed<string[]>(() => {
  const q = tagsInputText.value.trim().toLowerCase()
  if (!q) return allKnownTags.value
  return allKnownTags.value.filter((t) => t.toLowerCase().includes(q))
})

function isTagSelected(tag: string): boolean {
  return form.value.tags.includes(tag.trim().toLowerCase())
}

// Toggle a tag from the dropdown — does NOT close the dropdown.
function toggleTag(tag: string): void {
  const clean = tag.trim().toLowerCase()
  if (!clean) return
  const idx = form.value.tags.indexOf(clean)
  if (idx === -1) {
    form.value.tags.push(clean)
  } else {
    form.value.tags.splice(idx, 1)
  }
}

// Add the typed text as a new tag (Enter / comma / blur).
function addCurrentInputAsTag(): void {
  const raw = tagsInputText.value.replace(/,$/, '').trim().toLowerCase()
  if (raw && !form.value.tags.includes(raw)) {
    form.value.tags.push(raw)
  }
  tagsInputText.value = ''
}

function removeTag(tag: string): void {
  form.value.tags = form.value.tags.filter((t) => t !== tag)
}

function onTagsKeydown(event: KeyboardEvent): void {
  if (event.key === ',' || event.key === 'Enter') {
    event.preventDefault()
    if (tagsInputText.value.trim()) {
      addCurrentInputAsTag()
    } else {
      tagsDropdownOpen.value = false
    }
  } else if (event.key === 'Backspace' && !tagsInputText.value) {
    form.value.tags.pop()
  } else if (event.key === 'Escape') {
    tagsDropdownOpen.value = false
  }
}

function onTagsFocusOut(event: FocusEvent): void {
  const container = event.currentTarget as HTMLElement
  const related = event.relatedTarget as Node | null
  if (!related || !container.contains(related)) {
    addCurrentInputAsTag()
    tagsDropdownOpen.value = false
    tagsWrapFocused.value = false
  }
}

const tagsFieldRef = ref<HTMLElement | null>(null)

function focusTagsInput(): void {
  tagsInputRef.value?.focus()
}

function openTagsDropdown(): void {
  tagsWrapFocused.value = true
  tagsDropdownOpen.value = true
  nextTick(() => {
    tagsFieldRef.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  })
}

// ── Validation ────────────────────────────────────────────────────────────

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function validate(): boolean {
  const errs: TaskFormErrors = {}

  if (!form.value.title.trim()) {
    errs.title = 'Title is required.'
  }

  if (!form.value.dueDate) {
    errs.dueDate = 'Due date is required.'
  } else {
    const today = todayISO()
    const dateChanged = !isEditing.value || form.value.dueDate !== props.task?.dueDate
    // Only block a past date when creating, or when the user actively changed it to a past date.
    if (dateChanged && form.value.dueDate < today) {
      errs.dueDate = 'Due date cannot be set to a past date.'
    }
  }

  if (form.value.assignees.length === 0) {
    errs.assignees = 'At least one assignee is required.'
  }

  errors.value = errs
  return Object.keys(errs).length === 0
}

function clearError(field: keyof TaskFormErrors): void {
  errors.value = { ...errors.value, [field]: undefined }
}

// ── Submit ────────────────────────────────────────────────────────────────

function submit(): void {
  // Commit any pending tag text before validating
  addCurrentInputAsTag()

  if (!validate()) return

  const statusSlug = props.manager.resolveStatus(form.value.statusLabel)
  if (!props.manager.statuses.includes(statusSlug)) {
    props.manager.addStatus(statusSlug)
  }

  const payload = {
    title:       form.value.title.trim(),
    description: form.value.description.trim(),
    priority:    form.value.priority,
    dueDate:     form.value.dueDate,
    assignees:   form.value.assignees,
    status:      statusSlug,
    tags:        form.value.tags,
  }

  if (isEditing.value && props.task) {
    props.manager.updateTask(props.task.id, payload)
  } else {
    props.manager.createTask(payload)
  }

  emit('close')
}

// ── Options ───────────────────────────────────────────────────────────────

const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high']

// ── Keyboard: Escape closes modal (but not if a dropdown is open) ─────────

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    if (statusDropdownOpen.value || tagsDropdownOpen.value || assigneesDropdownOpen.value) {
      statusDropdownOpen.value = false
      tagsDropdownOpen.value = false
      assigneesDropdownOpen.value = false
    } else {
      emit('close')
    }
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      class="modal-backdrop"
      role="dialog"
      aria-modal="true"
      :aria-label="modalTitle"
      @click.self="emit('close')"
      @keydown="onKeydown"
    >
      <Transition name="modal" appear>
        <div class="modal">
          <!-- Modal header -->
          <div class="modal-header">
            <h2 class="modal-title">{{ modalTitle }}</h2>
            <button class="close-btn" aria-label="Close" @click="emit('close')">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3 3L13 13M13 3L3 13" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
              </svg>
            </button>
          </div>

          <!-- Modal body -->
          <div class="modal-body">
            <!-- Title -->
            <div class="field">
              <label class="field-label" for="task-title">
                Title <span class="required" aria-hidden="true">*</span>
              </label>
              <input
                id="task-title"
                ref="titleInputRef"
                v-model="form.title"
                class="field-input"
                :class="{ 'field-input--error': errors.title }"
                type="text"
                placeholder="e.g. Implement OAuth2 login flow"
                autocomplete="off"
                @input="clearError('title')"
              />
              <p v-if="errors.title" class="field-error" role="alert">{{ errors.title }}</p>
            </div>

            <!-- Description -->
            <div class="field">
              <label class="field-label" for="task-description">Description</label>
              <textarea
                id="task-description"
                v-model="form.description"
                class="field-input field-textarea"
                placeholder="Provide context, acceptance criteria, or links…"
                rows="3"
              />
            </div>

            <!-- Status + Priority row -->
            <div class="field-row">
              <!-- Status — custom combobox -->
              <div class="field">
                <label class="field-label" for="task-status">Status</label>
                <div
                  class="combobox"
                  :class="{ 'combobox--open': statusDropdownOpen }"
                  @focusout="onComboboxFocusOut"
                >
                  <input
                    id="task-status"
                    v-model="form.statusLabel"
                    class="field-input combobox-input"
                    type="text"
                    placeholder="Select or type…"
                    autocomplete="off"
                    role="combobox"
                    :aria-expanded="statusDropdownOpen"
                    aria-haspopup="listbox"
                    @focus="openStatusDropdown"
                    @input="openStatusDropdown"
                    @keydown.escape.stop="statusDropdownOpen = false"
                    @keydown.enter.prevent="statusDropdownOpen = false"
                  />
                  <button
                    class="combobox-chevron"
                    type="button"
                    tabindex="-1"
                    aria-hidden="true"
                    @mousedown.prevent="toggleStatusDropdown"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
                      :style="{ transform: statusDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)' }"
                    >
                      <path d="M2 4l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </button>

                  <ul
                    v-if="statusDropdownOpen"
                    class="combobox-dropdown"
                    role="listbox"
                  >
                    <li
                      v-for="s in filteredStatuses"
                      :key="s"
                      class="combobox-option"
                      :class="{ 'combobox-option--active': props.manager.getStatusLabel(s).toLowerCase() === form.statusLabel.toLowerCase() }"
                      role="option"
                      :aria-selected="props.manager.getStatusLabel(s).toLowerCase() === form.statusLabel.toLowerCase()"
                      @mousedown.prevent="selectStatus(s)"
                    >
                      <span class="option-dot" :class="`option-dot--${s}`" aria-hidden="true" />
                      {{ props.manager.getStatusLabel(s) }}
                    </li>
                    <li
                      v-if="isCustomStatus && form.statusLabel.trim()"
                      class="combobox-option combobox-option--create"
                      role="option"
                      @mousedown.prevent="statusDropdownOpen = false"
                    >
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                        <path d="M6 1v10M1 6h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                      </svg>
                      Create "{{ form.statusLabel.trim() }}"
                    </li>
                    <li
                      v-if="filteredStatuses.length === 0 && !isCustomStatus"
                      class="combobox-empty"
                    >
                      No matching statuses
                    </li>
                  </ul>
                </div>
              </div>

              <div class="field">
                <label class="field-label" for="task-priority">Priority</label>
                <select id="task-priority" v-model="form.priority" class="field-input">
                  <option v-for="p in PRIORITIES" :key="p" :value="p">
                    {{ p.charAt(0).toUpperCase() + p.slice(1) }}
                  </option>
                </select>
              </div>
            </div>

            <!-- Due date + Assignee row -->
            <div class="field-row">
              <div class="field">
                <label class="field-label" for="task-due">
                  Due Date <span class="required" aria-hidden="true">*</span>
                </label>
                <input
                  id="task-due"
                  v-model="form.dueDate"
                  class="field-input"
                  :class="{ 'field-input--error': errors.dueDate }"
                  type="date"
                  @change="clearError('dueDate')"
                />
                <p v-if="errors.dueDate" class="field-error" role="alert">{{ errors.dueDate }}</p>
              </div>

              <div class="field">
                <label class="field-label">
                  Assignees <span class="required" aria-hidden="true">*</span>
                </label>
                <div
                  class="assignees-field"
                  :class="{
                    'assignees-field--focused': assigneesWrapFocused,
                    'assignees-field--error': errors.assignees,
                  }"
                  @focusout="onAssigneesFocusOut"
                  @click="focusAssigneesInput"
                >
                  <!-- Selected chips -->
                  <span
                    v-for="name in form.assignees"
                    :key="name"
                    class="assignee-chip"
                  >
                    <span
                      class="assignee-chip-avatar"
                      :style="{ background: getAvatarColor(name) }"
                    >{{ getInitials(name) }}</span>
                    <span class="assignee-chip-name">{{ name }}</span>
                    <button
                      type="button"
                      class="assignee-chip-remove"
                      tabindex="-1"
                      :aria-label="`Remove ${name}`"
                      @mousedown.prevent="removeAssigneeChip(name)"
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                        <path d="M2 2l6 6M8 2L2 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                      </svg>
                    </button>
                  </span>

                  <!-- Text input -->
                  <input
                    ref="assigneesInputRef"
                    v-model="assigneesInputText"
                    class="assignees-text-input"
                    type="text"
                    :placeholder="form.assignees.length === 0 ? 'Search members…' : 'Add more…'"
                    autocomplete="off"
                    @focus="assigneesWrapFocused = true; assigneesDropdownOpen = true"
                    @input="assigneesDropdownOpen = true"
                    @keydown="onAssigneesKeydown"
                  />

                  <!-- Members dropdown -->
                  <div
                    v-if="assigneesDropdownOpen"
                    class="assignees-dropdown"
                    role="listbox"
                    aria-multiselectable="true"
                    aria-label="Members"
                  >
                    <!-- Dropdown header -->
                    <div class="assignees-dropdown-header">
                      <span>Members</span>
                      <span v-if="form.assignees.length > 0" class="assignees-selected-count">
                        {{ form.assignees.length }} selected
                      </span>
                    </div>

                    <!-- Member list -->
                    <ul class="assignees-list">
                      <li
                        v-for="member in filteredMemberSuggestions"
                        :key="member"
                        class="assignee-option"
                        :class="{ 'assignee-option--checked': isAssigneeSelected(member) }"
                        role="option"
                        :aria-selected="isAssigneeSelected(member)"
                        @mousedown.prevent="toggleAssignee(member)"
                      >
                        <!-- Avatar -->
                        <span
                          class="option-avatar"
                          :style="{ background: getAvatarColor(member) }"
                          aria-hidden="true"
                        >{{ getInitials(member) }}</span>

                        <!-- Name -->
                        <span class="option-name">{{ member }}</span>

                        <!-- Checkmark on right (Jira style) -->
                        <span class="option-check" aria-hidden="true">
                          <svg
                            v-if="isAssigneeSelected(member)"
                            width="14" height="14" viewBox="0 0 14 14" fill="none"
                          >
                            <path d="M2 7l3.5 3.5L12 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                          </svg>
                        </span>
                      </li>

                      <!-- Empty state -->
                      <li v-if="filteredMemberSuggestions.length === 0 && !showCreateMember" class="assignee-option--empty">
                        No members match "{{ assigneesInputText }}"
                      </li>
                    </ul>

                    <!-- Add new member -->
                    <div
                      v-if="showCreateMember"
                      class="assignees-create-row"
                      @mousedown.prevent="addCurrentInputAsAssignee"
                    >
                      <span class="create-avatar-placeholder" aria-hidden="true">
                        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                          <path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                      </span>
                      <span class="option-name">Add <strong>"{{ assigneesInputText.trim() }}"</strong></span>
                      <span class="create-label">New member</span>
                    </div>
                  </div>
                </div>
                <p class="field-hint-text">Click to select · multiple allowed · Backspace to remove last</p>
                <p v-if="errors.assignees" class="field-error" role="alert">{{ errors.assignees }}</p>
              </div>
            </div>

            <!-- Tags — chip multi-select -->
            <div ref="tagsFieldRef" class="field">
              <label class="field-label">Tags</label>
              <div
                class="tags-field"
                :class="{ 'tags-field--focused': tagsWrapFocused }"
                @focusout="onTagsFocusOut"
                @click="focusTagsInput"
              >
                <!-- Selected chips -->
                <span
                  v-for="tag in form.tags"
                  :key="tag"
                  class="tag-chip"
                >
                  {{ tag }}
                  <button
                    type="button"
                    class="tag-chip-remove"
                    tabindex="-1"
                    :aria-label="`Remove ${tag}`"
                    @mousedown.prevent="removeTag(tag)"
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                      <path d="M2 2l6 6M8 2L2 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                  </button>
                </span>

                <!-- Text input -->
                <input
                  ref="tagsInputRef"
                  v-model="tagsInputText"
                  class="tags-text-input"
                  type="text"
                  :placeholder="form.tags.length === 0 ? 'Type a tag and press Enter or ,' : ''"
                  autocomplete="off"
                  @focus="openTagsDropdown"
                  @input="tagsDropdownOpen = true"
                  @keydown="onTagsKeydown"
                />

                <!-- Suggestions dropdown — stays open while interacting -->
                <ul
                  v-if="tagsDropdownOpen && filteredTagSuggestions.length > 0"
                  class="tags-dropdown"
                  role="listbox"
                  aria-multiselectable="true"
                >
                  <li
                    v-for="suggestion in filteredTagSuggestions"
                    :key="suggestion"
                    class="tags-option"
                    :class="{ 'tags-option--checked': isTagSelected(suggestion) }"
                    role="option"
                    :aria-selected="isTagSelected(suggestion)"
                    @mousedown.prevent="toggleTag(suggestion)"
                  >
                    <!-- Checkbox indicator -->
                    <span class="tags-check-box" :class="{ 'tags-check-box--on': isTagSelected(suggestion) }">
                      <svg
                        v-if="isTagSelected(suggestion)"
                        width="9"
                        height="9"
                        viewBox="0 0 10 10"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path d="M1.5 5L3.8 7.5L8.5 2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </span>
                    {{ suggestion }}
                  </li>
                </ul>
              </div>
              <p class="field-hint-text">Press Enter or , to add · Backspace to remove last</p>
            </div>
          </div>

          <!-- Modal footer -->
          <div class="modal-footer">
            <button class="btn-secondary" type="button" @click="emit('close')">Cancel</button>
            <button class="btn-primary" type="button" @click="submit">
              {{ isEditing ? 'Save Changes' : 'Create Task' }}
            </button>
          </div>
        </div>
      </Transition>
    </div>
  </Teleport>
</template>

<style scoped>
/* ── Backdrop ───────────────────────────────────────────────────────────── */

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: var(--bg-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: var(--sp-4);
}

/* ── Modal card ─────────────────────────────────────────────────────────── */

.modal {
  background: var(--bg-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
  width: 100%;
  max-width: 540px;
  max-height: calc(100vh - var(--sp-8));
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ── Header ─────────────────────────────────────────────────────────────── */

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--sp-5) var(--sp-6);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.modal-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--text-primary);
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  color: var(--text-muted);
  transition: color var(--duration-fast) var(--ease), background var(--duration-fast) var(--ease);
}
.close-btn:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

/* ── Body ───────────────────────────────────────────────────────────────── */

.modal-body {
  padding: var(--sp-5) var(--sp-6);
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
  overflow-y: auto;
  flex: 1;
}

/* ── Fields ─────────────────────────────────────────────────────────────── */

.field {
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
}

.field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--sp-4);
}

.field-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: var(--sp-1);
}

.required { color: var(--danger); }

.field-hint {
  font-weight: 400;
  color: var(--text-muted);
  font-size: 0.75rem;
}

.field-hint-text {
  font-size: 0.6875rem;
  color: var(--text-muted);
}

.field-input {
  padding: var(--sp-2) var(--sp-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  background: var(--bg-hover);
  color: var(--text-primary);
  outline: none;
  transition:
    border-color var(--duration-fast) var(--ease),
    box-shadow var(--duration-fast) var(--ease),
    background var(--duration-fast) var(--ease);
  width: 100%;
}

.field-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
  background: var(--bg-surface);
}

.field-input--error { border-color: var(--danger); }
.field-input--error:focus { box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.12); }

.field-textarea {
  resize: vertical;
  min-height: 80px;
  line-height: 1.5;
}

select.field-input { cursor: pointer; }

.field-error {
  font-size: 0.75rem;
  color: var(--danger);
  font-weight: 500;
}

/* ── Status combobox ────────────────────────────────────────────────────── */

.combobox {
  position: relative;
}

.combobox-input {
  padding-right: var(--sp-8);
}

.combobox--open .combobox-input {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
  background: var(--bg-surface);
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
}

.combobox-chevron {
  position: absolute;
  right: var(--sp-3);
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  transition: color var(--duration-fast) var(--ease);
}
.combobox-chevron svg {
  transition: transform var(--duration-fast) var(--ease);
}
.combobox:focus-within .combobox-chevron {
  color: var(--accent);
}

.combobox-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 50;
  background: var(--bg-surface);
  border: 1px solid var(--accent);
  border-top: none;
  border-bottom-left-radius: var(--radius-md);
  border-bottom-right-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  list-style: none;
  overflow: hidden;
  max-height: 180px;
  overflow-y: auto;
  animation: slideDownFade 160ms var(--ease-out-expo) both;
  transform-origin: top center;
}

.combobox-option {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-3);
  font-size: 0.875rem;
  color: var(--text-primary);
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease);
}
.combobox-option:hover { background: var(--bg-hover); }
.combobox-option--active {
  background: var(--accent-light);
  color: var(--accent);
  font-weight: 600;
}
.combobox-option--create {
  color: var(--accent);
  font-weight: 500;
  border-top: 1px solid var(--border);
}
.combobox-option--create:hover { background: var(--accent-light); }

.combobox-empty {
  padding: var(--sp-2) var(--sp-3);
  font-size: 0.8125rem;
  color: var(--text-muted);
  text-align: center;
}

.option-dot {
  width: 6px;
  height: 6px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
  background: var(--text-muted);
}
.option-dot--todo        { background: var(--status-todo); }
.option-dot--in-progress { background: var(--status-in-progress); }
.option-dot--done        { background: var(--status-done); }

/* ── Tags multi-select field ────────────────────────────────────────────── */

.tags-field {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-1);
  padding: 6px var(--sp-3);
  min-height: 40px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-hover);
  cursor: text;
  transition:
    border-color var(--duration-fast) var(--ease),
    box-shadow var(--duration-fast) var(--ease),
    background var(--duration-fast) var(--ease);
}

.tags-field--focused {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
  background: var(--bg-surface);
}

/* Individual tag chips */
.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px var(--sp-2) 2px var(--sp-2);
  background: var(--accent-light);
  color: var(--accent);
  border: 1px solid rgba(99, 102, 241, 0.25);
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
  user-select: none;
}

.tag-chip-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border-radius: var(--radius-full);
  color: var(--accent);
  opacity: 0.6;
  transition:
    opacity var(--duration-fast) var(--ease),
    background var(--duration-fast) var(--ease);
  flex-shrink: 0;
}
.tag-chip-remove:hover {
  opacity: 1;
  background: rgba(99, 102, 241, 0.15);
}

/* The invisible-looking text input inside the chip area */
.tags-text-input {
  flex: 1;
  min-width: 100px;
  border: none;
  background: transparent;
  outline: none;
  font-size: 0.875rem;
  color: var(--text-primary);
  padding: 2px 0;
  line-height: 1.4;
}

.tags-text-input::placeholder {
  color: var(--text-muted);
}

/* Tags suggestion dropdown */
.tags-dropdown {
  position: absolute;
  bottom: calc(100% + 6px);  /* opens upward */
  top: auto;
  left: 0;
  right: 0;
  z-index: 50;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  list-style: none;
  overflow: hidden;
  max-height: 200px;
  overflow-y: auto;
  animation: slideUpFade 180ms var(--ease-out-expo) both;
  transform-origin: bottom center;
}

.tags-option {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-3);
  font-size: 0.875rem;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease);
  user-select: none;
}
.tags-option:hover { background: var(--bg-hover); color: var(--text-primary); }
.tags-option--checked { color: var(--text-primary); }

/* Custom checkbox */
.tags-check-box {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  border: 1.5px solid var(--border);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-hover);
  transition:
    border-color var(--duration-fast) var(--ease),
    background var(--duration-fast) var(--ease);
}
.tags-check-box--on {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
.tags-option:hover .tags-check-box:not(.tags-check-box--on) {
  border-color: var(--accent);
}

/* ── Assignees chip multi-select ────────────────────────────────────────── */

.assignees-field {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-1);
  padding: 6px var(--sp-3);
  min-height: 40px;
  border: 1.5px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  cursor: text;
  transition:
    border-color var(--duration-fast) var(--ease),
    box-shadow var(--duration-fast) var(--ease);
}

.assignees-field--focused {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
}

.assignees-field--error {
  border-color: var(--danger);
  box-shadow: 0 0 0 2px rgba(222, 53, 11, 0.12);
}

.assignee-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 6px 2px 3px;
  background: var(--bg-column);
  color: var(--text-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
  user-select: none;
}

.assignee-chip-avatar {
  width: 18px;
  height: 18px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.5rem;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}

.assignee-chip-name {
  max-width: 110px;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--text-primary);
}

.assignee-chip-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border-radius: 3px;
  color: var(--text-muted);
  flex-shrink: 0;
  transition: color var(--duration-fast) var(--ease), background var(--duration-fast) var(--ease);
}
.assignee-chip-remove:hover {
  color: var(--danger);
  background: var(--danger-light);
}

.assignees-text-input {
  flex: 1;
  min-width: 120px;
  border: none;
  background: transparent;
  outline: none;
  font-size: 0.875rem;
  color: var(--text-primary);
  padding: 2px 0;
  line-height: 1.4;
}
.assignees-text-input::placeholder { color: var(--text-muted); }

/* ── Members dropdown ───────────────────────────────────────────────────── */

.assignees-dropdown {
  position: absolute;
  bottom: calc(100% + 6px);  /* opens upward */
  top: auto;
  left: 0;
  right: 0;
  z-index: 50;
  background: var(--bg-surface);
  border: 1.5px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  animation: slideUpFade 180ms var(--ease-out-expo) both;
  transform-origin: bottom center;
}

.assignees-dropdown-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px var(--sp-3) 6px;
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border-light);
}

.assignees-selected-count {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--accent);
  background: var(--accent-light);
  padding: 1px 7px;
  border-radius: var(--radius-full);
  text-transform: none;
  letter-spacing: 0;
}

.assignees-list {
  list-style: none;
  max-height: 180px;
  overflow-y: auto;
}

.assignee-option {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-3);
  font-size: 0.875rem;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease);
  user-select: none;
}
.assignee-option:hover {
  background: var(--bg-column);
  color: var(--text-primary);
}
.assignee-option--checked {
  background: var(--accent-light);
  color: var(--text-primary);
}
.assignee-option--checked:hover { background: #E0E5FF; }

.assignee-option--empty {
  padding: var(--sp-4) var(--sp-3);
  font-size: 0.8125rem;
  color: var(--text-muted);
  text-align: center;
  font-style: italic;
}

/* Avatar in dropdown (larger than chip) */
.option-avatar {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.625rem;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}

.option-name {
  flex: 1;
  font-size: 0.875rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Checkmark on the right (Jira-style) */
.option-check {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent);
  flex-shrink: 0;
}

/* ── "Add new member" row at bottom ─────────────────────────────────────── */

.assignees-create-row {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-3);
  font-size: 0.875rem;
  color: var(--accent);
  cursor: pointer;
  border-top: 1px solid var(--border-light);
  background: var(--bg-surface);
  transition: background var(--duration-fast) var(--ease);
  user-select: none;
}
.assignees-create-row:hover { background: var(--accent-light); }

.create-avatar-placeholder {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-full);
  border: 1.5px dashed var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent);
  flex-shrink: 0;
}

.create-label {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--text-muted);
  background: var(--bg-column);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 1px 7px;
  white-space: nowrap;
}

/* ── Footer ─────────────────────────────────────────────────────────────── */

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--sp-3);
  padding: var(--sp-4) var(--sp-6);
  border-top: 1px solid var(--border);
  flex-shrink: 0;
  background: var(--bg-hover);
}

/* ── Transition ─────────────────────────────────────────────────────────── */

.modal-enter-active {
  transition:
    opacity 380ms var(--ease-out-expo),
    transform 380ms var(--ease-spring);
}
.modal-leave-active {
  transition:
    opacity 200ms var(--ease),
    transform 200ms var(--ease);
}
.modal-enter-from {
  opacity: 0;
  transform: scale(0.92) translateY(16px);
}
.modal-leave-to {
  opacity: 0;
  transform: scale(0.96) translateY(8px);
}

/* Backdrop fade */
.modal-backdrop {
  animation: fadeIn 220ms var(--ease) both;
}
</style>
