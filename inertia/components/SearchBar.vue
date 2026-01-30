<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { router } from '@inertiajs/vue3'

const query = ref('')
const results = ref<
  Array<{ puuid: string; gameName: string; tagLine: string; profileIconId: number | null }>
>([])
const isLoading = ref(false)
const showDropdown = ref(false)

let debounceTimer: ReturnType<typeof setTimeout>

const DDRAGON_BASE = 'https://ddragon.leagueoflegends.com/cdn/14.24.1/img'

// Parse user input to detect name#tag format
const parsedUserInput = computed(() => {
  const trimmed = query.value.trim()
  if (!trimmed) return null

  // Check if input contains # separator
  const hashIndex = trimmed.indexOf('#')
  if (hashIndex > 0 && hashIndex < trimmed.length - 1) {
    const gameName = trimmed.substring(0, hashIndex).trim()
    const tagLine = trimmed.substring(hashIndex + 1).trim()
    if (gameName && tagLine) {
      return { gameName, tagLine }
    }
  }

  return null
})

// Show dropdown if there are results OR if user has typed a valid name#tag
const shouldShowDropdown = computed(() => {
  return showDropdown.value && (results.value.length > 0 || parsedUserInput.value !== null)
})

watch(query, (val) => {
  clearTimeout(debounceTimer)
  if (val.length < 2) {
    results.value = []
    showDropdown.value = false
    return
  }
  showDropdown.value = true
  debounceTimer = setTimeout(() => search(val), 300)
})

async function search(q: string) {
  isLoading.value = true
  try {
    const res = await fetch(`/api/summoners/search?q=${encodeURIComponent(q)}&limit=10`)
    if (res.ok) {
      results.value = await res.json()
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

function handleEnter() {
  // If user has typed a valid name#tag, navigate directly
  if (parsedUserInput.value) {
    navigateToSummoner(parsedUserInput.value)
  } else if (results.value.length > 0) {
    // Otherwise, navigate to the first result if available
    navigateToSummoner(results.value[0])
  }
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
      placeholder="Search summoner (e.g., Faker or Faker#EUW)"
      class="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      @focus="showDropdown = results.length > 0 || parsedUserInput !== null"
      @blur="handleBlur"
      @keydown.enter.prevent="handleEnter"
    />

    <div v-if="isLoading" class="absolute right-3 top-1/2 -translate-y-1/2">
      <div
        class="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"
      ></div>
    </div>

    <ul
      v-if="shouldShowDropdown"
      class="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto"
    >
      <!-- User input option (name#tag format) -->
      <li
        v-if="parsedUserInput"
        class="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-blue-50 bg-blue-50/50 transition-colors border-b border-gray-100"
        @mousedown.prevent="navigateToSummoner(parsedUserInput)"
      >
        <div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <div class="flex-1">
          <span class="font-medium">{{ parsedUserInput.gameName }}</span>
          <span class="text-gray-500">#{{ parsedUserInput.tagLine }}</span>
          <span class="ml-2 text-xs text-blue-600 font-medium">Search directly</span>
        </div>
        <kbd class="hidden sm:inline-block px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-100 border border-gray-200 rounded">Enter</kbd>
      </li>

      <!-- Search results -->
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
