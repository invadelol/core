<script setup lang="ts">
import ErrorPage from '../../components/ErrorPage.vue'
</script>

<template>
  <ErrorPage
    :status="404"
    title="This page doesn’t exist"
    line="The link may be out of date. Look the player, the champion or the pro up again."
  />
</template>
