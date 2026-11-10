<script setup lang="ts">
import { computed } from 'vue'
import { RoleIcon } from '@invadelol/ui'
import { UserRound } from 'lucide-vue-next'
import ProPhoto from '../champions/ProPhoto.vue'
import { proRole } from '../../lib/board.js'

/**
 * A pro's face (Violet line): their photo when they have one, else their role's glyph on a quiet
 * square (a person's outline for staff, who have no lane), never initials.
 */
const props = withDefaults(
  defineProps<{
    slug: string
    photo?: string | null
    role?: string | null
    size?: number
    eager?: boolean
  }>(),
  { photo: null, role: null, size: 36, eager: false }
)
const lane = computed(() => proRole(props.role)?.lane ?? null)
</script>

<template>
  <ProPhoto
    v-if="photo"
    class="rd-face"
    :slug="slug"
    :photo="photo"
    :width="size"
    :height="size"
    :eager="eager"
  />
  <span
    v-else
    class="rd-face e"
    :style="{ width: `${size}px`, height: `${size}px` }"
    aria-hidden="true"
    ><RoleIcon v-if="lane" :lane="lane" :size="Math.round(size * 0.44)" /><UserRound
      v-else
      :size="Math.round(size * 0.46)"
      :stroke-width="1.6"
  /></span>
</template>

<style>
.rd-face {
  flex: none;
  overflow: hidden;
  border-radius: 8px;
  background: var(--rd-card-2);
  box-shadow: 0 0 0 1px rgb(255 255 255 / 0.08);
}
.rd-face img {
  object-position: 50% 12%;
}
.rd-face.e {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-3);
}
</style>
