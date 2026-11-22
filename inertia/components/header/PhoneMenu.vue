<script setup lang="ts">
import { computed } from 'vue'
import { Link } from '@inertiajs/vue3'
import Icon from '../ui/Icon.vue'
import MenuArt from './MenuArt.vue'
import ThemeChoice from './ThemeChoice.vue'
import { NEW_DAWN_LINK, SECTIONS, type NavContext } from '../../lib/site_nav.js'
import { signInHref, useViewer } from '../../lib/account.js'

/**
 * The header on a phone (under 1024 px): the patch notes (the newest, then the older ones) and New
 * Dawn, then every section's pages in one sheet under the bar, each with its picture, Sign in for
 * a visitor, and the theme. The page under it holds still.
 */
const props = defineProps<{ ctx: NavContext; path: string; patchHref: string | null }>()
defineEmits<{ close: [] }>()

/** The other patches with notes, beside the newest. */
const older = computed(() =>
  (props.ctx.nav?.patchNotes ?? []).filter((n) => n.patch !== props.ctx.patch)
)
const nd = NEW_DAWN_LINK
/** Signed out, Sign in closes the sheet (the bar has no room for it on a phone). */
const { viewer } = useViewer()
</script>

<template>
  <div class="hx-phone" role="dialog" aria-label="Menu">
    <div class="wrap">
      <Link
        v-if="patchHref && ctx.patch"
        :href="patchHref"
        class="hx-phone-patch"
        prefetch
        @click="$emit('close')"
        ><Icon name="arrow" :size="14" />Patch {{ ctx.patch }}</Link
      >
      <Link
        v-for="n in older"
        :key="n.patch"
        :href="`/patch/${n.patch}`"
        class="hx-phone-older num"
        prefetch
        @click="$emit('close')"
        >{{ n.patch }}</Link
      >
      <Link
        :href="nd.href"
        class="hx-phone-r hx-phone-nd"
        :class="{ on: nd.here(path) }"
        :aria-current="nd.here(path) ? 'page' : undefined"
        @click="$emit('close')"
      >
        <span class="dm-i"><MenuArt :name="nd.art" :size="40" /></span>
        <span class="dm-t"
          ><b>{{ nd.label }}</b
          ><span>{{ nd.line }}</span></span
        >
      </Link>
      <nav v-for="s in SECTIONS" :key="s.key" class="hx-phone-sec" :aria-label="s.label">
        <span class="lab">{{ s.label }}</span>
        <Link
          v-for="l in s.links"
          :key="l.key"
          :href="l.href"
          class="hx-phone-r"
          :class="{ on: l.here(path) }"
          :aria-current="l.here(path) ? 'page' : undefined"
          @click="$emit('close')"
        >
          <span class="dm-i"><MenuArt :name="l.art" :size="40" /></span>
          <span class="dm-t"
            ><b>{{ l.label }}</b
            ><span>{{ l.line(ctx) }}</span></span
          >
        </Link>
      </nav>
      <div v-if="!viewer" class="hx-phone-acct">
        <Link class="btn" :href="signInHref(path)" @click="$emit('close')">Sign in</Link>
      </div>
      <div class="hx-phone-theme">
        <span class="lab">Theme</span>
        <ThemeChoice />
      </div>
    </div>
  </div>
</template>
