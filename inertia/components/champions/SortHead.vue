<script setup lang="ts">
import { ChevronDown, ChevronUp } from 'lucide-vue-next'

/** A sortable column head: a button inside the header cell, which carries `aria-sort`. */
defineProps<{ label: string; active: boolean; dir: 'asc' | 'desc'; title?: string }>()
defineEmits<{ sort: [] }>()
</script>

<template>
  <button type="button" :title="title" @click="$emit('sort')">
    {{ label
    }}<template v-if="active"
      ><ChevronDown v-if="dir === 'desc'" :size="11" aria-hidden="true" /><ChevronUp
        v-else
        :size="11"
        aria-hidden="true"
    /></template>
  </button>
</template>
