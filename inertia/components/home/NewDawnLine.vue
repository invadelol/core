<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import Icon from '../ui/Icon.vue'

/**
 * The home's way to the New Dawn hub, between the search and the three cards: one slim card,
 * Blitzcrank's head from Riot's key art on its right, his dome rising out of the card's top edge.
 * On hover he pops up a little and the card's light warms (styles in home-facet.css).
 */
</script>

<template>
  <Link class="nd-e" href="/new-dawn" prefetch>
    <span class="nd-e-c">
      <span class="nd-e-t">
        <b>Everything we know about New Dawn<Icon name="chevr" :size="16" class="nd-e-i" /></b>
        <span class="nd-e-long">Riot's 2027 update. Full reveal in early January.</span>
        <span class="nd-e-short">Full reveal in early January</span>
      </span>
      <span class="nd-e-art" aria-hidden="true" />
    </span>
    <span class="nd-e-pop" aria-hidden="true"><span /></span>
  </Link>
</template>
