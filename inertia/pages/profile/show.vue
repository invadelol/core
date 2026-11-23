<script setup lang="ts">
import { computed, ref } from 'vue'
import { Head, Link, router } from '@inertiajs/vue3'
import SiteLayout from '../../components/SiteLayout.vue'
import Tabs from '../../components/ui/Tabs.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import ProGames from '../../components/esports/pro/ProGames.vue'
import ProChampions from '../../components/esports/pro/ProChampions.vue'
import ProfileHead from '../../components/invade_profile/ProfileHead.vue'
import ClipCards from '../../components/invade_profile/ClipCards.vue'
import FavoriteFour from '../../components/invade_profile/FavoriteFour.vue'
import SignatureChampions from '../../components/invade_profile/SignatureChampions.vue'
import BuildList from '../../components/invade_profile/BuildList.vue'
import FriendRows from '../../components/invade_profile/FriendRows.vue'
import SeasonLine from '../../components/invade_profile/SeasonLine.vue'
import FriendsTab from '../../components/invade_profile/FriendsTab.vue'
import SkinsTab from '../../components/invade_profile/SkinsTab.vue'
import CustomizePanel from '../../components/invade_profile/CustomizePanel.vue'
import FavoritesPicker from '../../components/invade_profile/FavoritesPicker.vue'
import CareerList from '../../components/invade_profile/CareerList.vue'
import { useViewer } from '../../lib/account.js'
import { browserWrite } from '../../lib/browser_write.js'
import { profilePath } from '../../lib/format.js'
import { copySettings, overviewColumns, previewHead } from '../../lib/profile_view.js'
import type { ClipCard, FriendCard, ProfileBuild } from '../../lib/profile_types.js'
import type { ProfileSkinsData, SkinCard } from '../../lib/skin_types.js'
import type {
  CustomizeData,
  OverviewData,
  ProfileHead as Head_,
  ProfileSettings,
  ProfileTab,
  ShowcaseKey,
} from '../../lib/invade_profile.js'
import type {
  ChampionNames,
  ProBuild,
  ProGame,
  StoredGame,
} from '../../components/esports/pro/types.js'
import '../../css/skins.css'
import '../../css/esports.css'
import '../../css/pro_page.css'
import '../../css/invade-profile.css'

/**
 * `/u/<handle>`: an Invade profile. The head (who they are, their League accounts) on every tab;
 * the Overview's showcases in the owner's order; Clips, Skins, Builds, Friends; a verified pro's
 * solo queue, champions and career. The owner customises it in place: the panel beside the page
 * previews every choice before it is saved.
 */
const props = defineProps<{
  head: Head_
  tab: ProfileTab
  tabs: ProfileTab[]
  overview: OverviewData | null
  clips: { pinned: ClipCard | null; clips: ClipCard[] } | null
  skins: ProfileSkinsData | null
  builds: ProfileBuild[] | null
  friends: { friends: FriendCard[]; playingNow: FriendCard[] } | null
  pro: {
    slug: string
    games: ProGame[]
    stored: StoredGame[]
    builds: ProBuild[]
    record: { games: number; wins: number; kills: number; deaths: number; assists: number }
    teams: {
      team: { id: string; slug: string; name: string }
      league: { slug: string; code: string } | null
      current: boolean
      joinedAt: string | null
      leftAt: string | null
    }[]
    names: ChampionNames
  } | null
  customize: CustomizeData | null
  names: Record<number, string>
}>()

const { viewer } = useViewer()

/* ── Customize ─────────────────────────────────────────────────── */
const editing = ref(false)
const draft = ref<ProfileSettings | null>(null)
const saving = ref(false)
const error = ref('')
const panel = ref<InstanceType<typeof CustomizePanel> | null>(null)

function startEditing() {
  if (!props.customize) return
  if (editing.value) return
  draft.value = copySettings(props.customize.settings)
  error.value = ''
  editing.value = true
  if (props.tab !== 'overview') router.visit(`/u/${props.head.handle}`, { preserveScroll: true })
}
function cancel() {
  editing.value = false
  draft.value = null
}
async function save(settings: ProfileSettings) {
  saving.value = true
  error.value = ''
  try {
    await browserWrite('PUT', '/api/profile', settings)
    editing.value = false
    draft.value = null
    router.reload()
  } catch (failure) {
    error.value = (failure as Error).message
  } finally {
    saving.value = false
  }
}

const head = computed(() =>
  editing.value && draft.value && props.customize
    ? previewHead(props.head, draft.value, props.customize)
    : props.head
)

