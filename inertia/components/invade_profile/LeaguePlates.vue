<script setup lang="ts">
import { computed } from 'vue'
import { Link } from '@inertiajs/vue3'
import RankEmblem from '../ui/RankEmblem.vue'
import FormStrip from '../ui/FormStrip.vue'
import VioletLine from '../ui/VioletLine.vue'
import { champIcon, regionLabel } from '../../lib/assets.js'
import { tierColor } from '../../lib/board.js'
import { profilePath } from '../../lib/format.js'
import { rankWords } from '../../lib/ladders.js'
import type { LeaguePlate, ProPlate } from '../../lib/invade_profile.js'

/**
 * The League accounts under the bio, each opening its League profile. A person's: the main one lit
 * (rank, its 30-day LP line, three champions), the others with their last results. A verified
 * pro's: the two best ranked accounts with their peak and record, the others in one well.
 */
const props = defineProps<{
  plates: LeaguePlate[]
  pro?: ProPlate[] | null
  names: Record<number, string>
}>()

const proRanked = computed(() => (props.pro ?? []).filter((a) => a.tier).slice(0, 2))
const proRest = computed(() => (props.pro ?? []).filter((a) => !proRanked.value.includes(a)))
const count = computed(() =>
  props.pro ? proRanked.value.length + (proRest.value.length ? 1 : 0) : props.plates.length
)
const signed = (n: number) => `${n > 0 ? '+' : ''}${n}`
const record = (wins: number, losses: number) => `${wins}W ${losses}L`
const rate = (wins: number, losses: number) =>
  wins + losses ? `${Math.round((wins / (wins + losses)) * 100)}%` : ''
</script>

<template>
  <div
    v-if="count"
    class="pf-plates"
    :class="{ one: count === 1, three: count === 3 }"
    role="list"
    aria-label="League accounts"
  >
    <template v-if="!pro">
      <Link
        v-for="p in plates"
        :key="p.puuid"
        role="listitem"
        :href="profilePath(p.gameName, p.tagLine)"
        class="pf-plate"
        :class="p.main ? 'main lit' : 'alt'"
      >
        <div class="pf-pt">
          <span class="pf-em"><RankEmblem :tier="p.rank?.tier" :size="p.main ? 84 : 72" /></span>
          <span class="pf-pid">
            <span class="pf-rk">
              <b :style="tierColor(p.rank?.tier)">{{
                p.rank ? rankWords(p.rank.tier, p.rank.division) : 'Unranked'
              }}</b>
              <span v-if="p.rank" class="num">{{ p.rank.lp }} LP</span>
            </span>
            <span class="pf-rid"
              >{{ p.gameName }}<span>#{{ p.tagLine }}</span></span
            >
            <span v-if="p.main" class="pf-sub">{{ regionLabel(p.platform) }}, main account</span>
            <span v-else-if="p.form.length" class="pf-sub">
              <FormStrip :results="p.form" small />
              <span class="num">{{
                record(p.form.filter(Boolean).length, p.form.filter((w) => !w).length)
              }}</span>
            </span>
            <span v-else class="pf-sub">{{ regionLabel(p.platform) }}</span>
          </span>
          <span v-if="p.main && p.line.length > 1" class="pf-lp">
            <VioletLine :values="p.line.map((l) => l.value)" :height="36" :pad="4" end="" thin />
            <span class="pf-cap num">{{ signed(p.delta ?? 0) }} LP, 30 days</span>
          </span>
          <span v-if="p.champions.length" class="pf-ch">
            <img
              v-for="c in p.champions"
              :key="c"
              :src="champIcon(c)"
              :alt="names[c] ?? ''"
              width="36"
              height="36"
              loading="lazy"
            />
          </span>
        </div>
      </Link>
    </template>

    <template v-else>
      <Link
        v-for="(a, i) in proRanked"
        :key="a.id"
        role="listitem"
        :href="profilePath(a.gameName, a.tagLine)"
        class="pf-plate pro"
        :class="{ lit: i === 0 }"
      >
        <div class="pf-pt">
          <span class="pf-em"><RankEmblem :tier="a.tier" :size="80" /></span>
          <span class="pf-pid">
            <span class="pf-rk">
              <b :style="tierColor(a.tier)">{{ rankWords(a.tier!, a.division) }}</b>
              <span v-if="a.lp !== null" class="num">{{ a.lp.toLocaleString('en-US') }} LP</span>
            </span>
            <span class="pf-rid"
              >{{ a.gameName }}<span>#{{ a.tagLine }}</span></span
            >
            <span class="pf-sub"
              >{{ regionLabel(a.platform) }}{{ i === 0 ? ', best rank' : '' }}</span
            >
          </span>
        </div>
        <div class="pf-ft">
          <span v-if="a.peakTier"
            ><span class="pf-srv">Peak</span>
            <b :style="tierColor(a.peakTier)"
              >{{ rankWords(a.peakTier, a.peakDivision)
              }}{{ a.peakLp !== null ? `, ${a.peakLp.toLocaleString('en-US')} LP` : '' }}</b
            ></span
          >
          <span v-if="a.wins !== null && a.losses !== null" class="num"
            ><b>{{ record(a.wins, a.losses) }}</b
            >{{ rate(a.wins, a.losses) }}</span
          >
        </div>
      </Link>
      <div v-if="proRest.length" role="listitem" class="pf-plate pf-more">
        <span class="pf-srv">{{ proRest.length }} more, unranked</span>
        <ul>
          <li v-for="a in proRest" :key="a.id">
            <Link :href="profilePath(a.gameName, a.tagLine)"
              ><span class="pf-rid"
                >{{ a.gameName }}<span>#{{ a.tagLine }}</span></span
              ><span class="pf-srv">{{ regionLabel(a.platform) }}</span></Link
            >
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>
