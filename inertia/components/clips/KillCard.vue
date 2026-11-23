<script setup lang="ts">
import { computed } from 'vue'
import Icon from '../ui/Icon.vue'
import { abilityIcon, champIcon, championName } from '../../lib/assets.js'
import { gameClock } from '../../lib/clips.js'
import type { ClipEvent, DamageLine, KillRecap } from '../../lib/clip_types.js'

/**
 * The card of the action under the clip's playhead: who did what to whom and when. A kill read
 * from Riot's timeline adds its damage recap both ways, by ability (the clip author's bars in
 * violet, the other side's in grey). "x3" counts the hits that landed, not the casts.
 */
const props = defineProps<{ event: ClipEvent; recap: KillRecap | null; author: number }>()

const MULTI: Record<string, string> = {
  2: 'Double kill',
  3: 'Triple kill',
  4: 'Quadra kill',
  5: 'Penta kill',
}
const headline = computed(() => {
  const e = props.event
  const victim = e.victim ? championName(e.victim) : null
  switch (e.kind) {
    case 'kill':
      return `${e.assisters.length ? 'Kill' : 'Solo kill'}${victim ? ` on ${victim}` : ''}`
    case 'multikill':
      return MULTI[e.detail ?? ''] ?? 'Multikill'
    case 'first_blood':
      return `First blood${victim ? ` on ${victim}` : ''}`
    case 'death':
      return `Death${e.killer ? ` to ${championName(e.killer)}` : ''}`
    case 'assist':
      return `Assist${victim ? ` on ${victim}` : ''}`
    case 'ace':
      return 'Ace'
    default:
      return e.detail ?? 'Objective'
  }
})
const line = computed(() => {
  const bounty = props.recap?.bounty
  return `${gameClock(props.event.t)} in the game${bounty ? `, ${bounty} gold` : ''}`
})

/** The two sides of the recap: the killer's damage, then the victim's. */
const sides = computed(() => {
  const r = props.recap
  if (!r) return []
  const total = (lines: DamageLine[]) => lines.reduce((sum, l) => sum + l.damage, 0)
  return [
    { champion: r.killer, lines: r.dealt, total: total(r.dealt), mine: r.killer === props.author },
    { champion: r.victim, lines: r.taken, total: total(r.taken), mine: r.victim === props.author },
  ].map((side) => ({ ...side, top: Math.max(1, ...side.lines.map((l) => l.damage)) }))
})
const icon = (champion: number, source: string) =>
  ['q', 'w', 'e', 'r', 'p'].includes(source) ? abilityIcon(champion, source) : null
const n = (v: number) => Math.round(v).toLocaleString('en-US')
</script>

<template>
  <div class="clp-card">
    <div class="clp-duel">
      <span class="clp-faces">
        <img v-if="event.killer" :src="champIcon(event.killer)" alt="" />
        <Icon name="swords" :size="14" />
        <img v-if="event.victim" :src="champIcon(event.victim)" alt="" />
      </span>
      <span class="clp-duel-t">
        <b>{{ headline }}</b>
        <span class="meta num">{{ line }}</span>
      </span>
    </div>
    <div v-if="sides.length" class="clp-recap">
      <div v-for="side in sides" :key="side.champion" class="clp-side" :class="{ mine: side.mine }">
        <div class="clp-side-h">
          <img :src="champIcon(side.champion)" alt="" />
          <b>{{ championName(side.champion) }}</b>
          <span class="meta num">{{ n(side.total) }} damage</span>
        </div>
        <div v-for="l in side.lines" :key="l.source" class="clp-dmg">
          <span class="clp-src">
            <img
              v-if="icon(side.champion, l.source)"
              :src="icon(side.champion, l.source)!"
              alt=""
            />
            <span v-else class="clp-src-i"
              ><Icon :name="l.source === 'attack' ? 'swords' : 'spark'" :size="12"
            /></span>
            {{ l.name }}<b v-if="l.hits > 1" class="num"> x{{ l.hits }}</b>
          </span>
          <i class="clp-track-bar"><i :style="{ width: `${(l.damage / side.top) * 100}%` }"></i></i>
          <span class="num">{{ n(l.damage) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
