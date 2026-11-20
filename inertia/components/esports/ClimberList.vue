<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import Logo from '../pros/Logo.vue'
import ProPic from '../pros/ProPic.vue'
import { n, signedN } from '../../lib/ladders.js'
import type { Climber } from '../../lib/esports_landing.js'

/**
 * The pros who won the most LP in 24 hours (`.lrow`s): their order, face, name and team, the LP
 * won and the LP they stand on now.
 */
defineProps<{ rows: Climber[] }>()
</script>

<template>
  <div>
    <Link v-for="(r, i) in rows" :key="r.pro.slug" class="lrow el-pr" :href="`/pro/${r.pro.slug}`">
      <span class="rk">{{ i + 1 }}</span>
      <span class="el-pf"
        ><ProPic :slug="r.pro.slug" :photo="r.pro.photo" :team="r.pro.team" :size="40"
      /></span>
      <span class="col grow">
        <span class="el-nm ell">{{ r.pro.name }}</span>
        <span v-if="r.pro.team" class="el-sub ell"
          ><Logo class="el-tl" :team="r.pro.team.id" :size="16" />{{ r.pro.team.name }}</span
        >
      </span>
      <span class="col" style="align-items: flex-end">
        <span class="el-v num">{{ signedN(r.gained) }}</span>
        <span class="el-sub num">{{ n(r.lp) }} LP</span>
      </span>
    </Link>
  </div>
</template>
