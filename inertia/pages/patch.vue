<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Head, Link, router } from '@inertiajs/vue3'
import { RoleIcon } from '@invadelol/ui'
import SiteLayout from '../components/SiteLayout.vue'
import Icon from '../components/ui/Icon.vue'
import Select from '../components/ui/Select.vue'
import EmptyState from '../components/ui/EmptyState.vue'
import Frame from '../components/ui/Frame.vue'
import ChangeMark from '../components/patch/ChangeMark.vue'
import NoteLines from '../components/patch/NoteLines.vue'
import { positionOf } from '../components/header/sections.js'
import { champIcon, skinSplash } from '../lib/assets.js'
import { noteCounts, type PatchChampionStat, type PatchNotes } from '../lib/patch_notes.js'
import '../css/patch.css'

/**
 * `/patch/:version`: one patch's changes, the facts of Riot's notes (champions, items, ARAM:
 * Mayhem, skins, bug fixes) from the repository's data file, each changed champion with how it
 * did on that patch in its main role in our games. A patch without a data file says so.
 */
const props = defineProps<{
  /** The patch shown, as players name it ("26.22"). `patch` is the site's shared newest patch. */
  current: string
  notes: PatchNotes | null
  /** The patches with notes, newest first. */
  patches: string[]
  stats: { bracket: string; games: number; byChampion: Record<number, PatchChampionStat> } | null
  slugs: Record<number, string>
}>()

const RANK: Record<string, string> = {
  emerald_plus: 'Emerald+',
  platinum_plus: 'Platinum+',
  diamond_plus: 'Diamond+',
  master_plus: 'Master+',
  all: 'all ranks',
}
const rank = computed(() => RANK[props.stats?.bracket ?? 'emerald_plus'] ?? 'Emerald+')
const counts = computed(() => (props.notes ? noteCounts(props.notes) : null))
const sub = computed(() =>
  props.patches.slice(0, 6).map((p) => ({ label: p, href: `/patch/${p}`, on: p === props.current }))
)
const patchModel = computed({
  get: () => props.current,
  set: (v: string) => router.visit(`/patch/${v}`),
})
const patchOptions = computed(() => props.patches.map((p) => ({ value: p, label: p })))

const pct = (x: number) => `${(x * 100).toFixed(1)}%`
const n = (x: number) => x.toLocaleString('en-US')
const champHref = (id: number) => (props.slugs[id] ? `/champions/${props.slugs[id]}` : null)
const stat = (id: number) => props.stats?.byChampion[id] ?? null
const abilityIcon = (champion: number, key: string) =>
  `/cdn/ability/${champion}-${key.toLowerCase()}.png`
const blockName = (key: string, title: string) =>
  key === 'base' ? title : `${key === 'P' ? 'Passive' : key} · ${title}`

