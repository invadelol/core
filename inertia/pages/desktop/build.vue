<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Head, Link, router } from '@inertiajs/vue3'
import SiteLayout from '../../components/SiteLayout.vue'
import Icon from '../../components/ui/Icon.vue'
import { assetUrl, champIcon, championSplash } from '../../lib/assets.js'
import { detectDesktopTarget, type DesktopPlatform } from '../../lib/platform.js'
import { setBuildSaved, signInHref, useViewer } from '../../lib/account.js'
import '../../css/build-page.css'

/**
 * A build shared from the desktop app: its champion's art, the build's name, who made it, then the
 * build itself, big and calm: the buy path (start, core, boots, then), the max order, and its
 * other rows when it has them. `/desktop/build/…` links carry the whole build in the address;
 * `/build/<id>` is a build kept on an Invade account, with its author, how often it was opened
 * and imported, and Save to my builds (it joins the visitor's account and app).
 */
type Lane = 'TOP' | 'JUNGLE' | 'MID' | 'ADC' | 'SUPPORT'
const props = defineProps<{
  build: {
    championId: number
    championName: string
    lane: Lane
    name: string
    items: {
      start: number[][]
      early: number[]
      boots: number[]
      core: number[]
      later: number[][]
      situational: number[]
      elixirs: number[]
      trinkets: number[]
      max: string
    }
    itemNames: Record<string, string>
  }
  link: string
  /** A build kept on an account (`/build/<id>`); null for a link that holds the whole build. */
  account: {
    id: string
    author: { name: string; handle: string; avatarUrl: string | null }
    opens: number
    imports: number
    shared: boolean
    mine: boolean
    saved: boolean
  } | null
}>()

const LANES: Record<Lane, string> = {
  TOP: 'top',
  JUNGLE: 'jungle',
  MID: 'mid',
  ADC: 'bottom',
  SUPPORT: 'support',
}

/** The tab's title. The name is the player's text, and the SSR head writes the title as is:
 *  angle brackets become their quiet lookalikes, so no name closes the tag. */
const title = computed(() =>
  (props.build.name
    ? `${props.build.name}: ${props.build.championName} build`
    : `${props.build.championName} ${LANES[props.build.lane]} build`
  )
    .replace(/</g, '‹')
    .replace(/>/g, '›')
)
const heading = computed(() => props.build.name || `${props.build.championName} build`)
const item = (id: number) => assetUrl('item', id)
const itemName = (id: number) => props.build.itemNames[String(id)] ?? ''

/** The buy path: the first starting set, the core, the boots, then each later slot's pick. */
const path = computed(() => {
  const i = props.build.items
  return [
    { label: 'Start', ids: i.start[0] ?? [], big: false },
    { label: 'Core', ids: i.core, big: true },
    { label: 'Boots', ids: i.boots.slice(0, 1), big: false },
    { label: 'Then', ids: i.later.map((slot) => slot[0]), big: false },
  ].filter((g) => g.ids.length)
})
/** The rows besides the path, those the build has. */
const options = computed(() => {
  const i = props.build.items
  return [
    { label: 'Or start with', ids: i.start.slice(1).flat() },
    { label: 'Early buys', ids: i.early },
    { label: 'Other boots', ids: i.boots.slice(1) },
    { label: 'Instead, later', ids: i.later.flatMap((slot) => slot.slice(1)) },
    { label: 'Situational', ids: i.situational },
    { label: 'Elixirs', ids: i.elixirs },
    { label: 'Trinket', ids: i.trinkets },
  ].filter((r) => r.ids.length)
})
const maxKeys = computed(() => props.build.items.max.split(''))

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

/* ── Save to my builds ────────────────────────────────────────────── */

const { viewer } = useViewer()
const saved = ref(props.account?.saved ?? false)
const imports = ref(props.account?.imports ?? 0)
const busy = ref(false)
const problem = ref('')
async function toggleSave() {
  if (!props.account) return
  if (!viewer.value) {
    router.visit(signInHref())
    return
  }
  busy.value = true
  problem.value = ''
  const on = !saved.value
  try {
    await setBuildSaved(props.account.id, on)
    saved.value = on
    imports.value = Math.max(0, imports.value + (on ? 1 : -1))
  } catch (error) {
    problem.value = error instanceof Error ? error.message : 'That did not go through.'
  } finally {
    busy.value = false
  }
}