/* ── Tabs ──────────────────────────────────────────────────────── */
const LABELS: Record<ProfileTab, string> = {
  overview: 'Overview',
  clips: 'Clips',
  skins: 'Skins',
  builds: 'Builds',
  friends: 'Friends',
  solo: 'Solo queue',
  champions: 'Champions',
  career: 'Career',
}
const tabItems = computed(() =>
  props.tabs.map((key) => {
    const counts: Partial<Record<ProfileTab, number>> = {
      ...props.head.counts,
      solo: props.pro?.games.length,
      champions: props.pro?.builds.length,
      career: props.pro?.teams.length,
    }
    return {
      key,
      label: LABELS[key],
      href: `/u/${props.head.handle}${key === 'overview' ? '' : `/${key}`}`,
      count: key === 'overview' ? null : (counts[key] ?? null),
    }
  })
)

/* ── Overview ──────────────────────────────────────────────────── */
const showcases = computed<ShowcaseKey[]>(() =>
  editing.value && draft.value
    ? draft.value.showcases.filter((s) => s.on).map((s) => s.key)
    : (props.overview?.showcases ?? [])
)
const has = (key: ShowcaseKey) => {
  const o = props.overview
  if (!o) return false
  switch (key) {
    case 'pinned':
      return o.pinned !== null
    case 'favorites':
      return o.favorites.length > 0
    case 'signature':
      return o.signature.length > 0
    case 'clips':
      return o.clips.length > 0
    case 'builds':
      return o.builds.length > 0
    case 'friends':
      return o.friends.length > 0
    case 'season':
      return o.season !== null
  }
}
const columns = computed(() => overviewColumns(showcases.value.filter(has)))
const mainPlate = computed(() => props.head.plates.find((p) => p.main) ?? null)
const mainPath = computed(() =>
  mainPlate.value ? profilePath(mainPlate.value.gameName, mainPlate.value.tagLine) : null
)

/* ── Favourite four ────────────────────────────────────────────── */
const picking = ref(false)
async function saveFavorites(ids: number[]) {
  if (!props.customize) return
  await save({ ...props.customize.settings, favorites: ids })
  if (!error.value) picking.value = false
}
const currentFavorites = computed<SkinCard[]>(() => props.skins?.favorites ?? [])
</script>

