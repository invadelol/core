<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue'
import { Link, usePage } from '@inertiajs/vue3'
import Glyph from './ui/Glyph.vue'
import Icon from './ui/Icon.vue'
import SearchBar from './SearchBar.vue'
import NavMenu from './header/NavMenu.vue'
import PatchMenu from './header/PatchMenu.vue'
import ThemeToggle from './header/ThemeToggle.vue'
import DiscordMark from './header/DiscordMark.vue'
import { DISCORD_URL } from '../lib/links.js'
import { SITE_STAGE } from '../lib/site_stage.js'
import SubArt from './header/SubArt.vue'
import { SUB_ART, type SubLink } from './header/sub_art.js'
import '../css/subrow.css'
import {
  SECTIONS,
  loadSiteNav,
  patchPath,
  placeOf,
  siteNav,
  type NavContext,
  type SectionKey,
} from '../lib/site_nav.js'
import { season, startSeason } from '../lib/season.js'
import { patchName } from '../lib/patch.js'

/**
 * The site's header, on every page (Facet): one bar with the mark and its stage (Beta), the four
 * sections and their small menus, the patch pill, the search (a field with its region; its results
 * drop under it), the desktop app, Discord and the theme; under it, the plain-text row of the
 * section you are in.
 * Under 1024 px the sections fold into the phone's sheet; under 640 px the search is a button.
 *
 * Nothing here fetches on load: a menu opens in the frame of its hover, click or key, and its
 * figures (`siteNav`) are asked for on the first sign of interest.
 */

const SeasonLayer = defineAsyncComponent(() => import('./SeasonLayer.vue'))
const PhoneMenu = defineAsyncComponent(() => import('./header/PhoneMenu.vue'))

const props = withDefaults(
  defineProps<{
    /** Older pages passed a breadcrumb here; pages now carry their own (ui/Masthead). Ignored. */
    crumbs?: Array<{ label: string; href?: string }>
    /** Hides the search field, for pages where the search is the page itself. */
    search?: boolean
    /** A sub-row of the page's own (the patch notes list their patches), instead of the section's. */
    sub?: SubLink[] | null
    /** Lights a section up when the address alone does not say (a page shared by two). */
    section?: SectionKey | null
    /** Lights the patch pill up (the patch notes). */
    patchOn?: boolean
  }>(),
  { crumbs: undefined, search: true, sub: null, section: null, patchOn: false }
)

const page = usePage()
const path = computed(() => page.url.split('?')[0].replace(/\/+$/, '') || '/')

/** The newest patch the statistics show (a shared prop: the game version), as players name it. */
const version = computed(() => (page.props as { patch?: string | null }).patch ?? null)
const patch = computed(() => (version.value ? patchName(version.value) : null))
const patchHref = computed(() => (version.value ? patchPath(version.value) : null))
const onPatch = computed(() => props.patchOn || path.value.startsWith('/patch'))

const ctx = computed<NavContext>(() => ({ nav: siteNav.value, patch: patch.value }))
const place = computed(() => placeOf(path.value))
const current = computed<SectionKey | null>(() => props.section ?? place.value?.section.key ?? null)
/**
 * The sub-row: the section's links, each with its small League picture (header/sub_art.ts), or a
 * page's own row (the patch notes: New Dawn, then the patches, the newest one marked with a violet
 * dot). Tools has none.
 */
const subRow = computed<SubLink[] | null>(() => {
  if (props.sub) return props.sub
  if (current.value === 'tools') return null
  const section = SECTIONS.find((s) => s.key === current.value)
  if (!section || section.noSubRow) return null
  return section.links.map((l) => ({
    label: l.short ?? l.label,
    href: l.href,
    on: l.key === place.value?.link.key,
    art: SUB_ART[l.key],
  }))
})

/* ── Section menus ─────────────────────────────────────────────────── */

const open = ref<SectionKey | 'patch' | null>(null)
const root = ref<HTMLElement>()
const bar = ref<HTMLElement>()
const triggers = ref<Record<string, HTMLElement | null>>({})
/** Where the open menu sits in the bar: under its trigger, its left edge on the trigger's. */
const menuLeft = ref(0)
let hoverTimer: ReturnType<typeof setTimeout> | undefined
let leaveTimer: ReturnType<typeof setTimeout> | undefined

