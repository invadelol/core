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
import { ChevronDown, ChevronRight, Download, Search, X } from 'lucide-vue-next'
import { Logo } from '@invadelol/ui'
import SearchBar from './SearchBar.vue'
import ThemeToggle from './ui/ThemeToggle.vue'
import { SECTIONS, type SectionKey } from './header/sections.js'
import { loadSiteNav, siteNav } from '../lib/site_nav.js'
import { season, startSeason } from '../lib/season.js'
import { patchName } from '../lib/patch.js'

/**
 * The site's header, on every page: the mark, the four sections with their menus, the search
 * (a palette under its field, ⌘K from anywhere), the desktop app and the theme. Under 1024px the
 * sections fold into the phone's menu; under 640px the search is a button.
 *
 * Nothing here reads the layout or fetches on load: a menu opens in the frame of its hover, click
 * or key, and its data (`siteNav`) is asked for on the first sign of interest.
 */

/** Christmas (../lib/season.ts): its own chunk, loaded only in season, and only in the browser. */
const SeasonLayer = defineAsyncComponent(() => import('./SeasonLayer.vue'))

/**
 * The menus are their own chunks, asked for on the first sign of interest (a hover, a focus, a
 * touch), so a page carries none of their weight and a menu still opens in the frame it is asked.
 */
const loadMega = () => import('./header/MegaMenu.vue')
const loadMobile = () => import('./header/MobileMenu.vue')
const MegaMenu = defineAsyncComponent(loadMega)
const MobileMenu = defineAsyncComponent(loadMobile)

/** The menus' code and data, once: on hover, focus or touch of anything that opens one. */
function warmMenus() {
  loadSiteNav()
  void loadMega().catch(() => {})
}

const props = withDefaults(
  defineProps<{
    /** Breadcrumb shown after the sections on wide screens, e.g. the player of a match. */
    crumbs?: Array<{ label: string; href?: string }>
    /** Hides the search field, for pages where the search is the page itself. */
    search?: boolean
  }>(),
  { crumbs: undefined, search: true }
)

const page = usePage()
const path = computed(() => page.url.split('?')[0])
const onApp = computed(() => path.value === '/app')
/** Pages with a main action of their own keep the header's download quiet: one violet button a page. */
const QUIET_DOWNLOAD = new Set(['summoner', 'contact', 'desktop/build', 'errors/server_error'])
const loudDownload = computed(() => !QUIET_DOWNLOAD.has(page.component))
/** The newest patch the stats show (a shared prop), as players name it. */
const patch = computed(() => {
  const version = (page.props as { patch?: string | null }).patch
  return version ? patchName(version) : null
})
/** The tier list has its own place in the bar, so Champions is not lit there. */
const onTierList = computed(() => path.value.startsWith('/tier-list'))
const isHere = (key: SectionKey, here: (p: string) => boolean) =>
  here(path.value) && !(key === 'champions' && onTierList.value)

/* ── Section menus ─────────────────────────────────────────────────── */

const open = ref<SectionKey | null>(null)
const root = ref<HTMLElement>()
const triggers = ref<Record<string, HTMLElement | null>>({})
let hoverTimer: ReturnType<typeof setTimeout> | undefined
let leaveTimer: ReturnType<typeof setTimeout> | undefined
let hoveredAt = 0

function show(key: SectionKey) {
  warmMenus()
  clearTimeout(leaveTimer)
  searchOpen.value = false
  open.value = key
}

function close(focusTrigger = false) {
  const was = open.value
  clearTimeout(hoverTimer)
  clearTimeout(leaveTimer)
  open.value = null
  if (focusTrigger && was) triggers.value[was]?.focus()
}

/** A mouse resting on a trigger opens its menu; moving to another trigger switches at once. */
function onEnter(key: SectionKey, event: PointerEvent) {
  if (event.pointerType !== 'mouse') return
  warmMenus()
  clearTimeout(leaveTimer)
  clearTimeout(hoverTimer)
  if (open.value === key) return
  if (open.value) {
    hoveredAt = performance.now()
    return show(key)
  }
  hoverTimer = setTimeout(() => {
    hoveredAt = performance.now()
    show(key)
  }, 110)
}

function onLeave(key: SectionKey, event: PointerEvent) {
  if (event.pointerType !== 'mouse') return
  clearTimeout(hoverTimer)
  if (open.value === key) leaveTimer = setTimeout(() => close(), 200)
}

function onTrigger(key: SectionKey) {
  // The click that follows a hover's opening keeps the menu open instead of closing it.
  if (open.value === key && performance.now() - hoveredAt > 450) return close()
  show(key)
}

const ORDER = SECTIONS.map((s) => s.key)

