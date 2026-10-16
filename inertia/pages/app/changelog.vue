<script setup lang="ts">
import { computed, onMounted, reactive } from 'vue'
import { Head, Link } from '@inertiajs/vue3'
import AppHeader from '../../components/AppHeader.vue'
import SiteFooter from '../../components/SiteFooter.vue'
import RunText from '../../components/changelog/RunText.vue'
import type { ChangelogRelease } from '../../lib/changelog.js'
import '../../components/changelog/release-notes.css'

/**
 * /app/changelog: the desktop app's "What's new" page on the site, every version newest first,
 * drawn as the app draws it (release-notes.css). Each version leads with its screenshot and
 * headline, then its other marked lines, then quiet lists under New, Changed, Fixed. Each line
 * shows its first sentence; the rest opens in place ("More" after a headline, the line itself in
 * a list). /app/changelog/0.3.2 is the same page, opened at that version.
 */
const props = defineProps<{ releases: ChangelogRelease[]; version: string | null }>()

/** The version the page opened at, first to rise into place. */
const start = computed(() =>
  Math.max(
    props.releases.findIndex((r) => r.version === props.version),
    0
  )
)

/** What has been opened, until the page closes. */
const open = reactive(new Set<string>())
const toggle = (key: string) => (open.has(key) ? open.delete(key) : open.add(key))

onMounted(() => {
  if (!props.version || start.value === 0) return
  document.getElementById(`v${props.version}`)?.scrollIntoView({ block: 'start' })
})
</script>

<template>
  <Head :title="version ? `Invade ${version}` : 'Invade changelog'" />

  <div class="flex min-h-screen flex-col">
    <AppHeader />

    <main class="mx-auto w-full max-w-[956px] flex-1 px-4 pt-[clamp(32px,7vh,72px)] sm:px-6">
      <header class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 class="text-[28px] font-semibold leading-tight tracking-[-0.012em] text-ink">
          What’s new
        </h1>
        <Link href="/app" class="text-[13px] text-ink-3 transition-colors hover:text-ink">
          Invade for desktop
        </Link>
      </header>

      <div class="rn mt-10">
        <article
          v-for="(r, i) in releases"
          :id="`v${r.version}`"
          :key="r.version"
          class="rn-release"
          :style="{ '--i': Math.min(Math.max(i - start, 0), 3) }"
          :aria-labelledby="`rn-${r.version}`"
        >
          <header class="rn-side">
            <h2 :id="`rn-${r.version}`" class="rn-version">
              <Link :href="`/app/changelog/${r.version}`" preserve-scroll preserve-state>
                {{ r.version }}
              </Link>
            </h2>
            <time v-if="r.date" :datetime="r.date">{{ r.day }}</time>
          </header>

          <div class="rn-main">
            <section v-if="r.hero" class="rn-lead">
              <div class="rn-stage">
                <img
                  :src="r.hero.src"
                  :width="r.hero.w"
                  :height="r.hero.h"
                  alt=""
                  :loading="i === start ? 'eager' : 'lazy'"
                  decoding="async"
                  draggable="false"
                />
              </div>
              <h3 v-if="r.hero.title">{{ r.hero.title }}</h3>
              <p>
                <RunText :runs="r.hero.first" /><span v-if="open.has(r.hero.key)" class="rn-rest"
                  ><RunText :runs="r.hero.more"
                /></span>
                <button
                  v-if="r.hero.more.length"
                  type="button"
                  class="rn-more"
                  :aria-expanded="open.has(r.hero.key)"
                  @click="toggle(r.hero.key)"
                >
                  {{ open.has(r.hero.key) ? 'Less' : 'More' }}
                </button>
              </p>
            </section>

            <section
              v-for="f in r.features"
              :key="f.key"
              class="rn-feature"
              :class="{ 'has-shot': f.src }"
            >
              <div class="rn-words">
                <h3 v-if="f.title">{{ f.title }}</h3>
                <p>
                  <RunText :runs="f.first" /><span v-if="open.has(f.key)" class="rn-rest"
                    ><RunText :runs="f.more"
                  /></span>
                  <button
                    v-if="f.more.length"
                    type="button"
                    class="rn-more"
                    :aria-expanded="open.has(f.key)"
                    @click="toggle(f.key)"
                  >
                    {{ open.has(f.key) ? 'Less' : 'More' }}
                  </button>
                </p>
              </div>
              <div v-if="f.src" class="rn-stage">
                <img
                  :src="f.src"
                  :width="f.w"
                  :height="f.h"
                  alt=""
                  loading="lazy"
                  decoding="async"
                  draggable="false"
                />
              </div>
            </section>

            <section
              v-for="g in r.groups"
              :key="g.title"
              class="rn-group"
              :class="{ quiet: g.quiet }"
            >
              <h4>{{ g.title }}</h4>
              <ul>
                <li v-for="item in g.items" :key="item.key">
                  <button
                    v-if="item.more.length"
                    type="button"
                    class="rn-line"
                    :aria-expanded="open.has(item.key)"
                    @click="toggle(item.key)"
                  >
                    <RunText :runs="item.first" /><span v-if="open.has(item.key)" class="rn-rest"
                      ><RunText :runs="item.more"
                    /></span>
                  </button>
                  <RunText v-else :runs="item.first" />
                </li>
              </ul>
            </section>
          </div>
        </article>
      </div>
    </main>

    <SiteFooter />
  </div>
</template>
