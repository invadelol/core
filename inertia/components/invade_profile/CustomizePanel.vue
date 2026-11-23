<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import Icon from '../ui/Icon.vue'
import Segmented from '../ui/Segmented.vue'
import { posterUrl } from '../../lib/skins.js'
import {
  ACCENTS,
  ACCENT_NAMES,
  FREE_ACCENT,
  LINK_KINDS,
  LINK_NAMES,
  PLUS_SHOWCASES,
  PROFILE_LIMITS,
  SHOWCASE_NAMES,
  type Accent,
  type AvatarSource,
  type CustomizeData,
  type LinkKind,
  type ProfileSettings,
} from '../../lib/invade_profile.js'

/**
 * Customize, beside the live profile: the backdrop (a skin the owner owns), the avatar, the
 * accent, the showcases in the owner's order, the bio and links. Choices beyond the free ones are
 * marked Invade+ and open only with it. Nothing is saved until Save.
 */
const props = defineProps<{
  customize: CustomizeData
  premium: boolean
  saving: boolean
  error: string
}>()
const draft = defineModel<ProfileSettings>({ required: true })
const emit = defineEmits<{ save: []; cancel: [] }>()

const SWATCHES: Record<Accent, string> = {
  violet: 'var(--v500)',
  rose: '#ff7ab0',
  gold: '#e9c46a',
  teal: '#2fd3c0',
  ice: '#8fb7ff',
  white: '#f1eff8',
}
const avatarOptions = [
  { value: 'backdrop' as AvatarSource, label: 'From the backdrop' },
  { value: 'icon' as AvatarSource, label: 'League icon' },
]

function set<K extends keyof ProfileSettings>(key: K, value: ProfileSettings[K]) {
  draft.value = { ...draft.value, [key]: value }
}
const avatar = computed({
  get: () => draft.value.avatar,
  set: (value: AvatarSource) => set('avatar', value),
})

/* Links: one field per network, empty to leave it out. */
const handleOf = (kind: LinkKind) => draft.value.links.find((l) => l.kind === kind)?.handle ?? ''
function setLink(kind: LinkKind, handle: string) {
  const others = draft.value.links.filter((l) => l.kind !== kind)
  set('links', handle.trim() ? [...others, { kind, handle: handle.trim() }] : others)
}

/* Showcases: drag to order, or the grip and the arrow keys. */
const dragging = ref<number | null>(null)
const announce = ref('')
function move(from: number, to: number) {
  if (to < 0 || to >= draft.value.showcases.length || from === to) return
  const list = [...draft.value.showcases]
  const [item] = list.splice(from, 1)
  list.splice(to, 0, item)
  set('showcases', list)
  announce.value = `${SHOWCASE_NAMES[item.key]}, place ${to + 1} of ${list.length}`
}
function drop(to: number) {
  if (dragging.value !== null) move(dragging.value, to)
  dragging.value = null
}
const grips = ref<HTMLButtonElement[]>([])
async function key(event: KeyboardEvent, index: number) {
  const to = event.key === 'ArrowUp' ? index - 1 : event.key === 'ArrowDown' ? index + 1 : null
  if (to === null) return
  event.preventDefault()
  move(index, to)
  await nextTick()
  grips.value[Math.max(0, Math.min(to, draft.value.showcases.length - 1))]?.focus()
}
function toggleShowcase(index: number) {
  const list = draft.value.showcases.map((s, i) => (i === index ? { ...s, on: !s.on } : s))
  set('showcases', list)
}

const backdropSection = ref<HTMLElement | null>(null)
defineExpose({
  focusBackdrop() {
    backdropSection.value?.scrollIntoView({ block: 'start' })
    backdropSection.value?.querySelector<HTMLButtonElement>('button')?.focus()
  },
})
</script>

