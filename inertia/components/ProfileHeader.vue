<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { Check, Copy, RefreshCw } from 'lucide-vue-next'
import { Link } from '@inertiajs/vue3'
import { RoleIcon, useFormat } from '@invadelol/ui'
import {
  positionName,
  rankFromCore,
  rankLabel,
  tierColor,
  type Position,
} from '@invadelol/ui/logic'
import { profileIcon, regionLabel } from '../lib/assets.js'
import { profilePath } from '../lib/format.js'
import type { Rank, Summoner } from '../lib/types.js'

const props = defineProps<{
  summoner: Summoner
  viewCount: number | null
  isSyncing: boolean
  syncMessage: string | null
  lastGameMs: number | null
  /** The solo queue rank, when the player has one. */
  rank?: Rank | null
  /** Where the player plays, most played first. */
  roles?: Position[]
  /** Set when the account belongs to a professional player. */
  pro?: {
    slug: string
    name: string
    staff: boolean
    role: string | null
    team: { id: string; slug: string; name: string; shortName: string | null } | null
  } | null
}>()

defineEmits<{ sync: []; share: [] }>()

const { ago } = useFormat()
const path = computed(() => profilePath(props.summoner.gameName, props.summoner.tagLine))

const roleLine = computed(() => {
  const list = (props.roles ?? []).slice(0, 2).map((r) => positionName(r))
  return list.map((r, i) => (i ? r.toLowerCase() : r)).join(', ')
})
const rankName = computed(() =>
  props.rank?.tier ? rankLabel(rankFromCore(props.rank), false) : null
)

/** The Riot ID as the client's friend search takes it. */
const copied = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | undefined
async function copyRiotId() {
  try {
    await navigator.clipboard.writeText(`${props.summoner.gameName}#${props.summoner.tagLine}`)
    copied.value = true
    clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => (copied.value = false), 1600)
  } catch {
    /* No clipboard (insecure context, denied): the name stays selectable. */
  }
}
onBeforeUnmount(() => clearTimeout(copiedTimer))
</script>

<template>
  <!-- Who this is and what you can do: icon with the level, the Riot ID, where they play and
       their rank on one line, then the actions on the right. -->
  <header class="pf">
    <Link :href="path" class="pf-ic" preserve-state preserve-scroll :aria-label="summoner.gameName">
      <img
        :src="profileIcon(summoner.profileIconId)"
        alt=""
        width="92"
        height="92"
        fetchpriority="high"
      />
      <span v-if="summoner.summonerLevel" class="num" :title="`Level ${summoner.summonerLevel}`">{{
        summoner.summonerLevel
      }}</span>
    </Link>

    <div class="pf-id">
      <h1 :title="`${summoner.gameName}#${summoner.tagLine}`">
        <Link :href="path" class="name" preserve-state preserve-scroll
          >{{ summoner.gameName }}<small>#{{ summoner.tagLine }}</small></Link
        >
        <button
          type="button"
          class="iv-btn ghost sm icon-only copy"
          :title="copied ? 'Copied' : 'Copy Riot ID'"
          :aria-label="copied ? 'Copied' : 'Copy Riot ID'"
          @click="copyRiotId"
        >
          <Check v-if="copied" :size="14" />
          <Copy v-else :size="14" />
        </button>
        <span v-if="copied" class="copied" role="status">Copied</span>
      </h1>

      <div class="pf-m num">
        <Link
          v-if="pro"
          :href="`/pro/${pro.slug}`"
          class="pro-tag"
          :title="`${pro.name}${pro.team ? `, ${pro.team.name}` : ''}`"
        >
          <b>{{ pro.staff ? 'Staff' : 'Pro' }}</b>
          <span class="truncate"
            >{{ pro.name
            }}<template v-if="pro.team">, {{ pro.team.shortName || pro.team.name }}</template></span
          >
        </Link>
        <span>{{ regionLabel(summoner.platform) }}</span>
        <template v-if="roles?.length">
          <i />
          <span class="pf-role"><RoleIcon :lane="roles[0]" :size="15" />{{ roleLine }}</span>
        </template>
        <template v-if="rank && rankName">
          <i />
          <span
            ><b :style="{ color: tierColor(rank.tier) }">{{ rankName }}</b>
            {{ rank.leaguePoints }} LP</span
          >
        </template>
        <template v-if="lastGameMs">
          <i />
          <span>Last game {{ ago(lastGameMs) }}</span>
        </template>
        <template v-if="viewCount">
          <i />
          <span>{{ viewCount }} {{ viewCount === 1 ? 'view' : 'views' }}</span>
        </template>
      </div>
    </div>

    <div class="pf-a">
      <button type="button" class="iv-btn primary" :disabled="isSyncing" @click="$emit('sync')">
        <RefreshCw :size="13" :class="{ 'animate-spin': isSyncing }" />
        {{ isSyncing ? 'Updating' : 'Update' }}
      </button>
      <button type="button" class="iv-btn" @click="$emit('share')">Share</button>
      <Link :href="`${path}/compare`" class="iv-btn">Compare</Link>
      <p v-if="syncMessage" class="pf-msg" role="status">{{ syncMessage }}</p>
    </div>
  </header>
