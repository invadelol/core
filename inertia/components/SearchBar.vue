<script setup lang="ts">
import { ref, watch } from 'vue'
import { router } from '@inertiajs/vue3'

const query = ref('')
const results = ref<Array<{ puuid: string; gameName: string; tagLine: string; profileIconId: number | null }>>([])
const isLoading = ref(false)
const showDropdown = ref(false)

let debounceTimer: ReturnType<typeof setTimeout>

const DDRAGON_BASE = 'https://ddragon.leagueoflegends.com/cdn/14.24.1/img'

watch(query, (val) => {
  clearTimeout(debounceTimer)
  if (val.length < 2) {
    results.value = []
    showDropdown.value = false
    return
  }
  debounceTimer = setTimeout(() => search(val), 300)
})

async function search(q: string) {
  isLoading.value = true
  try {
    const res = await fetch(`/summoners/search?q=${encodeURIComponent(q)}&limit=10`)
    if (res.ok) {
      results.value = await res.json()
      showDropdown.value = results.value.length > 0
    }
  } catch (e) {
    console.error('Search failed:', e)
  } finally {
    isLoading.value = false
  }
}

function navigateToSummoner(summoner: { gameName: string; tagLine: string }) {
  const slug = `${summoner.gameName}-${summoner.tagLine}`
  showDropdown.value = false
  query.value = ''
  router.visit(`/${encodeURIComponent(slug)}`)
}

function handleBlur() {
  setTimeout(() => {
    showDropdown.value = false
  }, 200)
}
</script>

<template>
  <div class="relative w-full max-w-md">
    <input
      v-model="query"
      type="text"
      placeholder="Search summoner (e.g., Faker)"
      class="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      @focus="showDropdown = results.length > 0"
      @blur="handleBlur"
    />
    
    <div v-if="isLoading" class="absolute right-3 top-1/2 -translate-y-1/2">
      <div class="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
    </div>

    <ul
      v-if="showDropdown && results.length > 0"
      class="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto"
    >
      <li
        v-for="summoner in results"
        :key="summoner.puuid"
        class="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-100 transition-colors"
        @mousedown.prevent="navigateToSummoner(summoner)"
      >
        <img
          :src="`${DDRAGON_BASE}/profileicon/${summoner.profileIconId || 1}.png`"
          :alt="summoner.gameName"
          class="w-10 h-10 rounded-full"
        />
        <div>
          <span class="font-medium">{{ summoner.gameName }}</span>
          <span class="text-gray-500">#{{ summoner.tagLine }}</span>
        </div>
      </li>
    </ul>
  </div>
</template>
