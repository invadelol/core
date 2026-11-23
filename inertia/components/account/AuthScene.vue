<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import Glyph from '../ui/Glyph.vue'
import { assetUrl, fullSplash } from '../../lib/assets.js'
import '../../css/auth.css'

/**
 * The scene behind signing in and connecting the app: Nunu & Willump's camp at night, its lights
 * alive, the home's poros standing in it as a lit group. No site header, like a game client's
 * login: the lockup leads home, the legal line sits at the foot. The page's form goes in the
 * slot, on the ink at the left. `mood`: the poro of the moment (cheeky while asking, excited once
 * connected); pointing at the main action excites it too.
 */
withDefaults(defineProps<{ mood?: 'ask' | 'done' }>(), { mood: 'ask' })

const NUNU = 20
const PORO = (name: string) => `/home/poro-${name}.webp`
</script>

<template>
  <div class="vb site au iv-dark">
    <div class="au-scene" aria-hidden="true">
      <div class="au-art">
        <img :src="fullSplash(NUNU)" alt="" fetchpriority="high" />
        <i class="au-orb"></i><i class="au-fire"></i><i class="au-eye"></i><i class="au-eye e2"></i>
      </div>
      <i class="au-aurora"></i><i class="au-sweep"></i><i class="au-shade"></i>
      <div class="au-poros">
        <img class="au-p au-pb" :src="PORO(mood === 'done' ? 'peace' : 'snax')" alt="" />
        <img class="au-i au-i1" :src="assetUrl('item', 2052)" alt="" />
        <img class="au-i au-i2" :src="assetUrl('item', 3340)" alt="" />
        <i class="au-sh"></i>
        <img
          :key="mood"
          class="au-p au-pf"
          :class="{ hop: mood === 'done' }"
          :src="PORO(mood === 'done' ? 'hype' : 'cheeky')"
          alt=""
        />
        <img v-if="mood !== 'done'" class="au-p au-pf au-pf-x" :src="PORO('hype')" alt="" />
      </div>
      <i class="au-grain"></i>
    </div>
    <Link class="au-logo" href="/" aria-label="Invade, home"><Glyph :h="26" /><b>Invade</b></Link>
    <main id="main" class="au-panel"><slot /></main>
    <p class="au-legal">
      Invade isn’t endorsed by Riot Games. Art: Nunu &amp; Willump, Riot Games.
    </p>
  </div>
</template>
