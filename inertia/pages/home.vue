<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import SearchBar from '../components/SearchBar.vue'
</script>

<template>
  <Head title="Find a Summoner" />

  <div class="min-h-screen bg-gray-100 flex flex-col items-center justify-center px-4">
    <div class="text-center mb-8">
      <h1 class="text-4xl font-bold text-gray-800 mb-2">Find a Summoner</h1>
      <p class="text-gray-500">Search for a player to view their stats</p>
    </div>

    <SearchBar />
  </div>
</template>
