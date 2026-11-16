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
import AccountMenu from './header/AccountMenu.vue'
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
 * The site's header, on every page (Facet): one bar with the mark, the four sections and their
 * small menus, the patch pill, the search (a field with its region; its results drop under it),
 * the desktop app and the account corner; under it, the plain-text row of the section you are in.
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
    sub?: Array<{ label: string; href: string; on?: boolean }> | null
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
const subRow = computed(() => {
  if (props.sub) return props.sub
  const section = SECTIONS.find((s) => s.key === current.value)
  if (!section) return null
  return section.links.map((l) => ({
    label: l.short ?? l.label,
    href: l.href,
    on: l.key === place.value?.link.key,
  }))
})

/* ── Section menus ─────────────────────────────────────────────────── */

const open = ref<SectionKey | 'account' | null>(null)
const root = ref<HTMLElement>()
const bar = ref<HTMLElement>()
const triggers = ref<Record<string, HTMLElement | null>>({})
/** Where the open menu sits in the bar: under its trigger, its left edge on the trigger's. */
const menuLeft = ref(0)
let hoverTimer: ReturnType<typeof setTimeout> | undefined
let leaveTimer: ReturnType<typeof setTimeout> | undefined
let hoveredAt = 0

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
  if (focusTrigger && was) (was === 'account' ? accountButton.value : triggers.value[was])?.focus()
}

/** A mouse resting on a trigger opens its menu; moving to another trigger switches at once. */
function onEnter(key: SectionKey, event: PointerEvent) {
  if (event.pointerType !== 'mouse') return
  loadSiteNav()
  clearTimeout(leaveTimer)
  clearTimeout(hoverTimer)
  if (open.value === key) return
  if (open.value && open.value !== 'account') {
    hoveredAt = performance.now()
    return show(key)
  }
  hoverTimer = setTimeout(() => {
    hoveredAt = performance.now()
    show(key)
  }, 110)
}

function onLeave(event: PointerEvent) {
  if (event.pointerType !== 'mouse') return
  clearTimeout(hoverTimer)
  if (open.value && open.value !== 'account') leaveTimer = setTimeout(() => close(), 220)
}

function onMenuEnter() {
  clearTimeout(leaveTimer)
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

/* ── Account ───────────────────────────────────────────────────────── */

const accountButton = ref<HTMLElement>()
function toggleAccount() {
  if (open.value === 'account') return close()
  clearTimeout(leaveTimer)
  open.value = 'account'
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

function toggleMobile() {
  close()
  searchOpen.value = false
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
          <Link class="brand" href="/" aria-label="Invade home" prefetch>
            <Glyph :h="26" /><span class="wm">Invade</span>
          </Link>

          <nav class="hx-nav" aria-label="Site">
            <button
              v-for="s in SECTIONS"
              :key="s.key"
              :ref="(el) => (triggers[s.key] = el as HTMLElement | null)"
              type="button"
              :class="{ on: current === s.key && open !== s.key, open: open === s.key }"
              :aria-expanded="open === s.key"
              :aria-controls="`hx-menu-${s.key}`"
              @pointerenter="onEnter(s.key, $event)"
              @pointerleave="onLeave"
              @click="onTrigger(s.key)"
              @focus="loadSiteNav"
              @touchstart.passive="loadSiteNav"
              @keydown="onTriggerKey(s.key, $event)"
            >
              {{ s.label }}<Icon name="chev" :size="13" />
            </button>
            <Link
              v-if="patch && patchHref"
              class="ppill num"
              :class="{ on: onPatch }"
              :href="patchHref"
              :aria-current="onPatch ? 'page' : undefined"
              prefetch
              data-track="header_patch"
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
            <button
              ref="accountButton"
              type="button"
              class="hx-me"
              :class="{ open: open === 'account' }"
              aria-label="Theme and links"
              :aria-expanded="open === 'account'"
              @click="toggleAccount"
            >
              <span class="av"><Icon name="user" :size="18" /></span><Icon name="chev" :size="13" />
            </button>
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

          <AccountMenu v-if="open === 'account'" @close="close()" />
        </div>
      </div>

      <div v-if="subRow" class="hx-sub">
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
            >{{ l.label }}</Link
          >
        </nav>
      </div>

      <PhoneMenu
        v-if="mobileOpen"
        id="hx-phone"
        :ctx="ctx"
        :path="path"
        :patch-href="patchHref"
        @close="closeMobile"
      />
    </div>
  </header>
</template>
