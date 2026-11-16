<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Head, Link, router } from '@inertiajs/vue3'
import SiteLayout from '../../components/SiteLayout.vue'
import Masthead from '../../components/ui/Masthead.vue'
import Icon from '../../components/ui/Icon.vue'
import Frame from '../../components/ui/Frame.vue'
import CardHead from '../../components/ui/CardHead.vue'
import { profileIcon } from '../../lib/assets.js'
import { profilePath } from '../../lib/format.js'
import { recentPlayers, type RecentPlayer } from '../../lib/recent.js'
import '../../css/live.css'

/**
 * `/live`: the live game tool. A Riot ID opens that player's live game (`/Name-TAG/live`), which
 * shows both teams, every lane and who wins it; the players this browser opened lately are one
 * click away. Nothing is asked of Riot until a player is picked.
 */
defineProps<{ description: string }>()
const riotId = ref('')
const error = ref('')
const recent = ref<RecentPlayer[]>([])
onMounted(
  () =>
    (recent.value = recentPlayers()
      .filter((p) => !p.pro && !p.champion)
      .slice(0, 6))
)
function open() {
  const v = riotId.value.trim()
  const at = v.lastIndexOf('#')
  if (at <= 0 || at === v.length - 1) {
    error.value = 'Write the Riot ID as Name#TAG.'
    return
  }
  router.visit(`${profilePath(v.slice(0, at), v.slice(at + 1))}/live`)
}
</script>

<template>
  <Head title="Live game">
    <meta name="description" :content="description" />
  </Head>
  <SiteLayout section="tools">
    <div class="wrap">
      <Masthead
        title="Live game"
        :crumbs="[{ label: 'Tools' }, { label: 'Live game' }]"
        meta="The game a player is in right now: both teams, their ranks, and who wins each lane"
      />
      <form class="card pf-scout lv-find" @submit.prevent="open">
        <span class="h4">Find a live game</span>
        <label class="field" style="flex: 1">
          <Icon name="search" />
          <input
            v-model="riotId"
            type="text"
            placeholder="Name#TAG"
            aria-label="Riot ID"
            autocomplete="off"
            @input="error = ''"
          />
        </label>
        <button class="btn pri" type="submit">Open</button>
      </form>
      <p v-if="error" class="meta" style="margin-top: 10px" role="alert">{{ error }}</p>
      <section v-if="recent.length" class="sec" style="padding-top: 24px">
        <div class="card">
          <CardHead title="Players you opened" icon="clock" />
          <Link
            v-for="p in recent"
            :key="`${p.gameName}#${p.tagLine}`"
            class="lrow"
            :href="`${profilePath(p.gameName, p.tagLine)}/live`"
          >
            <Frame :src="profileIcon(p.profileIconId)" :width="36" size="xs" />
            <span class="col grow" style="min-width: 0">
              <span class="h5 ell"
                >{{ p.gameName }}
                <span class="t3" style="font-weight: 500">#{{ p.tagLine }}</span></span
              >
              <span class="meta">Open their live game</span>
            </span>
            <Icon name="chevr" />
          </Link>
        </div>
      </section>
    </div>
  </SiteLayout>
</template>
