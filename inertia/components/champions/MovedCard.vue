<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import CardHead from '../ui/CardHead.vue'
import { sgn } from '../../lib/tier_lists.js'

/**
 * "Moved since 26.21": the rows that climbed most, then the ones that fell most, each with a bar
 * from the middle (violet up, grey down). `scale` is the change a half bar stands for; the face
 * of a row is the `face` slot (a picture by default).
 */
export interface Moved {
  key: string | number
  name: string
  /** The change, in the unit `digits` prints. */
  d: number
  href?: string | null
  img?: string | null
}

const props = withDefaults(
  defineProps<{
    title: string
    meta?: string | null
    up: Moved[]
    down: Moved[]
    digits?: number
    /** The class of a row (`tx-mv`, `du-mv`). */
    rowClass?: string
  }>(),
  { meta: null, digits: 1, rowClass: 'tx-mv' }
)
const scale = () => Math.max(...[...props.up, ...props.down].map((m) => Math.abs(m.d)), 0.0001)
const width = (d: number) => `${Math.min(50, (Math.abs(d) / scale()) * 50).toFixed(1)}%`
</script>

<template>
  <article class="card moved">
    <CardHead :title="title" icon="trend" :meta="meta" />
    <span class="lab moved-lab">Climbing</span>
    <component
      :is="m.href ? Link : 'span'"
      v-for="m in up"
      :key="`u${m.key}`"
      :class="rowClass"
      :href="m.href ?? undefined"
    >
      <slot name="face" :m="m"><img class="pic sm" :src="m.img ?? ''" alt="" /></slot>
      <span class="h5 ell">{{ m.name }}</span>
      <span class="ax"><i :style="{ left: '50%', width: width(m.d) }" /></span>
      <span class="n vi">{{ sgn(m.d, digits) }}</span>
    </component>
    <p v-if="!up.length" class="meta moved-none">Nothing climbed yet.</p>
    <span class="lab moved-lab down">Falling</span>
    <component
      :is="m.href ? Link : 'span'"
      v-for="m in down"
      :key="`d${m.key}`"
      :class="rowClass"
      :href="m.href ?? undefined"
    >
      <slot name="face" :m="m"><img class="pic sm" :src="m.img ?? ''" alt="" /></slot>
      <span class="h5 ell">{{ m.name }}</span>
      <span class="ax"><i class="dn" :style="{ right: '50%', width: width(m.d) }" /></span>
      <span class="n t3">{{ sgn(m.d, digits) }}</span>
    </component>
    <p v-if="!down.length" class="meta moved-none">Nothing fell yet.</p>
    <span class="moved-end" />
  </article>
</template>
