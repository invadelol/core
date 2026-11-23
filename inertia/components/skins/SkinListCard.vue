<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import Icon from '../ui/Icon.vue'
import SkinPoster from './SkinPoster.vue'
import PersonAvatar from './PersonAvatar.vue'
import { listPath } from '../../lib/skins.js'
import type { SkinListCard } from '../../lib/skin_types.js'

/** A list as a fan of its first posters, its title, its owner, its size and likes. */
defineProps<{ list: SkinListCard }>()
</script>

<template>
  <Link :href="listPath(list.id)" class="skn-list">
    <span class="skn-fan" aria-hidden="true">
      <span v-for="skin in list.posters" :key="skin.id" class="skn-fp">
        <SkinPoster :skin="skin" />
      </span>
    </span>
    <span class="skn-lt">
      <b>{{ list.title }}</b>
      <span class="skn-lby">
        <PersonAvatar :src="list.owner.avatarUrl" :size="16" />{{ list.owner.name }}
        <span class="num">{{ list.count }} {{ list.count === 1 ? 'skin' : 'skins' }}</span>
        <span class="num"><Icon name="heart" :size="12" />{{ list.likes }}</span>
      </span>
    </span>
  </Link>
</template>