const times = (n: number) => (n === 1 ? 'once' : `${n.toLocaleString('en-US')} times`)
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

  <SiteLayout>
    <div class="wrap bw">
      <section class="bw-top">
        <div class="bw-bd" aria-hidden="true">
          <img :src="championSplash(build.championId)" alt="" />
        </div>
        <div class="bw-id">
          <span class="bw-av"
            ><img :src="champIcon(build.championId)" :alt="build.championName"
          /></span>
          <div class="bw-who">
            <h1>{{ heading }}</h1>
            <p class="meta bw-meta">{{ build.championName }}, {{ LANES[build.lane] }}</p>
            <Link v-if="account" class="bw-by" :href="`/u/${account.author.handle}`">
              <img v-if="account.author.avatarUrl" :src="account.author.avatarUrl" alt="" />
              <span v-else class="bw-by-none"><Icon name="user" :size="14" /></span>
              <span
                >By <b>{{ account.author.name }}</b
                ><template v-if="!account.shared">, only you see it</template></span
              >
            </Link>
          </div>
          <div class="bw-acts">
            <button
              v-if="account && !account.mine"
              type="button"
              class="btn pri"
              :aria-pressed="saved"
              :disabled="busy"
              data-track="build_save"
              @click="toggleSave"
            >
              <Icon :name="saved ? 'saved' : 'save'" :size="16" />{{
                saved ? 'In my builds' : 'Save to my builds'
              }}
            </button>
            <a
              v-else-if="!account"
              :href="target ? `/download/${target}` : '/app'"
              class="btn pri"
              data-track="build_get_app"
            >
              <Icon name="download" :size="16" />
              {{ target ? `Download for ${SHORT[target]}` : 'Get Invade' }}
            </a>
            <button
              type="button"
              class="btn ico"
              :aria-label="copied ? 'Link copied' : 'Copy the link'"
              :title="copied ? 'Link copied' : 'Copy the link'"
              @click="copy"
            >
              <Icon :name="copied ? 'check' : 'link'" :size="16" />
            </button>
          </div>
        </div>
        <p v-if="problem" class="bw-err" role="alert">{{ problem }}</p>
      </section>

      <div class="bw-body">
        <section class="bw-sec" aria-labelledby="bw-items">
          <h2 id="bw-items" class="bw-h">Items</h2>
          <ol class="bw-path">
            <li v-for="(g, i) in path" :key="g.label" class="bw-step">
              <Icon v-if="i" name="chevr" :size="18" class="bw-arr" />
              <div class="bw-g">
                <span class="bw-l">{{ g.label }}</span>
                <span class="bw-its">
                  <img
                    v-for="(id, n) in g.ids"
                    :key="n"
                    class="bw-it"
                    :class="{ big: g.big }"
                    :src="item(id)"
                    :alt="itemName(id)"
                    :title="itemName(id)"
                  />
                </span>
              </div>
            </li>
          </ol>
        </section>

        <div v-if="options.length || maxKeys.length" class="bw-two">
          <section v-if="options.length" class="bw-sec" aria-labelledby="bw-more">
            <h2 id="bw-more" class="bw-h">Also in this build</h2>
            <dl class="bw-opts">
              <div v-for="r in options" :key="r.label" class="bw-opt">
                <dt class="bw-l">{{ r.label }}</dt>
                <dd class="bw-its">
                  <img
                    v-for="(id, n) in r.ids"
                    :key="n"
                    class="bw-it sm"
                    :src="item(id)"
                    :alt="itemName(id)"
                    :title="itemName(id)"
                  />
                </dd>
              </div>
            </dl>
          </section>
          <section v-if="maxKeys.length" class="bw-sec" aria-labelledby="bw-skills">
            <h2 id="bw-skills" class="bw-h">Skills</h2>
            <div class="bw-keys" :aria-label="`Max ${maxKeys.join(', then ')}`">
              <template v-for="(k, i) in maxKeys" :key="k">
                <Icon v-if="i" name="chevr" :size="14" class="bw-gt" />
                <kbd class="bw-key" :class="{ first: !i }">{{ k }}</kbd>
              </template>
            </div>
            <span class="meta">Max {{ maxKeys.join(', then ') }}</span>
          </section>
        </div>

        <p class="meta bw-foot">
          <template v-if="account"
            >Opened {{ times(account.opens) }}, imported {{ times(imports) }}.
          </template>
          Import it from the Champions page in Invade.
        </p>
      </div>
    </div>
  </SiteLayout>
</template>