const openSection = computed(() => SECTIONS.find((s) => s.key === open.value) ?? null)

function place_(key: SectionKey) {
  const el = triggers.value[key]
  const wrap = bar.value
  if (!el || !wrap) return
  const left = el.getBoundingClientRect().left - wrap.getBoundingClientRect().left + 4
  // A menu never runs past the bar's right edge.
  menuLeft.value = Math.max(0, Math.min(left, wrap.clientWidth - 352))
}

function show(key: SectionKey) {
  loadSiteNav()
  clearTimeout(leaveTimer)
  place_(key)
  open.value = key
}

function close(focusTrigger = false) {
  const was = open.value
  clearTimeout(hoverTimer)
  clearTimeout(leaveTimer)
  open.value = null
  if (!focusTrigger || !was) return
  if (was === 'patch') patchPill.value?.$el.focus()
  else triggers.value[was]?.focus()
}

/**
 * A mouse resting on a trigger opens its menu; moving to another trigger switches at once. A click
 * goes to the section's first page (the sub-row then lists the others); ArrowDown opens the menu.
 */
function onEnter(key: SectionKey, event: PointerEvent) {
  if (event.pointerType !== 'mouse') return
  loadSiteNav()
  clearTimeout(leaveTimer)
  clearTimeout(hoverTimer)
  if (open.value === key) return
  if (open.value) {
    return show(key)
  }
  hoverTimer = setTimeout(() => show(key), 110)
}

function onLeave(event: PointerEvent) {
  if (event.pointerType !== 'mouse') return
  clearTimeout(hoverTimer)
  if (open.value) leaveTimer = setTimeout(() => close(), 220)
}

function onMenuEnter() {
  clearTimeout(leaveTimer)
}

const ORDER = SECTIONS.map((s) => s.key)

function onTriggerKey(key: SectionKey, event: KeyboardEvent) {
  const at = ORDER.indexOf(key)
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    show(key)
    nextTick(() => root.value?.querySelector<HTMLElement>('.hx-menu a[href]')?.focus())
  } else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
    event.preventDefault()
    const next = ORDER[(at + (event.key === 'ArrowRight' ? 1 : ORDER.length - 1)) % ORDER.length]
    const wasOpen = Boolean(open.value)
    triggers.value[next]?.focus()
    if (wasOpen) show(next)
  } else if (event.key === 'Escape' && open.value) {
    event.preventDefault()
    close(true)
  }
}

/** The focus leaving the bar and its menus closes what is open. */
function onFocusOut(event: FocusEvent) {
  const to = event.relatedTarget as Node | null
  if (open.value && to && !bar.value?.contains(to)) close()
}

/* ── Patch notes: the pill opens the older patches on hover ─────────── */

/** The pill is an Inertia link: its element is the component's root. */
const patchPill = ref<{ $el: HTMLElement } | null>(null)

function showPatch() {
  const el = patchPill.value?.$el
  const wrap = bar.value
  if (!el || !wrap) return
  loadSiteNav()
  clearTimeout(leaveTimer)
  const left = el.getBoundingClientRect().left - wrap.getBoundingClientRect().left
  menuLeft.value = Math.max(0, Math.min(left, wrap.clientWidth - 400))
  open.value = 'patch'
}

function onPatchEnter(event: PointerEvent) {
  if (event.pointerType !== 'mouse') return
  loadSiteNav()
  clearTimeout(leaveTimer)
  clearTimeout(hoverTimer)
  if (open.value === 'patch') return
  if (open.value) return showPatch()
  hoverTimer = setTimeout(showPatch, 110)
}

/** ArrowDown on the pill opens its menu and moves into it; Escape closes it. */
function onPatchKey(event: KeyboardEvent) {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    showPatch()
    nextTick(() => root.value?.querySelector<HTMLElement>('.hx-menu.pm a[href]')?.focus())
  } else if (event.key === 'Escape' && open.value === 'patch') {
    event.preventDefault()
    close(true)
  }
}

/* ── Search ────────────────────────────────────────────────────────── */

const searchBar = ref<InstanceType<typeof SearchBar>>()
/** A phone shows the field over the bar, from its button. */
const searchOpen = ref(false)

function openSearch() {
  close()
  mobileOpen.value = false
  searchOpen.value = true
  nextTick(() => searchBar.value?.focus())
}