</template>

<style scoped>
.pf {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 22px;
  align-items: center;
  padding: 28px 0 18px;
}
.pf-ic {
  position: relative;
  display: block;
  width: 92px;
  height: 92px;
}
.pf-ic img {
  width: 92px;
  height: 92px;
  border-radius: 14px;
  box-shadow: 0 0 0 1px rgb(255 255 255 / 0.12);
}
.pf-ic span {
  position: absolute;
  left: 50%;
  bottom: -8px;
  display: flex;
  align-items: center;
  height: 20px;
  padding: 0 8px;
  transform: translateX(-50%);
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-1);
  background: var(--rd-card-2);
  box-shadow: 0 0 0 1px var(--rd-line);
}
.pf-id {
  min-width: 0;
}
.pf h1 {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 6px;
  margin: 0;
  font-size: 36px;
  font-weight: 650;
  letter-spacing: -0.02em;
  line-height: 1.05;
  color: var(--text-1);
  overflow-wrap: anywhere;
}
.pf h1 small {
  margin-left: 6px;
  font-size: 20px;
  font-weight: 500;
  letter-spacing: -0.01em;
  color: var(--text-3);
}
.name {
  color: inherit;
  text-decoration: none;
}
.name:hover {
  text-decoration: underline;
  text-decoration-color: var(--line-3);
  text-underline-offset: 5px;
}
.copy {
  color: var(--text-3);
}
.copied {
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0;
  color: var(--text-3);
}
.pf-m {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 8px;
  margin-top: 8px;
  font-size: 13px;
  color: var(--text-3);
}
.pf-m > i {
  width: 3px;
  height: 3px;
  border-radius: 9px;
  background: var(--text-4);
}
.pf-m b {
  font-weight: 600;
}
.pf-role {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.pro-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  height: 22px;
  padding: 0 8px 0 3px;
  border-radius: 5px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-1);
  background: var(--surface-3);
  text-decoration: none;
}
.pro-tag:hover {
  background: var(--surface-4);
}
.pro-tag b {
  display: inline-flex;
  align-items: center;
  height: 16px;
  padding: 0 5px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
  background: var(--surface-4);
}
.pf-a {
  position: relative;
  display: flex;
  gap: 8px;
}
.pf-a .iv-btn {
  height: 36px;
  padding: 0 16px;
}
.pf-msg {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  margin: 0;
  font-size: 12px;
  white-space: nowrap;
  color: var(--text-2);
}

@media (max-width: 720px) {
  .pf {
    grid-template-columns: auto minmax(0, 1fr);
    gap: 16px 18px;
    padding: 20px 0 14px;
  }
  .pf-ic,
  .pf-ic img {
    width: 72px;
    height: 72px;
  }
  .pf h1 {
    font-size: 26px;
  }
  .pf h1 small {
    font-size: 16px;
    margin-left: 4px;
  }
  .pf-a {
    grid-column: 1 / -1;
    flex-wrap: wrap;
  }
  .pf-a .iv-btn.primary {
    flex: 1;
  }
  .pf-msg {
    position: static;
    flex-basis: 100%;
  }
}
</style>
