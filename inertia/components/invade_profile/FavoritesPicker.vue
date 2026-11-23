<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Icon from '../ui/Icon.vue'
import SkinPoster from '../skins/SkinPoster.vue'
import RarityGem from '../skins/RarityGem.vue'
import { SKIN_LIMITS, type SkinCard } from '../../lib/skin_types.js'

/**
 * Picks the favourite four: the four slots (a tap takes a skin out), a search over every skin,
 * a tap on a result puts it in the first free slot. Any skin, owned or not, like a film one loves.
 */
const props = defineProps<{ current: SkinCard[]; saving: boolean; error: string }>()
const emit = defineEmits<{ save: [ids: number[]]; close: [] }>()

const picks = ref<SkinCard[]>([...props.current])
const query = ref('')
const results = ref<SkinCard[]>([])
const dialog = ref<HTMLDialogElement | null>(null)
const field = ref<HTMLInputElement | null>(null)

let controller: AbortController | null = null
let timer: ReturnType<typeof setTimeout> | undefined
watch(query, (q) => {
  clearTimeout(timer)
  timer = setTimeout(async () => {
    controller?.abort()
    if (!q.trim()) return (results.value = [])
    controller = new AbortController()
    try {
      const response = await fetch(`/api/skins/search?q=${encodeURIComponent(q.trim())}`, {
        signal: controller.signal,
      })
      if (response.ok) results.value = ((await response.json()) as { skins: SkinCard[] }).skins
    } catch {
      /* A newer search replaced this one, or the network hiccupped: the list stays. */
    }
  }, 160)
})

function add(skin: SkinCard) {
  if (picks.value.some((p) => p.id === skin.id) || picks.value.length >= SKIN_LIMITS.favorites) {
    return
  }
  picks.value = [...picks.value, skin]
}
const remove = (id: number) => (picks.value = picks.value.filter((p) => p.id !== id))

onMounted(() => {
  dialog.value?.showModal()
  field.value?.focus()
})
onBeforeUnmount(() => {
  clearTimeout(timer)
  controller?.abort()
})
</script>

<template>
  <dialog ref="dialog" class="skn-dialog" aria-labelledby="pf-pick-title" @close="emit('close')">
    <div class="skn-dialog-in">
      <div class="skn-dialog-h">
        <h2 id="pf-pick-title">Favourite four</h2>
        <button type="button" class="btn sm ico" aria-label="Close" @click="dialog?.close()">
          <Icon name="x" />
        </button>
      </div>
      <div class="skn-picks">
        <template v-for="n in SKIN_LIMITS.favorites" :key="n">
          <button
            v-if="picks[n - 1]"
            type="button"
            class="skn-pick"
            :aria-label="`Take ${picks[n - 1].name} out`"
            aria-pressed="true"
            @click="remove(picks[n - 1].id)"
          >
            <SkinPoster :skin="picks[n - 1]" />
            <span class="ell">{{ picks[n - 1].name }}</span>
          </button>
          <span v-else class="skn-pick"
            ><span class="skn-pick-empty"><Icon name="plus" :size="18" /></span
          ></span>
        </template>
      </div>
      <label class="skn-search" style="width: auto">
        <Icon name="search" />
        <span class="skn-vh">Search a skin</span>
        <input
          ref="field"
          v-model="query"
          type="search"
          placeholder="Search a skin"
          maxlength="60"
        />
      </label>
      <div v-if="results.length" class="skn-results">
        <button
          v-for="s in results"
          :key="s.id"
          type="button"
          class="skn-result"
          :disabled="picks.length >= SKIN_LIMITS.favorites || picks.some((p) => p.id === s.id)"
          @click="add(s)"
        >
          <SkinPoster :skin="s" size="xxs" />{{ s.name }}
          <span class="meta"><RarityGem :rarity="s.rarity" :size="12" /></span>
        </button>
      </div>
      <div class="skn-editor">
        <div class="row">
          <span v-if="error" class="skn-err" role="alert">{{ error }}</span>
          <button type="button" class="btn" @click="dialog?.close()">Cancel</button>
          <button
            type="button"
            class="btn pri"
            :disabled="saving"
            @click="
              emit(
                'save',
                picks.map((p) => p.id)
              )
            "
          >
            Save
          </button>
        </div>
      </div>
    </div>
  </dialog>
</template>