function closeSearch() {
  searchOpen.value = false
}

/** `/` or ⌘K from anywhere puts the caret in the search (not while typing elsewhere). */
function onHotkey(event: KeyboardEvent) {
  if (!props.search) return
  const target = event.target as HTMLElement | null
  const typing =
    target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  const slash = event.key === '/' && !typing && !event.metaKey && !event.ctrlKey && !event.altKey
  const k = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k'
  if (slash || k) {
    event.preventDefault()
    openSearch()
  }
}

/* ── Phone menu ────────────────────────────────────────────────────── */

const mobileOpen = ref(false)
const menuButton = ref<HTMLElement>()

/** Where the phone's sheet starts: right under the bar, wherever the page was scrolled to. */
const sheetTop = ref(60)

function toggleMobile() {
  close()
  searchOpen.value = false
  if (!mobileOpen.value) {
    const barBottom = bar.value?.parentElement?.getBoundingClientRect().bottom
    if (barBottom !== undefined) sheetTop.value = Math.max(0, Math.round(barBottom))
  }
  mobileOpen.value = !mobileOpen.value
  if (mobileOpen.value) loadSiteNav()
}

function closeMobile(focusButton = false) {
  mobileOpen.value = false
  if (focusButton) menuButton.value?.focus()
}

watch(mobileOpen, (on) => document.documentElement.classList.toggle('hx-locked', on))

/* ── Shared listeners: only while something is open ────────────────── */

function onPointerDown(event: PointerEvent) {
  const target = event.target as Node
  if (open.value && !bar.value?.contains(target)) close()
}

function onKey(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  if (mobileOpen.value) closeMobile(true)
  else if (open.value) close(true)
}

const anyOpen = computed(() => Boolean(open.value || mobileOpen.value))
watch(anyOpen, (on) => {
  if (on) {
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKey)
  } else {
    document.removeEventListener('pointerdown', onPointerDown, true)
    document.removeEventListener('keydown', onKey)
  }
})

/** A visit closes whatever was open. */
watch(
  () => page.url,
  () => {
    close()
    searchOpen.value = false
    mobileOpen.value = false
  }
)

let wide: MediaQueryList | undefined
const onWide = (event: MediaQueryListEvent) => event.matches && (mobileOpen.value = false)

onMounted(() => {
  startSeason()
  window.addEventListener('keydown', onHotkey)
  wide = window.matchMedia('(min-width: 1024px)')
  wide.addEventListener('change', onWide)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onHotkey)
  wide?.removeEventListener('change', onWide)
  document.removeEventListener('pointerdown', onPointerDown, true)
  document.removeEventListener('keydown', onKey)
  document.documentElement.classList.remove('hx-locked')
  clearTimeout(hoverTimer)
  clearTimeout(leaveTimer)
})

/** "Skip to content": the page's main region, whichever page this is. */
function skip(event: MouseEvent) {
  const main =
    document.querySelector<HTMLElement>('main') ??
    (root.value?.nextElementSibling as HTMLElement | null)
  if (!main) return
  event.preventDefault()
  if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1')
  main.focus()
}
</script>

