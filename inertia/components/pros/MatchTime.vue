<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { localTime, utcTime } from '../../lib/pro_matches.js'

/**
 * When a match starts: in UTC on the server and the first client render (so hydration matches),
 * then in the visitor's time zone. Its box keeps one width, so the swap moves nothing.
 */
const props = defineProps<{ at: string }>()
const local = ref(false)
onMounted(() => (local.value = true))
</script>

<template>
  <time class="pm-time num" :datetime="props.at">{{
    local ? localTime(props.at) : utcTime(props.at)
  }}</time>
</template>
