<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import { Head, Link } from '@inertiajs/vue3'
import SiteLayout from '../../components/SiteLayout.vue'
import FollowButton from '../../components/social/FollowButton.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import Icon from '../../components/ui/Icon.vue'
import Tabs from '../../components/ui/Tabs.vue'
import type { FollowRow } from '../../lib/account_types.js'
import '../../css/account.css'

/**
 * /u/<handle>/followers and /u/<handle>/following: a person's followers, or the people, League
 * accounts and pros they follow, newest first, fifty at a time. Each row has its Follow button for
 * the visitor. A hidden main account is never named here.
 */
const props = defineProps<{
  person: { id: string; name: string; handle: string; avatarUrl: string | null }
  list: 'followers' | 'following'
  page: { items: FollowRow[]; cursor: string | null }
  counts: { followers: number; following: number }
}>()

const rows = shallowRef(props.page.items)
const cursor = ref(props.page.cursor)
const loading = ref(false)

async function more() {
  if (!cursor.value || loading.value) return
  loading.value = true
  try {
    const url = `/api/users/${props.person.handle}/${props.list}?cursor=${encodeURIComponent(cursor.value)}`
    const response = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!response.ok) return
    const next = (await response.json()) as { items: FollowRow[]; cursor: string | null }
    rows.value = [...rows.value, ...next.items]
    cursor.value = next.cursor
  } finally {
    loading.value = false
  }
}

const tabs = computed(() => [
  {
    key: 'followers',
    label: 'Followers',
    href: `/u/${props.person.handle}/followers`,
    count: props.counts.followers,
  },
  {
    key: 'following',
    label: 'Following',
    href: `/u/${props.person.handle}/following`,
    count: props.counts.following,
  },
])
const KIND = { user: 'person', player: 'League account', pro: 'pro' } as const
</script>

<template>
  <Head :title="`${person.name}: ${list === 'followers' ? 'followers' : 'following'}`" />
  <SiteLayout>
    <div class="wrap ac-wrap">
      <header class="ac-h">
        <img v-if="person.avatarUrl" class="ac-av" :src="person.avatarUrl" alt="" />
        <span v-else class="ac-av none"><Icon name="user" :size="28" /></span>
        <div class="ac-who">
          <h1 class="ell">{{ person.name }}</h1>
          <Link class="meta" :href="`/u/${person.handle}`">@{{ person.handle }}</Link>
        </div>
      </header>
      <Tabs class="ac-tabs" :items="tabs" :active="list" :label="`${person.name}'s follows`" />

      <ul v-if="rows.length" class="card fl-list">
        <li v-for="r in rows" :key="`${r.kind}:${r.id}`" class="fl-row">
          <Link class="fl-who" :href="r.href">
            <img v-if="r.imageUrl" class="fl-pic" :src="r.imageUrl" alt="" loading="lazy" />
            <span v-else class="fl-pic none"><Icon name="user" :size="18" /></span>
            <span class="ac-row-t">
              <span class="h5 ell">{{ r.name }}</span>
              <span class="meta ell">{{ r.subtitle ?? KIND[r.kind] }}</span>
            </span>
          </Link>
          <FollowButton
            :kind="r.kind"
            :id="r.id"
            :name="r.name"
            :state="{ following: r.viewerFollows, followers: 0 }"
            small
          />
        </li>
        <li v-if="cursor" class="fl-more">
          <button type="button" class="btn sm" :disabled="loading" @click="more">Show more</button>
        </li>
      </ul>
      <div v-else class="card ac-card">
        <EmptyState
          icon="users"
          :title="list === 'followers' ? 'No followers yet' : 'Not following anyone yet'"
        />
      </div>
    </div>
  </SiteLayout>
</template>