<template>
  <header
    ref="root"
    class="vb hx-root chrome"
    :class="{ 'is-menu': mobileOpen, 'is-search': searchOpen }"
  >
    <div class="hx">
      <a href="#main" class="hx-skip" @click="skip">Skip to content</a>
      <template v-if="season">
        <SeasonLayer part="chrome" />
        <SeasonLayer part="ground" />
      </template>

      <div class="hx-main">
        <div ref="bar" class="wrap" @focusout="onFocusOut">
          <Link
            class="brand"
            href="/"
            :aria-label="SITE_STAGE ? `Invade (${SITE_STAGE}) home` : 'Invade home'"
            prefetch
          >
            <Glyph :h="26" /><span class="wm">Invade</span
            ><span v-if="SITE_STAGE" class="hx-stage">{{ SITE_STAGE }}</span>
          </Link>

          <nav class="hx-nav" aria-label="Site">
            <Link
              v-for="s in SECTIONS"
              :key="s.key"
              :ref="(el) => (triggers[s.key] = (el as { $el?: HTMLElement } | null)?.$el ?? null)"
              :href="s.links[0].href"
              :class="{ on: current === s.key && open !== s.key, open: open === s.key }"
              aria-haspopup="true"
              :aria-expanded="open === s.key"
              :aria-controls="`hx-menu-${s.key}`"
              prefetch
              @pointerenter="onEnter(s.key, $event)"
              @pointerleave="onLeave"
              @click="close()"
              @focus="loadSiteNav"
              @touchstart.passive="loadSiteNav"
              @keydown="onTriggerKey(s.key, $event)"
            >
              {{ s.label }}<Icon name="chev" :size="13" />
            </Link>
            <Link
              v-if="patch && patchHref"
              ref="patchPill"
              class="ppill num"
              :class="{ on: onPatch, open: open === 'patch' }"
              :href="patchHref"
              :aria-current="onPatch ? 'page' : undefined"
              aria-haspopup="true"
              :aria-expanded="open === 'patch'"
              aria-controls="hx-menu-patch"
              prefetch
              data-track="header_patch"
              @pointerenter="onPatchEnter"
              @pointerleave="onLeave"
              @keydown="onPatchKey"
              ><Icon name="arrow" :size="14" />Patch {{ patch }}</Link
            >
          </nav>

          <NavMenu
            v-if="openSection"
            :id="`hx-menu-${openSection.key}`"
            :section="openSection"
            :ctx="ctx"
            :path="path"
            :style="{ left: `${menuLeft}px` }"
            @pointerenter="onMenuEnter"
            @pointerleave="onLeave"
            @close="close()"
          />

          <PatchMenu
            v-if="open === 'patch'"
            id="hx-menu-patch"
            :notes="siteNav?.patchNotes ?? null"
            :patch="patch"
            :path="path"
            :style="{ left: `${menuLeft}px` }"
            @pointerenter="onMenuEnter"
            @pointerleave="onLeave"
            @close="close()"
          />

          <div v-if="search" class="hx-search" :class="{ open: searchOpen }">
            <SearchBar
              ref="searchBar"
              variant="header"
              placeholder="Player, champion or pro"
              @close="closeSearch"
            />
          </div>

          <span class="hx-end" :class="{ alone: !search }">
            <button
              v-if="search"
              type="button"
              class="hx-ic hx-only-phone"
              :aria-label="searchOpen ? 'Close the search' : 'Search'"
              :aria-expanded="searchOpen"
              @click="searchOpen ? closeSearch() : openSearch()"
            >
              <Icon :name="searchOpen ? 'x' : 'search'" :size="19" />
            </button>
            <Link
              v-if="path !== '/app'"
              class="btn sm pri hx-get"
              href="/app"
              prefetch
              data-track="header_get_app"
              aria-label="Get the app"
              ><Icon name="download" :size="16" /><span>Get the app</span></Link
            >
            <a
              class="btn sm ico hx-discord"
              :href="DISCORD_URL"
              target="_blank"
              rel="noreferrer"
              data-track="header_discord"
              aria-label="Discord"
              ><DiscordMark :size="19"
            /></a>
            <ThemeToggle />
            <button
              ref="menuButton"
              type="button"
              class="hx-ic hx-burger"
              :class="{ open: mobileOpen }"
              :aria-label="mobileOpen ? 'Close the menu' : 'Menu'"
              :aria-expanded="mobileOpen"
              aria-controls="hx-phone"
              @click="toggleMobile"
            >
              <Icon :name="mobileOpen ? 'x' : 'menu'" :size="20" />
            </button>
          </span>
        </div>
      </div>

      <div v-if="subRow" class="hx-sub sr">
        <nav
          class="wrap"
          :aria-label="
            current ? `${SECTIONS.find((s) => s.key === current)?.label} pages` : 'Pages'
          "
        >
          <Link
            v-for="l in subRow"
            :key="l.href"
            :href="l.href"
            :class="{ on: l.on }"
            :aria-current="l.on ? 'page' : undefined"
            prefetch
            ><SubArt v-if="l.art" :art="l.art" /><span v-else-if="l.dot" class="srd" /><span>{{
              l.label
            }}</span></Link
          >
        </nav>
      </div>

      <PhoneMenu
        v-if="mobileOpen"
        id="hx-phone"
        :ctx="ctx"
        :path="path"
        :patch-href="patchHref"
        :style="{ top: `${sheetTop}px` }"
        @close="closeMobile"
      />
    </div>
  </header>
</template>
