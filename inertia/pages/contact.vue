<script setup lang="ts">
import { computed } from 'vue'
import { Head } from '@inertiajs/vue3'
import SiteLayout from '../components/SiteLayout.vue'
import Masthead from '../components/ui/Masthead.vue'
import Icon from '../components/ui/Icon.vue'
import DiscordMark from '../components/header/DiscordMark.vue'
import type { IconName } from '../lib/icons.js'
import { DISCORD_URL, X_URL } from '../lib/links.js'

/**
 * /contact (Facet): the ways to reach the team, one card each. The Discord first (with its live
 * counts when Discord answered), an email when the site has a contact address, then X.
 */
const props = defineProps<{
  email: string | null
  discord: { members: number; online: number } | null
}>()

const n = (x: number) => x.toLocaleString('en-US')
const cards = computed(() => {
  const list: {
    key: string
    icon: IconName
    title: string
    line: string
    action: string
    href: string
    out: boolean
  }[] = [
    {
      key: 'discord',
      icon: 'discord',
      title: 'Discord',
      line: `${props.discord ? `${n(props.discord.members)} players, ${n(props.discord.online)} online now. ` : ''}Bugs, ideas and the release notes first.`,
      action: 'Join the server',
      href: DISCORD_URL,
      out: true,
    },
  ]
  if (props.email)
    list.push({
      key: 'email',
      icon: 'news',
      title: 'Email',
      line: 'For anything that is not for a public channel: partnerships, press, your data.',
      action: 'Write to us',
      href: `mailto:${props.email}`,
      out: false,
    })
  list.push({
    key: 'x',
    icon: 'external',
    title: 'X',
    line: 'Patch stats, pro moments and what is coming next, @invadedotlol.',
    action: 'Follow',
    href: X_URL,
    out: true,
  })
  return list
})
</script>

<template>
  <Head title="Contact" />
  <SiteLayout>
    <div class="wrap">
      <Masthead title="Contact" meta="A question, a bug or an idea: here is where we answer" />
      <div class="ct-grid" :class="cards.length === 3 ? 'grid3' : 'grid2'">
        <a
          v-for="c in cards"
          :key="c.key"
          class="card ct-card"
          :href="c.href"
          v-bind="c.out ? { target: '_blank', rel: 'noreferrer' } : {}"
          :data-track="`contact_${c.key}`"
        >
          <DiscordMark v-if="c.key === 'discord'" :size="30" />
          <Icon v-else :name="c.icon" :size="26" />
          <span class="h2">{{ c.title }}</span>
          <span class="body">{{ c.line }}</span>
          <span class="more">{{ c.action }}<Icon name="fwd" :size="14" /></span>
        </a>
      </div>
    </div>
  </SiteLayout>
</template>

<style>
.vb .ct-grid {
  padding-bottom: 32px;
}
.vb .ct-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 24px;
  transition: background 160ms var(--ease);
}
.vb .ct-card:hover {
  background: var(--s2);
}
.vb .ct-card:hover .more {
  color: var(--t1);
}
.vb .ct-card > .i {
  color: var(--t1);
}
.vb .ct-card .more {
  margin-top: 6px;
}
@media (max-width: 1023px) {
  .vb .ct-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
  }
}
</style>
