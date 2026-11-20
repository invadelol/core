<script setup lang="ts">
import { computed } from 'vue'
import { Head, Link, usePage } from '@inertiajs/vue3'
import SiteLayout from '../components/SiteLayout.vue'
import Icon from '../components/ui/Icon.vue'
import NdText from '../components/new_dawn/NdText.vue'
import NdOverview from '../components/new_dawn/NdOverview.vue'
import NdPosts from '../components/new_dawn/NdPosts.vue'
import NdRumours from '../components/new_dawn/NdRumours.vue'
import { patchSubRow } from '../components/header/sub_art.js'
import {
  NEW_DAWN,
  NEW_DAWN_META,
  NEW_DAWN_TABS,
  RIOT_PAGE_URL,
  TEASER,
  TEASER_URL,
  ndImage,
  type NewDawnTab,
  type VoteTally,
} from '../lib/new_dawn.js'
import '../css/new-dawn.css'

/**
 * `/new-dawn` (Overview), `/new-dawn/posts` (Riot posts) and `/new-dawn/rumours` (Rumours): the
 * hub of Riot's 2027 update, under the patch notes. Riot's dawn still framed at the top with the
 * title (the tab pages keep a shorter one), the three tabs as addresses, then the tab. Everything
 * it says is in lib/new_dawn.ts; the server adds the patches of the sub-row and the votes.
 */
const props = defineProps<{
  tab: NewDawnTab
  patches: string[]
  /** Each open rumour's counts and the visitor's own vote; null when they could not be read. */
  votes: Record<string, VoteTally> | null
}>()

const page = usePage()
const path = computed(() => page.url.split('?')[0].replace(/\/+$/, '') || '/')
const sub = computed(() => patchSubRow(props.patches, path.value))
const small = computed(() => props.tab !== 'overview')
</script>

<template>
  <Head :title="NEW_DAWN_META[tab].title" />
  <SiteLayout :sub="sub" patch-on>
    <div class="wrap nw-wrap">
      <div class="nw-top" :class="{ sm: small }">
        <section class="fr nw-stage" aria-label="League of Legends: New Dawn">
          <img
            class="bg"
            :src="ndImage('dawn-1280')"
            :srcset="`${ndImage('dawn-1280')} 1280w, ${ndImage('dawn-1920')} 1920w`"
            sizes="(max-width: 1280px) 100vw, 1216px"
            alt=""
            width="1280"
            height="533"
            fetchpriority="high"
          />
          <nav class="crumbs" aria-label="Breadcrumb">
            <Link href="/patch" prefetch>Patch notes</Link><Icon name="chevr" :size="12" /><span
              class="t2"
              aria-current="page"
              >New Dawn</span
            >
          </nav>
          <span class="nw-credit"
            ><template v-if="small">Still from Riot's teaser</template
            ><template v-else
              ><span class="nw-lg-only">Stills from Riot's teaser, 14 Nov 2026</span
              ><span class="nw-sm-only">Still from Riot's teaser</span></template
            ></span
          >
        </section>
        <div class="nw-ttl">
          <span class="nw-kick">League of Legends</span>
          <h1 class="nw-h">New Dawn</h1>
          <p class="nw-st"><NdText :parts="small ? NEW_DAWN.leadShort : NEW_DAWN.lead" /></p>
          <div v-if="!small" class="nw-act">
            <a class="btn nw-kb" :href="TEASER_URL" target="_blank" rel="noreferrer"
              ><Icon name="triangle" :size="16" />Watch the teaser<span class="nw-tm">{{
                TEASER.length
              }}</span></a
            >
            <a class="btn nw-kb" :href="RIOT_PAGE_URL" target="_blank" rel="noreferrer"
              ><span class="nw-lg-only">Riot's New Dawn page</span
              ><span class="nw-sm-only">Riot's page</span><Icon name="external" :size="15"
            /></a>
          </div>
        </div>
      </div>

      <div class="nw-tabs">
        <nav class="pn-tabs" aria-label="New Dawn pages">
          <Link
            v-for="t in NEW_DAWN_TABS"
            :key="t.key"
            :href="t.href"
            :class="{ on: t.key === tab }"
            :aria-current="t.key === tab ? 'page' : undefined"
            prefetch
            >{{ t.label }}<span v-if="t.count" class="nw-n">{{ t.count }}</span></Link
          >
        </nav>
        <span class="meta nw-upd"><Icon name="clock" :size="15" />{{ NEW_DAWN.updated }}</span>
      </div>

      <NdOverview v-if="tab === 'overview'" :votes="votes" />
      <NdPosts v-else-if="tab === 'posts'" />
      <NdRumours v-else :votes="votes" />
    </div>
  </SiteLayout>
</template>