function onTriggerKey(key: SectionKey, event: KeyboardEvent) {
  const at = ORDER.indexOf(key)
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    show(key)
    nextTick(() => document.querySelector<HTMLElement>(`#sh-menu-${key} a[href]`)?.focus())
  } else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
    event.preventDefault()
    const next = ORDER[(at + (event.key === 'ArrowRight' ? 1 : ORDER.length - 1)) % ORDER.length]
    // Moving the focus closes the menu it leaves (focusout): an open menu follows the focus.
    const wasOpen = Boolean(open.value)
    triggers.value[next]?.focus()
    if (wasOpen) show(next)
  } else if (event.key === 'Escape' && open.value) {
    event.preventDefault()
    close(true)
  }
}

/** The focus leaving a section (Tab past its last link) closes its menu. */
function onFocusOut(key: SectionKey, event: FocusEvent) {
  const to = event.relatedTarget as Node | null
  if (open.value === key && to && !(event.currentTarget as HTMLElement).contains(to)) close()
}

/* ── Search palette ────────────────────────────────────────────────── */

const searchOpen = ref(false)
/**
 * Mounted (hidden, but laid out) on the first sign of interest, so the tap that opens it only
 * shows it and can focus its field at once, which is what lets a phone raise its keyboard.
 */
const searchReady = ref(false)
const palette = ref<HTMLElement>()
const searchBar = ref<InstanceType<typeof SearchBar>>()
const searchTrigger = ref<HTMLElement>()

function prepareSearch() {
  searchReady.value = true
}

/** Shown and focused within the tap or the key, which is what lets a phone raise its keyboard. */
function openSearch() {
  close()
  mobileOpen.value = false
  if (!searchReady.value) {
    searchReady.value = true
    searchOpen.value = true
    nextTick(() => searchBar.value?.focus())
    return
  }
  searchOpen.value = true
  // Laid out while hidden since the hover: showing it is a style change, and the focus is free.
  palette.value?.classList.remove('off')
  searchBar.value?.focus()
}

/** The phone's search button opens the palette, and closes it when it is open. */
function toggleSearch() {
  if (searchOpen.value) closeSearch()
  else openSearch()
}

function closeSearch(focusTrigger = false) {
  searchOpen.value = false
  if (focusTrigger) searchTrigger.value?.focus()
}

function onHotkey(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && props.search) {
    event.preventDefault()
    openSearch()
  }
}

/* ── Phone menu ────────────────────────────────────────────────────── */

const mobileOpen = ref(false)
const menuButton = ref<HTMLElement>()

function toggleMobile() {
  close()
  searchOpen.value = false
  mobileOpen.value = !mobileOpen.value
  if (mobileOpen.value) loadSiteNav()
}

function warmMobile() {
  loadSiteNav()
  void loadMobile().catch(() => {})
}

function closeMobile(focusButton = false) {
  mobileOpen.value = false
  if (focusButton) menuButton.value?.focus()
}

/** The page under the phone's menu holds still. */
watch(mobileOpen, (on) => document.documentElement.classList.toggle('sh-locked', on))

/* ── Shared listeners: only while something is open ────────────────── */

function onPointerDown(event: PointerEvent) {
  const target = event.target as Node
  if (open.value && !root.value?.querySelector('.sh-nav')?.contains(target)) close()
  const zone = root.value?.querySelectorAll('.sh-search-zone, .sh-only-phone') ?? []
  if (searchOpen.value && ![...zone].some((el) => el.contains(target))) closeSearch()
}

function onKey(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  if (searchOpen.value) closeSearch(true)
  else if (mobileOpen.value) closeMobile(true)
  else if (open.value) close(true)
}

const anyOpen = computed(() => Boolean(open.value || searchOpen.value || mobileOpen.value))
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

