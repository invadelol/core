<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import Icon from '../ui/Icon.vue'
import { browserWrite } from '../../lib/browser_write.js'
import { SKIN_LIMITS } from '../../lib/skin_types.js'

/**
 * "Add to a list": the visitor's lists with this skin ticked in each, a tick to add or remove it,
 * and a new list made on the spot (the skin goes in). Closes on Escape or a click outside.
 */
const props = defineProps<{
  skinId: number
  lists: { id: string; title: string; has: boolean }[]
}>()
const emit = defineEmits<{ close: []; changed: [] }>()

const rows = ref(props.lists.map((l) => ({ ...l })))
const title = ref('')
const busy = ref(false)
const error = ref('')
const root = ref<HTMLElement | null>(null)
const field = ref<HTMLInputElement | null>(null)

async function toggle(row: (typeof rows.value)[number]) {
  error.value = ''
  row.has = !row.has
  try {
    await browserWrite('PUT', `/api/skin-lists/${row.id}/skins/${props.skinId}`, { on: row.has })
    emit('changed')
  } catch (failure) {
    row.has = !row.has
    error.value = (failure as Error).message
  }
}

async function create() {
  const name = title.value.trim()
  if (!name || busy.value) return
  busy.value = true
  error.value = ''
  try {
    const { id } = await browserWrite<{ id: string }>('POST', '/api/skin-lists', { title: name })
    await browserWrite('PUT', `/api/skin-lists/${id}/skins/${props.skinId}`, { on: true })
    rows.value.unshift({ id, title: name, has: true })
    title.value = ''
    emit('changed')
  } catch (failure) {
    error.value = (failure as Error).message
  } finally {
    busy.value = false
  }
}

function outside(event: MouseEvent) {
  if (root.value && !root.value.contains(event.target as Node)) emit('close')
}
function escape(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close')
}
onMounted(() => {
  document.addEventListener('mousedown', outside)
  document.addEventListener('keydown', escape)
  nextTick(() => field.value?.focus())
})
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', outside)
  document.removeEventListener('keydown', escape)
})
</script>

<template>
  <div ref="root" class="skn-menu" role="dialog" aria-label="Add to a list">
    <form class="skn-menu-new" @submit.prevent="create">
      <label class="skn-vh" for="skn-new-list">New list</label>
      <input
        id="skn-new-list"
        ref="field"
        v-model="title"
        :maxlength="SKIN_LIMITS.listTitle"
        placeholder="New list"
        autocomplete="off"
      />
      <button type="submit" class="btn sm" :disabled="busy || !title.trim()">Create</button>
    </form>
    <button
      v-for="row in rows"
      :key="row.id"
      type="button"
      role="menuitemcheckbox"
      :aria-checked="row.has"
      @click="toggle(row)"
    >
      <Icon :name="row.has ? 'check' : 'plus'" :size="15" /><span class="ell">{{ row.title }}</span>
    </button>
    <p v-if="error" class="skn-err" role="alert">{{ error }}</p>
  </div>
</template>