<template>
  <Head :title="`${head.name} (@${head.handle})`" />
  <SiteLayout>
    <div class="pf" :class="{ editing }" :data-accent="head.accent">
      <div class="pf-stage">
        <div class="wrap pf-wrap">
          <ProfileHead
            :head="head"
            :editing="editing"
            :names="names"
            @edit="startEditing"
            @backdrop="panel?.focusBackdrop()"
          />
          <div class="pf-tabs">
            <Tabs :items="tabItems" :active="tab" label="Profile" preserve-scroll />
          </div>

          <!-- Overview: the showcases in the owner's order, in two columns. -->
          <template v-if="tab === 'overview' && !head.pro">
            <div v-if="columns.wide.length + columns.narrow.length" class="pf-grid">
              <div v-for="(column, c) in [columns.wide, columns.narrow]" :key="c" class="pf-col">
                <template v-for="key in column" :key="key">
                  <section v-if="key === 'pinned' && overview?.pinned" class="pf-sec">
                    <h2 class="pf-h">Pinned clip</h2>
                    <ClipCards :clips="[overview.pinned]" :names="names" pinned />
                  </section>
                  <section v-else-if="key === 'favorites'" class="pf-sec">
                    <h2 class="pf-h">Favourite four</h2>
                    <FavoriteFour :skins="overview!.favorites" :big="c === 0" />
                  </section>
                  <section v-else-if="key === 'signature'" class="pf-sec">
                    <h2 class="pf-h">Signature champions</h2>
                    <SignatureChampions :champions="overview!.signature" :puuid-path="mainPath" />
                  </section>
                  <section v-else-if="key === 'clips'" class="pf-sec">
                    <div class="pf-hr">
                      <h2 class="pf-h">Clips</h2>
                      <Link class="meta" :href="`/u/${head.handle}/clips`"
                        >All {{ head.counts.clips }}</Link
                      >
                    </div>
                    <ClipCards :clips="overview!.clips" :names="names" />
                  </section>
                  <section v-else-if="key === 'builds'" class="pf-sec">
                    <div class="pf-hr">
                      <h2 class="pf-h">Builds</h2>
                      <Link class="meta" :href="`/u/${head.handle}/builds`"
                        >All {{ head.counts.builds }}</Link
                      >
                    </div>
                    <BuildList :builds="overview!.builds" :names="names" compact />
                  </section>
                  <section v-else-if="key === 'friends'" class="pf-sec">
                    <div class="pf-hr">
                      <h2 class="pf-h">
                        Friends<span class="n num">{{ head.counts.friends }}</span>
                      </h2>
                      <Link class="meta" :href="`/u/${head.handle}/friends`"
                        >All {{ head.counts.friends }}</Link
                      >
                    </div>
                    <FriendRows :friends="overview!.friends" :names="names" />
                  </section>
                  <section v-else-if="key === 'season' && overview?.season" class="pf-sec">
                    <div class="pf-hr">
                      <h2 class="pf-h">This season</h2>
                    </div>
                    <SeasonLine :season="overview.season" />
                  </section>
                </template>
              </div>
            </div>
            <EmptyState
              v-else
              :title="
                head.owner
                  ? 'Your profile is ready to fill'
                  : `${head.name} has nothing to show yet`
              "
              :line="
                head.owner
                  ? 'Post a clip from the Invade app, rate your skins, or open Edit profile to choose what shows here.'
                  : 'Clips, skins and builds they share show up here.'
              "
              icon="user"
            />
          </template>

          <!-- A verified pro: their solo queue, champions and career, from the pro data. -->
          <template v-if="pro && (tab === 'overview' || tab === 'solo')">
            <div class="pf-grid" :class="{ single: tab === 'solo' }">
              <section class="pf-sec">
                <ProGames
                  :games="pro.games"
                  :stored="pro.stored"
                  :names="pro.names"
                  :slug="pro.slug"
                  :limit="tab === 'overview' ? 8 : undefined"
                  :items="tab === 'solo'"
                  :faces="tab === 'solo' ? 6 : 0"
                />
              </section>
              <div v-if="tab === 'overview'" class="pf-col">
                <section v-if="pro.builds.length" class="pf-sec">
                  <div class="pf-hr">
                    <h2 class="pf-h">Champions, 30 days</h2>
                    <Link class="meta" :href="`/u/${head.handle}/champions`"
                      >All {{ pro.builds.length }}</Link
                    >
                  </div>
                  <SignatureChampions
                    :champions="
                      pro.builds.slice(0, 3).map((b) => ({
                        championId: b.champion,
                        name: pro!.names[b.champion]?.[0] ?? '',
                        games: b.games,
                        wins: b.wins,
                      }))
                    "
                    :puuid-path="null"
                  />
                </section>
                <section v-if="pro.teams.length" class="pf-sec">
                  <h2 class="pf-h">Career</h2>
                  <CareerList :teams="pro.teams" />
                </section>
              </div>
            </div>
          </template>
          <ProChampions
            v-if="pro && tab === 'champions'"
            :builds="pro.builds"
            :names="pro.names"
            :pro="head.name"
            :base="`/u/${head.handle}`"
          />
          <section v-if="pro && tab === 'career'" class="pf-sec" style="max-width: 640px">
            <CareerList :teams="pro.teams" />
          </section>

          <!-- Clips -->
          <template v-if="tab === 'clips' && clips">
            <section v-if="clips.pinned || clips.clips.length" class="pf-col">
              <div v-if="clips.pinned" class="pf-sec" style="max-width: 780px">
                <h2 class="pf-h">Pinned clip</h2>
                <ClipCards :clips="[clips.pinned]" :names="names" pinned />
              </div>
              <div class="pf-sec">
                <div class="pf-hr">
                  <h2 class="pf-h">
                    Clips<span class="n"
                      >One clip per game, picked by {{ head.owner ? 'you' : head.name }}</span
                    >
                  </h2>
                </div>
                <ClipCards :clips="clips.clips" :names="names" detailed />
              </div>
            </section>
            <EmptyState
              v-else
              title="No clips yet"
              :line="
                head.owner
                  ? 'Post a moment from the Invade app after a game: it shows up here.'
                  : `${head.name} has not posted a clip yet.`
              "
              icon="film"
            />
          </template>

          <!-- Skins -->
          <SkinsTab
            v-if="tab === 'skins' && skins"
            :skins="skins"
            :owner="head.owner"
            :signed-in="Boolean(viewer)"
            @change="picking = true"
          />

          <!-- Builds -->
          <template v-if="tab === 'builds' && builds">
            <section v-if="builds.length" class="pf-sec">
              <div class="pf-hr">
                <h2 class="pf-h">
                  {{ head.owner ? 'Your builds' : 'Builds'
                  }}<span class="n num">{{ builds.length }}</span>
                </h2>
              </div>
              <BuildList :builds="builds" :names="names" />
            </section>
            <EmptyState
              v-else
              title="No builds yet"
              :line="
                head.owner
                  ? 'Builds you make and share in the Invade app show up here.'
                  : `${head.name} has not shared a build yet.`
              "
              icon="route"
            />
          </template>

          <!-- Friends -->
          <FriendsTab
            v-if="tab === 'friends' && friends"
            :friends="friends.friends"
            :playing-now="friends.playingNow"
            :names="names"
            :owner="head.owner"
          />
        </div>

        <CustomizePanel
          v-if="editing && draft && customize"
          ref="panel"
          v-model="draft"
          :customize="customize"
          :premium="head.premium"
          :saving="saving"
          :error="error"
          @save="save(draft)"
          @cancel="cancel"
        />
      </div>
    </div>
    <FavoritesPicker
      v-if="picking && customize"
      :current="currentFavorites"
      :saving="saving"
      :error="error"
      @save="saveFavorites"
      @close="picking = false"
    />
  </SiteLayout>
</template>
