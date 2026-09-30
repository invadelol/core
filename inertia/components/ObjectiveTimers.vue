<script setup lang="ts">
import { Bug, Crown, Flame, Shield } from 'lucide-vue-next'

/**
 * The overlay's objective timers, drawn the way the desktop app draws them (src/components/
 * Objectives.vue and its styles in src/style.css), so the landing page can run the clock.
 * `t` is the game clock in seconds; the parent ticks it.
 */
defineProps<{ t: number }>()

interface Timer {
  key: 'dragon' | 'grubs' | 'baron' | 'baronBuff'
  /** Game time the objective spawns, or the buff runs out. */
  at: number
  /** Seconds a full ring stands for. */
  span: number
  team?: 'ally'
  label: string
}

const timers: Timer[] = [
  { key: 'dragon', at: 64, span: 300, label: 'Dragon' },
  { key: 'grubs', at: 0, span: 240, label: 'Voidgrubs' },
  { key: 'baron', at: 494, span: 360, label: 'Baron' },
  { key: 'baronBuff', at: 132, span: 180, team: 'ally', label: 'Baron buff, your team' },
]
const icons = { dragon: Flame, grubs: Bug, baron: Crown, baronBuff: Crown }

const R = 13
const C = 2 * Math.PI * R
const left = (tm: Timer, now: number) => Math.max(0, tm.at - now)
const ring = (tm: Timer, now: number) => C * (1 - Math.min(1, left(tm, now) / tm.span))
const mmss = (seconds: number) => {
  const s = Math.max(0, Math.floor(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
const up = (tm: Timer, now: number) => !tm.team && tm.at <= now
const soon = (tm: Timer, now: number) => !tm.team && tm.at > now && tm.at - now <= 60

const teams = {
  ally: { dragons: ['#ff6b3d', '#47e0d0'], towers: 3, grubs: 3, barons: 0 },
  enemy: { dragons: ['#3dc6ff'], towers: 1, grubs: 3, barons: 0 },
}
</script>

<template>
  <div class="obj" role="group" aria-label="Objective timers">
    <ul class="obj-pills">
      <li
        v-for="tm in timers"
        :key="tm.key"
        class="obj-pill"
        :class="[tm.key, tm.team, { up: up(tm, t), soon: soon(tm, t) }]"
        :title="tm.label"
      >
        <span class="obj-ring">
          <svg class="obj-arc" viewBox="0 0 32 32" aria-hidden="true">
            <circle cx="16" cy="16" :r="R" class="obj-track" />
            <circle
              cx="16"
              cy="16"
              :r="R"
              class="obj-fill"
              :stroke-dasharray="C"
              :stroke-dashoffset="ring(tm, t)"
            />
          </svg>
          <component :is="icons[tm.key]" :size="14" :stroke-width="1.8" />
        </span>
        <b>{{ up(tm, t) ? 'UP' : mmss(left(tm, t)) }}</b>
      </li>
    </ul>
    <div class="obj-teams">
      <div v-for="(team, side) in teams" :key="side" class="obj-team" :class="side">
        <span class="obj-drakes">
          <i v-for="(c, i) in team.dragons" :key="i" :style="{ background: c }" />
        </span>
        <span class="obj-count"><Shield :size="11" :stroke-width="1.8" />{{ team.towers }}</span>
        <span class="obj-count"><Bug :size="11" :stroke-width="1.8" />{{ team.grubs }}</span>
        <span class="obj-count"><Crown :size="11" :stroke-width="1.8" />{{ team.barons }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* The overlay's own palette: it is drawn over a dark game in either theme. */
.obj {
  --ally: #4d8dff;
  --enemy: #ff6a4d;
  --gold: #e8b04f;
  --muted: #9a9ab0;
  display: inline-block;
  padding: 4px;
  font: 500 12px/1.35 var(--font-sans);
  font-variant-numeric: tabular-nums;
  color: #eeeef5;
  background: rgb(9 9 14 / 0.86);
  border: 1px solid rgb(255 255 255 / 0.09);
  border-radius: 6px;
  box-shadow: 0 2px 6px rgb(0 0 0 / 0.35);
}
.obj-pills {
  display: flex;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.obj-pill {
  --c: #ff7a45;
  display: flex;
  align-items: center;
  gap: 7px;
  height: 36px;
  padding: 0 12px 0 3px;
  background: rgb(255 255 255 / 0.04);
  border: 1px solid rgb(255 255 255 / 0.06);
  border-radius: 4px;
  transition:
    background-color 300ms,
    border-color 300ms;
}
.obj-pill.grubs {
  --c: #c77dff;
}
.obj-pill.baron,
.obj-pill.baronBuff {
  --c: #a99fff;
}
.obj-pill.ally {
  border-color: rgb(77 141 255 / 0.4);
}
.obj-ring {
  position: relative;
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  color: var(--c);
}
.obj-arc {
  position: absolute;
  inset: 0;
  transform: rotate(-90deg);
}
.obj-track {
  fill: rgb(0 0 0 / 0.35);
  stroke: rgb(255 255 255 / 0.08);
  stroke-width: 2.5;
}
.obj-fill {
  fill: none;
  stroke: var(--c);
  stroke-width: 2.5;
  stroke-linecap: round;
  transition: stroke-dashoffset 1s linear;
}
.obj-pill b {
  min-width: 34px;
  font-size: 16px;
  font-stretch: 78%;
  font-weight: 800;
}
.obj-pill.soon b {
  color: var(--enemy);
}
.obj-pill.up {
  background: rgb(244 181 68 / 0.12);
  border-color: rgb(244 181 68 / 0.45);
}
.obj-pill.up b {
  color: var(--gold);
}
.obj-pill.ally b {
  color: var(--ally);
}
.obj-teams {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 4px 10px 1px;
}
.obj-team {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 10.5px;
  font-weight: 700;
}
.obj-team.enemy {
  flex-direction: row-reverse;
}
.obj-drakes {
  display: flex;
  gap: 3px;
  min-width: 8px;
  height: 8px;
}
.obj-drakes i {
  width: 8px;
  height: 8px;
  transform: rotate(45deg) scale(0.85);
  border-radius: 1px;
}
.obj-count {
  display: flex;
  align-items: center;
  gap: 3px;
  color: var(--muted);
}
.obj-team.ally .obj-count svg {
  color: var(--ally);
}
.obj-team.enemy .obj-count svg {
  color: var(--enemy);
}
</style>
