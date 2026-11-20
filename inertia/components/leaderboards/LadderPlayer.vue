<script setup lang="ts">
import Frame from '../ui/Frame.vue'
import Logo from '../pros/Logo.vue'
import ProPic from '../pros/ProPic.vue'
import { profileIcon } from '../../lib/assets.js'

/**
 * A ladder's player cell: profile icon, name and tag, the level under it (or a pro's team). A pro
 * shows their picture by the site's one rule (photo, team logo, quiet bust), never an account icon.
 */
defineProps<{
  gameName: string | null
  tagLine: string | null
  icon: number | null
  level: number | null
  pro?: {
    name: string
    slug: string
    photo?: string
    team: { id: string; name: string; shortName: string | null } | null
  } | null
}>()
</script>

<template>
  <span class="row" style="gap: 12px; min-width: 0">
    <span v-if="pro" class="lb-pp"
      ><ProPic :slug="pro.slug" :photo="pro.photo" :team="pro.team" :size="38" position="50% 8%"
    /></span>
    <Frame v-else :src="profileIcon(icon)" size="s" class="lb-pi" />
    <span class="col" style="min-width: 0; gap: 1px">
      <span class="h4 ell"
        >{{ pro ? pro.name : (gameName ?? 'Unknown player')
        }}<template v-if="pro"><span class="lb-pro">PRO</span></template
        ><template v-else-if="tagLine">
          <span class="lb-tag">#{{ tagLine }}</span></template
        ></span
      >
      <span v-if="pro?.team" class="meta ell row" style="gap: 5px"
        ><Logo class="lb-team" :team="pro.team.id" :size="14" />{{ pro.team.name }}</span
      >
      <span v-else-if="pro" class="meta ell"
        >{{ gameName }}<template v-if="tagLine"> #{{ tagLine }}</template></span
      >
      <span v-else-if="level" class="meta ell">Level {{ level }}</span>
    </span>
  </span>
</template>