<template>
  <aside class="pf-edit" aria-labelledby="pf-edit-title">
    <div class="pf-edit-h">
      <h2 id="pf-edit-title">Customize</h2>
      <button type="button" class="btn sm ico" aria-label="Close" @click="emit('cancel')">
        <Icon name="x" />
      </button>
    </div>

    <section ref="backdropSection" class="pf-es" aria-labelledby="pf-bd-label">
      <div class="pf-el">
        <b id="pf-bd-label">Backdrop</b>
        <span v-if="customize.backdrops.length" class="meta num"
          >From your {{ customize.backdrops.length }} skins</span
        >
      </div>
      <div class="pf-bds">
        <button
          v-if="customize.fallbackChampion"
          type="button"
          class="pf-bdo"
          :aria-pressed="draft.backdrop === null"
          aria-label="Your main champion"
          @click="set('backdrop', null)"
        >
          <img
            :src="posterUrl({ championId: customize.fallbackChampion, num: 0 })"
            alt=""
            loading="lazy"
          />
        </button>
        <button
          v-for="b in customize.backdrops"
          :key="b.id"
          type="button"
          class="pf-bdo"
          :aria-pressed="draft.backdrop === b.id"
          :aria-label="b.name"
          @click="set('backdrop', b.id)"
        >
          <img :src="posterUrl(b)" alt="" loading="lazy" />
        </button>
      </div>
      <p v-if="!customize.backdrops.length" class="pf-note">
        The skins you own come from the Invade app, once it read your League client.
      </p>
    </section>

    <section class="pf-es" aria-labelledby="pf-av-label">
      <div class="pf-el"><b id="pf-av-label">Avatar</b></div>
      <Segmented v-model="avatar" class="pf-seg" :options="avatarOptions" label="Avatar" />
      <div class="pf-el">
        <span class="meta">Frame in your accent</span>
        <span class="row" style="gap: 10px; align-items: center">
          <span class="pf-plus">Invade+</span>
          <button
            type="button"
            role="switch"
            class="switch"
            :class="{ on: draft.frame }"
            :aria-checked="draft.frame"
            aria-label="Avatar frame, Invade+"
            :disabled="!premium"
            @click="set('frame', !draft.frame)"
          />
        </span>
      </div>
    </section>

    <fieldset class="pf-es">
      <div class="pf-el">
        <legend>Accent</legend>
        <span class="pf-plus">Invade+</span>
      </div>
      <div class="pf-sws" role="radiogroup" aria-label="Accent">
        <button
          v-for="a in ACCENTS"
          :key="a"
          type="button"
          role="radio"
          class="pf-sw"
          :style="{ '--sw': SWATCHES[a] }"
          :aria-checked="draft.accent === a"
          :aria-label="`${ACCENT_NAMES[a]}${a === FREE_ACCENT ? '' : ', Invade+'}`"
          :disabled="a !== FREE_ACCENT && !premium"
          @click="set('accent', a)"
        />
      </div>
    </fieldset>

    <section class="pf-es" aria-labelledby="pf-sc-label">
      <div class="pf-el">
        <b id="pf-sc-label">Showcases</b>
        <span class="meta">Drag to order</span>
      </div>
      <ul class="pf-shows">
        <li
          v-for="(s, i) in draft.showcases"
          :key="s.key"
          class="pf-show"
          :class="{ dragging: dragging === i }"
          draggable="true"
          @dragstart="dragging = i"
          @dragend="dragging = null"
          @dragover.prevent
          @drop.prevent="drop(i)"
        >
          <button
            ref="grips"
            type="button"
            class="pf-grip"
            :aria-label="`Move ${SHOWCASE_NAMES[s.key]}: arrow up or down`"
            @keydown="key($event, i)"
          >
            <Icon name="grip" :size="15" />
          </button>
          <span class="pf-sl">{{ SHOWCASE_NAMES[s.key] }}</span>
          <span v-if="PLUS_SHOWCASES.has(s.key)" class="pf-plus">Invade+</span>
          <button
            type="button"
            role="switch"
            class="switch"
            :class="{ on: s.on }"
            :aria-checked="s.on"
            :aria-label="`Show ${SHOWCASE_NAMES[s.key]}`"
            :disabled="PLUS_SHOWCASES.has(s.key) && !premium && !s.on"
            @click="toggleShowcase(i)"
          />
        </li>
      </ul>
      <p class="skn-vh" aria-live="polite">{{ announce }}</p>
    </section>

    <section class="pf-es" aria-labelledby="pf-about-label">
      <div class="pf-el"><b id="pf-about-label">About</b></div>
      <label class="pf-in">
        <span class="meta">Bio</span>
        <textarea
          rows="3"
          :maxlength="PROFILE_LIMITS.bio"
          :value="draft.bio"
          @input="set('bio', ($event.target as HTMLTextAreaElement).value)"
        />
      </label>
      <div class="pf-links">
        <label v-for="k in LINK_KINDS" :key="k" class="pf-in">
          <span class="meta">{{ LINK_NAMES[k] }}</span>
          <input
            :value="handleOf(k)"
            maxlength="40"
            autocomplete="off"
            spellcheck="false"
            :placeholder="k === 'youtube' ? '@channel' : 'name'"
            @change="setLink(k, ($event.target as HTMLInputElement).value)"
          />
        </label>
      </div>
    </section>

    <div class="pf-edit-f">
      <span v-if="error" class="pf-err" role="alert">{{ error }}</span>
      <button type="button" class="btn" @click="emit('cancel')">Cancel</button>
      <button type="button" class="btn pri" :disabled="saving" @click="emit('save')">Save</button>
    </div>
  </aside>
</template>