/* ── The section tabs follow the scroll ────────────────────────── */
const TABS = computed(() => {
  const notes = props.notes
  if (!notes) return []
  return [
    { id: 'champions', label: 'Champions', n: notes.champions.length },
    { id: 'items', label: 'Items', n: notes.items.length },
    {
      id: 'aram',
      label: 'ARAM: Mayhem',
      n: (notes.aram?.champions.length ?? 0) + (notes.aram?.augments.length ?? 0),
    },
    { id: 'skins', label: 'Skins', n: notes.skins.length },
    { id: 'bugs', label: 'Bug fixes', n: notes.bugs.length },
  ].filter((t) => t.n > 0)
})
const active = ref('champions')
let observer: IntersectionObserver | undefined
onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      const seen = entries.filter((e) => e.isIntersecting).map((e) => e.target.id)
      if (seen.length) active.value = seen[0]
    },
    { rootMargin: '-30% 0px -60% 0px' }
  )
  for (const t of TABS.value) {
    const el = document.getElementById(t.id)
    if (el) observer.observe(el)
  }
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <Head :title="notes ? `Patch ${current} notes` : `Patch ${current}`" />
  <SiteLayout :sub="sub.length ? sub : null" patch-on>
    <div class="wrap">
      <section class="pn-hero">
        <nav class="crumbs" aria-label="Breadcrumb">
          <Link href="/patch" prefetch>Patch notes</Link><Icon name="chevr" :size="12" /><span
            class="t1"
            aria-current="page"
            >{{ current }}</span
          >
        </nav>
        <h1 class="pn-num num">{{ current }}</h1>

        <template v-if="notes">
          <p class="body pn-lead">
            Every champion, item and ARAM: Mayhem change of patch {{ current }}, the new skins and
            the bug fixes, with how each champion is doing since, {{ rank }}.
          </p>
          <div class="pn-bar">
            <a class="btn sm" :href="notes.source" target="_blank" rel="noreferrer"
              >Riot's notes<Icon name="external" :size="16"
            /></a>
            <Select
              v-if="patchOptions.length > 1"
              v-model="patchModel"
              :options="patchOptions"
              width="9rem"
              class="pn-sel"
            />
            <span v-if="counts" class="meta pn-sum">
              <b class="t2">{{ counts.up }}</b> buffs, <b class="t2">{{ counts.down }}</b> nerfs,
              <b class="t2">{{ counts.mix }}</b> adjusted, <b class="t2">{{ counts.items }}</b>
              items
            </span>
          </div>

          <div class="pn-strip">
            <a
              v-for="c in notes.champions"
              :key="c.id"
              :href="`#c${c.id}`"
              class="pn-s"
              :title="c.name"
              ><Frame :src="champIcon(c.id)" :width="52" :alt="c.name" eager /><ChangeMark
                :kind="c.kind"
            /></a>
            <a
              v-for="it in notes.items"
              :key="`i${it.id}`"
              :href="`#i${it.id}`"
              class="pn-s it"
              :title="it.name"
              ><span class="pn-ii"><img :src="`/cdn/item/${it.id}.png`" :alt="it.name" /></span
              ><ChangeMark :kind="it.kind"
            /></a>
          </div>

          <nav class="pn-tabs" aria-label="Sections">
            <a
              v-for="t in TABS"
              :key="t.id"
              :href="`#${t.id}`"
              :class="{ on: active === t.id }"
              @click="active = t.id"
              >{{ t.label }}<span class="n num">{{ t.n }}</span></a
            >
          </nav>
        </template>
      </section>

      <template v-if="notes">
        <section id="champions" class="sec pn-first" aria-labelledby="pn-champions">
          <div class="sec-h">
            <h2 id="pn-champions" class="h2">Champions</h2>
            <span v-if="stats" class="meta"
              >Win and pick rate in each champion's main role since the patch, {{ rank }}</span
            >
          </div>
          <div class="col pn-list">
            <article v-for="c in notes.champions" :id="`c${c.id}`" :key="c.id" class="card pn-c">
              <header class="pn-h">
                <component
                  :is="champHref(c.id) ? Link : 'span'"
                  class="pn-ch2"
                  :href="champHref(c.id) ?? undefined"
                  ><Frame :src="champIcon(c.id)" :width="44" :alt="c.name" /><ChangeMark
                    :kind="c.kind"
                /></component>
                <component
                  :is="champHref(c.id) ? Link : 'span'"
                  class="h2"
                  :href="champHref(c.id) ?? undefined"
                  >{{ c.name }}</component
                >
                <ChangeMark :kind="c.kind" pill />
                <span v-if="stat(c.id)" class="pn-st">
                  <span class="rl9"
                    ><RoleIcon :lane="positionOf(stat(c.id)!.position).lane" :size="14" />{{
                      positionOf(stat(c.id)!.position).label
                    }}</span
                  >
                  <span
                    ><b>{{ pct(stat(c.id)!.win) }}</b
                    >Win rate</span
                  >
                  <span
                    ><b>{{ pct(stat(c.id)!.pick) }}</b
                    >Pick rate</span
                  >
                  <span
                    ><b>{{ n(stat(c.id)!.games) }}</b
                    >Games</span
                  >
                </span>
              </header>
              <div v-for="b in c.blocks" :key="b.key + b.title" class="pn-a">
                <div class="pn-ah">
                  <span v-if="b.key === 'base'" class="pn-ai base"
                    ><Icon name="sliders" :size="18"
                  /></span>
                  <span v-else class="pn-ai"
                    ><img :src="abilityIcon(c.id, b.key)" alt="" width="32" height="32" /><i>{{
                      b.key
                    }}</i></span
                  >
                  <span class="h4">{{ blockName(b.key, b.title) }}</span>
                </div>
                <NoteLines :lines="b.lines" :kind="c.kind" />
              </div>
            </article>
          </div>
        </section>

        <section v-if="notes.items.length" id="items" class="sec" aria-labelledby="pn-items">
          <div class="sec-h"><h2 id="pn-items" class="h2">Items</h2></div>
          <div class="col pn-list">
            <article v-for="it in notes.items" :id="`i${it.id}`" :key="it.id" class="card pn-c">
              <header class="pn-h">
                <span class="pn-ii lg"><img :src="`/cdn/item/${it.id}.png`" alt="" /></span>
                <span class="h2">{{ it.name }}</span>
                <ChangeMark :kind="it.kind" pill />
              </header>
              <div class="pn-a"><NoteLines :lines="it.lines" :kind="it.kind" /></div>
            </article>
          </div>
        </section>

        <section v-if="notes.aram" id="aram" class="sec" aria-labelledby="pn-aram">
          <div class="sec-h">
            <h2 id="pn-aram" class="h2">ARAM: Mayhem</h2>
            <span v-if="notes.aram.note" class="meta">{{ notes.aram.note }}</span>
          </div>
          <div class="col pn-list">
            <article v-for="c in notes.aram.champions" :key="c.id" class="card pn-c">
              <header class="pn-h">
                <span class="pn-ch2"
                  ><Frame :src="champIcon(c.id)" :width="44" :alt="c.name" /><ChangeMark
                    :kind="c.kind"
                /></span>
                <span class="h2">{{ c.name }}</span>
                <ChangeMark :kind="c.kind" pill />
                <span v-if="c.scope" class="meta pn-scope">{{ c.scope }}</span>
              </header>
              <div class="pn-a"><NoteLines :lines="c.lines" :kind="c.kind" /></div>
            </article>
          </div>
          <div v-if="notes.aram.augments.length" class="pn-augs">
            <div v-for="a in notes.aram.augments" :key="a.name" class="pn-aug">
              <div class="pn-ah">
                <span class="pn-ag"
                  ><img v-if="a.id" :src="`/cdn/augment/${a.id}.png`" alt="" /><span v-else>{{
                    a.name[0]
                  }}</span></span
                >
                <span class="h4">{{ a.name }}</span>
                <ChangeMark :kind="a.kind" pill />
              </div>
              <NoteLines :lines="a.lines" :kind="a.kind" />
            </div>
          </div>
        </section>

        <section v-if="notes.skins.length" id="skins" class="sec" aria-labelledby="pn-skins">
          <div class="sec-h">
            <h2 id="pn-skins" class="h2">Skins and chromas</h2>
            <span class="meta">Released this patch</span>
          </div>
          <div class="pn-sks">
            <div v-for="s in notes.skins" :key="`${s.champion}-${s.skin}`" class="pn-sk">
              <Frame :src="skinSplash(s.champion, s.skin)" width="100%" height="auto" size="l" />
              <div class="pn-skr">
                <div>
                  <span class="h3">{{ s.name }}</span>
                  <span class="meta">{{ s.champions }}</span>
                </div>
                <ChangeMark kind="new" pill />
              </div>
            </div>
          </div>
          <p v-if="notes.chromas.length" class="meta pn-chromas">
            Chromas: {{ notes.chromas.join(', ') }}
          </p>
        </section>

        <section v-if="notes.bugs.length" id="bugs" class="sec pn-last" aria-labelledby="pn-bugs">
          <div class="sec-h"><h2 id="pn-bugs" class="h2">Bug fixes</h2></div>
          <ul class="card pn-bugs">
            <li v-for="(b, i) in notes.bugs" :key="i">
              <Icon name="check" :size="16" /><span>{{ b }}</span>
            </li>
          </ul>
        </section>
      </template>

      <section v-else class="sec pn-last">
        <div class="card">
          <EmptyState
            icon="news"
            :title="`No notes for patch ${current} on invade.lol`"
            :line="
              patches.length
                ? `Riot's own notes have every change. The patches written up here: ${patches.join(', ')}.`
                : `Riot's own notes have every change.`
            "
          >
            <div class="row" style="gap: 10px; justify-content: center">
              <a
                class="btn sm"
                href="https://www.leagueoflegends.com/en-us/news/game-updates/"
                target="_blank"
                rel="noreferrer"
                >Riot's notes<Icon name="external" :size="16"
              /></a>
              <Link v-if="patches.length" class="btn sm pri" :href="`/patch/${patches[0]}`"
                >Patch {{ patches[0] }}</Link
              >
            </div>
          </EmptyState>
        </div>
      </section>
    </div>
  </SiteLayout>
</template>
