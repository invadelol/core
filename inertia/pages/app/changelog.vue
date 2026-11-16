<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Head, Link } from '@inertiajs/vue3'
import SiteLayout from '../../components/SiteLayout.vue'
import Masthead from '../../components/ui/Masthead.vue'
import Icon from '../../components/ui/Icon.vue'
import RunText from '../../components/changelog/RunText.vue'
import type { ChangelogRelease } from '../../lib/changelog.js'
import '../../css/changelog-facet.css'

/**
 * /app/changelog: every release of the desktop app, newest first (Facet). Each version on the
 * left with its day, on the right its marked changes as headlines with their text, then the
 * lists under New, Changed, Removed and Fixed. The older ones open on demand.
 * /app/changelog/0.3.2 is the same page, opened at that version.
 */
const props = defineProps<{ releases: ChangelogRelease[]; version: string | null }>()

/** Releases shown before "Older releases". */
const FIRST = 6
const at = computed(() => props.releases.findIndex((r) => r.version === props.version))
const all = ref(at.value >= FIRST)
/** Every release is in the page the server sends (crawlers read them all); the older ones show on demand. */
const hidden = (i: number) => !all.value && i >= FIRST
const latest = computed(() => props.releases.find((r) => r.date) ?? null)

onMounted(() => {
  if (!props.version || at.value <= 0) return
  document.getElementById(`v${props.version}`)?.scrollIntoView({ block: 'start' })
})
</script>

<template>
  <Head :title="version ? `Invade ${version}` : 'Invade changelog'" />
  <SiteLayout>
    <div class="wrap">
      <Masthead
        title="Changelog"
        :crumbs="[{ label: 'Desktop app', href: '/app' }, { label: 'Changelog' }]"
        meta="Every release of the desktop app, newest first"
      >
        <template v-if="latest" #end>
          <Link class="btn pri" href="/app#download" prefetch
            ><Icon name="download" :size="16" />Download {{ latest.version }}</Link
          >
        </template>
      </Masthead>

      <section
        v-for="(r, i) in releases"
        v-show="!hidden(i)"
        :id="`v${r.version}`"
        :key="r.version"
        class="rel"
        :aria-labelledby="`rel-${r.version}`"
      >
        <div class="rel-side">
          <h2 :id="`rel-${r.version}`" class="rel-h">
            <Link class="vtag" :href="`/app/changelog/${r.version}`" preserve-scroll>{{
              r.version
            }}</Link>
          </h2>
          <p class="meta rel-day">{{ r.day ?? 'Coming next' }}</p>
        </div>
        <div class="min-w-0">
          <div v-for="f in [...(r.hero ? [r.hero] : []), ...r.features]" :key="f.key" class="relf">
            <h3 v-if="f.title" class="h3">{{ f.title.replace(/\.$/, '') }}</h3>
            <p><RunText :runs="f.runs" /></p>
          </div>
          <div v-for="g in r.groups" :key="g.title" class="rel-g">
            <span class="lab">{{ g.title }}</span>
            <ul class="relg" :class="{ quiet: g.quiet }">
              <li v-for="item in g.items" :key="item.key">
                <Icon name="check" :size="16" /><span><RunText :runs="item.runs" /></span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <button
        v-if="!all && releases.length > FIRST"
        type="button"
        class="btn rel-more"
        @click="all = true"
      >
        Older releases<Icon name="chev" :size="16" />
      </button>
      <div class="rel-end" />
    </div>
  </SiteLayout>
</template>
