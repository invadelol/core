<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Head } from '@inertiajs/vue3'
import { RoleIcon } from '@invadelol/ui'
import { Check, ChevronRight, Copy, Download } from 'lucide-vue-next'
import AppHeader from '../../components/AppHeader.vue'
import SiteFooter from '../../components/SiteFooter.vue'
import { assetUrl, championSplash } from '../../lib/assets.js'
import { detectDesktopTarget, type DesktopPlatform } from '../../lib/platform.js'

/**
 * /desktop/build/…: a build shared from the desktop app's My builds, drawn as its editor lays it
 * out (starting items, boots, the core in buy order, then the 4th to 6th item with their
 * alternatives). The link opens in the app: Champions → the champion → My builds → Import.
 */
type Lane = 'TOP' | 'JUNGLE' | 'MID' | 'ADC' | 'SUPPORT'
const props = defineProps<{
  build: {
    championId: number
    championName: string
    lane: Lane
    name: string
    items: { start: number[]; boots: number | null; core: number[]; later: number[][] }
    itemNames: Record<string, string>
  }
  link: string
}>()

const LANES: Record<Lane, string> = {
  TOP: 'Top',
  JUNGLE: 'Jungle',
  MID: 'Mid',
  ADC: 'Bot',
  SUPPORT: 'Support',
}
const ORDINALS = ['4th item', '5th item', '6th item']

const lane = computed(() => LANES[props.build.lane])
/** The tab's title. The name is the player's text, and the SSR head writes the title as is:
 *  angle brackets become their quiet lookalikes, so no name closes the tag. */
const title = computed(() =>
  (props.build.name
    ? `${props.build.name} — ${props.build.championName} build`
    : `${props.build.championName} ${lane.value} build`
  )
    .replace(/</g, '‹')
    .replace(/>/g, '›')
)
const item = (id: number) => assetUrl('item', id)
const itemName = (id: number) => props.build.itemNames[String(id)] ?? ''

const copied = ref(false)
async function copy() {
  try {
    await navigator.clipboard.writeText(props.link)
    copied.value = true
    setTimeout(() => (copied.value = false), 1600)
  } catch {
    // The link stays on screen to copy by hand.
  }
}

const SHORT: Record<DesktopPlatform, string> = {
  'windows': 'Windows',
  'mac-arm': 'macOS',
  'mac-intel': 'macOS',
}
const target = ref<DesktopPlatform | null>(null)
onMounted(async () => (target.value = await detectDesktopTarget()))
</script>

<template>
  <Head :title="title" />

  <div class="flex min-h-screen flex-col">
    <AppHeader />

    <main class="mx-auto w-full max-w-[760px] flex-1 px-4 pt-[clamp(32px,7vh,72px)] sm:px-6">
      <header class="sb-head iv-dark">
        <img :src="championSplash(build.championId)" alt="" class="sb-art" draggable="false" />
        <div class="sb-words">
          <p class="flex items-center gap-2 text-[13px] font-medium text-ink-3">
            <RoleIcon :lane="build.lane" :size="15" />
            <span class="text-ink">{{ build.championName }}</span>
            <span>{{ lane }}</span>
          </p>
          <h1 class="mt-1 text-[28px] font-semibold leading-tight tracking-[-0.012em] text-ink">
            {{ build.name || `${build.championName} build` }}
          </h1>
        </div>
      </header>

      <section class="iv-panel mt-5 p-5 sm:p-6" aria-label="Items">
        <div v-if="build.items.start.length" class="sb-row">
          <span class="iv-label">Starting items</span>
          <span class="sb-items">
            <img
              v-for="(id, i) in build.items.start"
              :key="i"
              :src="item(id)"
              :alt="itemName(id)"
              :title="itemName(id)"
              class="sb-item sm"
            />
          </span>
        </div>
        <div class="sb-row">
          <span class="iv-label">Boots</span>
          <span class="sb-items">
            <img
              v-if="build.items.boots !== null"
              :src="item(build.items.boots)"
              :alt="itemName(build.items.boots)"
              :title="itemName(build.items.boots)"
              class="sb-item sm"
            />
            <span v-else class="text-[13px] text-ink-4">No boots</span>
          </span>
        </div>
        <div class="sb-row">
          <span class="iv-label">Core</span>
          <span class="sb-items">
            <template v-for="(id, i) in build.items.core" :key="i">
              <ChevronRight v-if="i" :size="14" class="text-ink-4" aria-hidden="true" />
              <img :src="item(id)" :alt="itemName(id)" :title="itemName(id)" class="sb-item" />
            </template>
          </span>
        </div>
        <div v-for="(options, slot) in build.items.later" :key="slot" class="sb-row">
          <span class="iv-label">{{ ORDINALS[slot] }}</span>
          <span class="sb-items">
            <template v-for="(id, o) in options" :key="o">
              <small v-if="o" class="text-[12px] text-ink-3">or</small>
              <img
                :src="item(id)"
                :alt="itemName(id)"
                :title="itemName(id)"
                class="sb-item"
                :class="{ alt: o > 0 }"
              />
            </template>
          </span>
        </div>
      </section>

      <section class="mt-6">
        <h2 class="text-[14px] font-semibold text-ink">Open in Invade</h2>
        <p class="mt-1 text-[13px] leading-relaxed text-ink-2">
          Copy the link, then in Invade for desktop go to Champions, {{ build.championName }}, My
          builds, and import it. Champ select can then use it for {{ lane }}.
        </p>
        <div class="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" class="iv-btn" @click="copy">
            <component :is="copied ? Check : Copy" :size="13" aria-hidden="true" />
            {{ copied ? 'Link copied' : 'Copy build link' }}
          </button>
          <a :href="target ? `/download/${target}` : '/app'" class="iv-btn primary">
            <Download :size="13" aria-hidden="true" />
            {{ target ? `Download for ${SHORT[target]}` : 'Get Invade' }}
          </a>
        </div>
        <input
          :value="link"
          readonly
          aria-label="Build link"
          class="sb-link mt-3"
          @focus="($event.target as HTMLInputElement).select()"
        />
      </section>
    </main>

    <SiteFooter />
  </div>
</template>

<style scoped>
.sb-head {
  position: relative;
  display: flex;
  align-items: flex-end;
  min-height: 180px;
  padding: 20px;
  overflow: hidden;
  border-radius: var(--r-md);
  background: var(--ink-1);
}
.sb-art {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 30%;
  filter: brightness(0.62) saturate(0.85);
}
.sb-head::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 30%, color-mix(in srgb, var(--ink-1) 85%, transparent));
}
.sb-words {
  position: relative;
  z-index: 1;
}
.sb-row {
  display: grid;
  grid-template-columns: 110px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--line);
}
.sb-row:last-child {
  border-bottom: 0;
}
.sb-items {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.sb-item {
  width: 52px;
  height: 52px;
  border-radius: 6px;
  box-shadow: var(--row);
}
.sb-item.sm {
  width: 40px;
  height: 40px;
}
.sb-item.alt {
  width: 40px;
  height: 40px;
  opacity: 0.85;
}
.sb-link {
  width: 100%;
  height: 32px;
  padding: 0 10px;
  font: inherit;
  font-size: 12.5px;
  color: var(--text-2);
  background: var(--inset);
  border: 0;
  border-radius: var(--r-sm);
  box-shadow: var(--inset-shadow);
  outline: none;
}
@media (max-width: 520px) {
  .sb-row {
    grid-template-columns: 1fr;
    gap: 6px;
  }
}
</style>