/** The phone's menu has no place on a wide screen: widening the window folds it away. */
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
  document.documentElement.classList.remove('sh-locked')
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
  <header ref="root" class="chrome sh-head" :class="{ 'is-menu': mobileOpen }">
    <a href="#main" class="sh-skip" @click="skip">Skip to content</a>
    <template v-if="season">
      <SeasonLayer part="chrome" />
      <SeasonLayer part="ground" />
    </template>

    <div class="page sh-in">
      <Link href="/" class="sh-logo" aria-label="invade.lol home" prefetch>
        <Logo :size="22" word />
      </Link>

      <nav class="sh-nav" aria-label="Sections">
        <Link
          href="/"
          class="sh-trig sh-plain"
          :class="{ on: path === '/' }"
          :aria-current="path === '/' ? 'page' : undefined"
          prefetch
          >Home</Link
        >
        <template v-for="s in SECTIONS" :key="s.key">
          <div
            class="sh-item"
            @pointerenter="onEnter(s.key, $event)"
            @pointerleave="onLeave(s.key, $event)"
            @focusout="onFocusOut(s.key, $event)"
          >
            <button
              :ref="(el) => (triggers[s.key] = el as HTMLElement | null)"
              type="button"
              class="sh-trig"
              :class="{ on: isHere(s.key, s.here), open: open === s.key }"
              :aria-expanded="open === s.key"
              :aria-controls="`sh-menu-${s.key}`"
              @click="onTrigger(s.key)"
              @focus="warmMenus"
              @touchstart.passive="warmMenus"
              @keydown="onTriggerKey(s.key, $event)"
            >
              {{ s.label
              }}<span class="chev"
                ><ChevronDown :size="13" :stroke-width="1.8" aria-hidden="true"
              /></span>
            </button>
            <MegaMenu
              v-if="open === s.key"
              :id="`sh-menu-${s.key}`"
              :section="s"
              :nav="siteNav"
              @close="close"
            />
          </div>
          <Link
            v-if="s.key === 'champions'"
            href="/tier-list"
            class="sh-trig sh-plain"
            :class="{ on: onTierList }"
            :aria-current="onTierList ? 'page' : undefined"
            prefetch
            >Tier list</Link
          >
        </template>
      </nav>

      <nav v-if="crumbs?.length" class="sh-crumbs" aria-label="Breadcrumb">
        <template v-for="crumb in crumbs" :key="crumb.label">
          <ChevronRight :size="13" :stroke-width="1.8" class="chev" aria-hidden="true" />
          <Link v-if="crumb.href" :href="crumb.href" class="c">{{ crumb.label }}</Link>
          <span v-else class="c here" aria-current="page">{{ crumb.label }}</span>
        </template>
      </nav>

      <div v-if="search" class="sh-search-zone">
        <button
          ref="searchTrigger"
          type="button"
          class="sh-field"
          :class="{ focus: searchOpen }"
          aria-haspopup="dialog"
          :aria-expanded="searchOpen"
          @pointerenter="prepareSearch"
          @touchstart.passive="prepareSearch"
          @focus="prepareSearch"
          @click="openSearch"
        >
          <Search :size="15" :stroke-width="1.8" aria-hidden="true" />
          <span class="ph">Search</span>
          <span class="sr-only">a player, a champion or a pro</span>
          <kbd>⌘ K</kbd>
        </button>
        <div
          v-if="searchReady"
          ref="palette"
          class="sh-pop sh-palette"
          :class="{ off: !searchOpen }"
          role="dialog"
          aria-label="Search"
        >
          <SearchBar
            ref="searchBar"
            variant="palette"
            placeholder="Search a player, champion or pro"
            @close="closeSearch(true)"
          />
        </div>
      </div>

      <div class="sh-end" :class="{ alone: !search }">
        <Link
          v-if="patch"
          href="/stats?view=patch"
          prefetch
          class="sh-patch num"
          data-track="header_patch"
          >Patch {{ patch }}</Link
        >
        <Link
          v-if="!onApp"
          href="/app"
          prefetch
          class="iv-btn sm sh-get"
          :class="{ primary: loudDownload }"
          data-track="header_get_app"
        >
          <Download :size="14" :stroke-width="1.8" aria-hidden="true" />Get the app
        </Link>
        <ThemeToggle class="sh-theme" />
        <button
          v-if="search"
          type="button"
          class="sh-ib sh-only-phone"
          aria-label="Search"
          :aria-expanded="searchOpen"
          @touchstart.passive="prepareSearch"
          @pointerenter="prepareSearch"
          @click="toggleSearch"
        >
          <Search :size="18" :stroke-width="1.8" aria-hidden="true" />
        </button>
        <button
          ref="menuButton"
          type="button"
          class="sh-ib sh-burger"
          :class="{ on: mobileOpen }"
          :aria-label="mobileOpen ? 'Close menu' : 'Menu'"
          :aria-expanded="mobileOpen"
          aria-controls="sh-mobile"
          @pointerenter="warmMobile"
          @touchstart.passive="warmMobile"
          @focus="warmMobile"
          @click="toggleMobile"
        >
          <X v-if="mobileOpen" :size="20" :stroke-width="1.8" aria-hidden="true" />
          <svg v-else class="burger" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
      </div>
    </div>

    <MobileMenu
      v-if="mobileOpen"
      id="sh-mobile"
      :nav="siteNav"
      :path="path"
      :search="search"
      :close-button="menuButton ?? null"
      @close="closeMobile"
      @search="openSearch"
    />
  </header>
</template>
