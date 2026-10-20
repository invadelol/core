<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Head } from '@inertiajs/vue3'
import { RoleIcon } from '@invadelol/ui'
import { Check, ChevronRight, Copy, Download } from 'lucide-vue-next'
import AppHeader from '../../components/AppHeader.vue'
import SiteFooter from '../../components/SiteFooter.vue'
import { assetUrl, champIcon } from '../../lib/assets.js'
import { detectDesktopTarget, type DesktopPlatform } from '../../lib/platform.js'

/**
 * /desktop/build/…: a build shared from the desktop app's My builds, drawn in the order it is
 * bought: starting items, boots, the core, then the 4th to 6th item with their alternatives.
 * The link opens in the app: Champions → the champion → My builds → Import.
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
const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th', '6th']

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

/** The starting items' names, a stack once: "Health Potion ×2". */
const startNames = computed(() => {
  const counts = new Map<number, number>()
  for (const id of props.build.items.start) counts.set(id, (counts.get(id) ?? 0) + 1)
  return [...counts].map(([id, n]) => (n > 1 ? `${itemName(id)} ×${n}` : itemName(id)))
})

const copied = ref(false)
async function copy() {
  try {
    await navigator.clipboard.writeText(props.link)
    copied.value = true
    setTimeout(() => (copied.value = false), 1600)
  } catch {
    // Copying from the address bar still works.
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

    <main class="mx-auto w-full max-w-[1120px] flex-1 px-4 pb-16 pt-[clamp(32px,7vh,64px)] sm:px-6">
      <header class="flex items-center gap-4">
        <img
          :src="champIcon(build.championId)"
          :alt="build.championName"
          width="64"
          height="64"
          class="sb-portrait"
          draggable="false"
        />
        <div class="min-w-0">
          <p class="flex items-center gap-1.5 text-[13px] font-medium text-ink-2">
            <RoleIcon :lane="build.lane" :size="14" />
            <span class="text-ink">{{ build.championName }}</span>
            <span>{{ lane }}</span>
          </p>
          <h1 class="mt-1 break-words text-[30px] font-[650] leading-tight tracking-[-0.015em] text-ink">
            {{ build.name || `${build.championName} build` }}
          </h1>
        </div>
      </header>

      <section class="iv-panel lit-sheet mt-7 px-5 pb-6 pt-5 sm:px-7" aria-labelledby="sb-order">
        <h2 id="sb-order" class="mb-5 text-[16px] font-semibold text-ink">Buy order</h2>
        <ol class="sb-route">
          <li v-if="build.items.start.length" class="sb-step">
            <div class="sb-col">
              <span class="sb-lab">Start</span>
              <span class="sb-icons">
                <img
                  v-for="(id, i) in build.items.start"
                  :key="i"
                  :src="item(id)"
                  :alt="itemName(id)"
                  :title="itemName(id)"
                  class="sb-item sm"
                />
              </span>
              <span class="sb-name">
                <template v-for="(n, i) in startNames" :key="i"><br v-if="i" />{{ n }}</template>
              </span>
            </div>
          </li>
          <li v-if="build.items.boots !== null" class="sb-step">
            <ChevronRight :size="16" class="sb-chev" aria-hidden="true" />
            <div class="sb-col">
              <span class="sb-lab">Boots</span>
              <span class="sb-icons">
                <img :src="item(build.items.boots)" :alt="itemName(build.items.boots)" class="sb-item" />
              </span>
              <span class="sb-name">{{ itemName(build.items.boots) }}</span>
            </div>
          </li>
          <li class="sb-step">
            <ChevronRight :size="16" class="sb-chev" aria-hidden="true" />
            <ol class="sb-well" aria-label="Core">
              <li v-for="(id, i) in build.items.core" :key="i" class="sb-step">
                <ChevronRight v-if="i" :size="16" class="sb-chev" aria-hidden="true" />
                <div class="sb-col">
                  <span class="sb-lab strong">{{ ORDINALS[i] }}<template v-if="!i"> · core</template></span>
                  <span class="sb-icons"><img :src="item(id)" :alt="itemName(id)" class="sb-item" /></span>
                  <span class="sb-name strong">{{ itemName(id) }}</span>
                </div>
              </li>
            </ol>
          </li>
          <li v-for="(options, slot) in build.items.later" :key="`l${slot}`" class="sb-step">
            <ChevronRight :size="16" class="sb-chev" aria-hidden="true" />
            <div class="sb-col">
              <span class="sb-lab">{{ ORDINALS[build.items.core.length + slot] }}</span>
              <span class="sb-icons">
                <img :src="item(options[0])" :alt="itemName(options[0])" class="sb-item" />
              </span>
              <span class="sb-name">{{ itemName(options[0]) }}</span>
              <span v-for="(id, o) in options.slice(1)" :key="o" class="sb-alt">
                or
                <img :src="item(id)" :alt="itemName(id)" class="sb-item xs" />
                {{ itemName(id) }}
              </span>
            </div>
          </li>
        </ol>
      </section>

      <div class="mt-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-1">
        <p class="text-[13px] text-ink-2">Import it from the Champions page in Invade.</p>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="iv-btn lg" @click="copy">
            <component :is="copied ? Check : Copy" :size="14" aria-hidden="true" />
            {{ copied ? 'Link copied' : 'Copy link' }}
          </button>
          <a :href="target ? `/download/${target}` : '/app'" class="iv-btn lg primary">
            <Download :size="14" aria-hidden="true" />
            {{ target ? `Download for ${SHORT[target]}` : 'Get Invade' }}
          </a>
        </div>
      </div>
    </main>

    <SiteFooter />
  </div>
</template>

<style scoped>
.sb-portrait {
  width: 64px;
  height: 64px;
  flex: none;
  border-radius: var(--r-md);
  box-shadow: var(--portrait);
}
.sb-route,
.sb-well {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  row-gap: 24px;
  margin: 0;
  padding: 0;
  list-style: none;
}
/* The core: its items in one well, so the route's spine reads at a glance. */
.sb-well {
  flex-wrap: nowrap;
  margin-top: -10px;
  padding: 10px 6px 14px;
  border-radius: var(--r-md);
  background: var(--well);
  box-shadow: var(--inset-shadow);
}
.sb-step {
  display: flex;
  align-items: flex-start;
}
.sb-chev {
  flex: none;
  margin: 48px 2px 0;
  color: var(--text-4);
}
.sb-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  width: 112px;
}
.sb-lab {
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
  color: var(--text-3);
}
.sb-lab.strong {
  color: var(--text-2);
}
.sb-icons {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 56px;
}
.sb-name {
  font-size: 12px;
  line-height: 16px;
  color: var(--text-2);
  text-align: center;
}
.sb-name.strong {
  color: var(--text-1);
}
.sb-item {
  width: 56px;
  height: 56px;
  border-radius: var(--r-sm);
  box-shadow: var(--row);
}
.sb-item.sm {
  width: 40px;
  height: 40px;
}
.sb-item.xs {
  width: 28px;
  height: 28px;
}
.sb-alt {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-top: 10px;
  border-top: 1px solid var(--line);
  font-size: 12px;
  line-height: 15px;
  color: var(--text-3);
}

/* Phones: the route reads top to bottom, one row per step. */
@media (max-width: 640px) {
  .sb-route,
  .sb-well,
  .sb-step {
    flex-direction: column;
    align-items: stretch;
    row-gap: 0;
  }
  .sb-chev {
    display: none;
  }
  .sb-well {
    margin: 4px -10px;
    padding: 0 10px;
  }
  .sb-col {
    display: grid;
    grid-template-columns: 56px auto minmax(0, 1fr);
    align-items: center;
    gap: 6px 12px;
    width: auto;
    padding: 10px 0;
  }
  .sb-icons {
    height: auto;
  }
  .sb-name {
    text-align: left;
  }
  .sb-item {
    width: 44px;
    height: 44px;
  }
  .sb-item.sm {
    width: 36px;
    height: 36px;
  }
  .sb-alt {
    grid-column: 2 / -1;
    padding-top: 0;
    border-top: 0;
  }
}
</style>
