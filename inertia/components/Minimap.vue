<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { champIcon, championName, mapImage } from '../lib/assets.js'
import type { MapDot } from '../lib/match.js'

const props = withDefaults(
  defineProps<{
    dots: MapDot[]
    /** Recent positions per player, oldest first. */
    trails?: Record<string, Array<{ x: number; y: number }>>
    highlight?: string
    /** Riot's map id; 11 is Summoner's Rift. */
    mapId?: number
  }>(),
  { highlight: '', mapId: 11 }
)

/**
 * Riot's own minimap, served through our mirror, with the timeline's
 * coordinates plotted on it.
 *
 * The proxy always answers with an image, so a failed upstream would show a
 * grey tile rather than a broken one. It labels those with `X-Asset-Source`,
 * and that header is what decides between the real art and the drawn
 * stand-in below it.
 */
const art = ref<string | null>(null)

async function resolveArt() {
  const url = mapImage(props.mapId)
  try {
    const res = await fetch(url)
    // The browser keeps the bytes, so the <img> below costs no second request.
    art.value = res.ok && res.headers.get('x-asset-source') !== 'placeholder' ? url : null
  } catch {
    art.value = null
  }
}

onMounted(resolveArt)
watch(() => props.mapId, resolveArt)
</script>

<template>
  <div class="relative aspect-square w-full overflow-hidden rounded-[8px] bg-sunken">
    <img
      v-if="art"
      :src="art"
      alt="Map"
      class="absolute inset-0 h-full w-full object-cover"
      style="filter: var(--map-tone)"
    />

    <!-- A drawn Rift, used only when the real art cannot be reached. -->
    <svg v-else viewBox="0 0 100 100" class="absolute inset-0 h-full w-full">
      <rect x="0" y="0" width="100" height="100" fill="var(--color-sunken)" />
      <g fill="none" stroke="var(--color-line-2)" stroke-width="5.5" stroke-linecap="round">
        <path d="M11 89 L11 20 Q11 11 20 11 L89 11" />
        <path d="M17 83 L83 17" />
        <path d="M11 89 L80 89 Q89 89 89 80 L89 11" />
      </g>
    </svg>

    <!-- Which end of the map is which, readable at a glance -->
    <div
      class="pointer-events-none absolute inset-0"
      style="
        background:
          radial-gradient(
            circle at 0% 100%,
            color-mix(in srgb, var(--color-blue) 42%, transparent),
            transparent 34%
          ),
          radial-gradient(
            circle at 100% 0%,
            color-mix(in srgb, var(--color-red) 42%, transparent),
            transparent 34%
          );
      "
    />

    <!-- Positions, on whichever ground is showing -->
    <svg viewBox="0 0 100 100" class="absolute inset-0 h-full w-full">
      <defs>
        <clipPath id="mm-dot"><circle cx="0" cy="0" r="2.7" /></clipPath>
      </defs>

      <g v-if="trails">
        <polyline
          v-for="dot in dots"
          :key="`trail-${dot.puuid}`"
          :points="(trails[dot.puuid] ?? []).map((p) => `${p.x},${p.y}`).join(' ')"
          fill="none"
          :stroke="dot.teamId === 100 ? 'var(--color-blue)' : 'var(--color-red)'"
          stroke-width="1"
          stroke-linecap="round"
          stroke-linejoin="round"
          :opacity="dot.puuid === highlight ? 0.9 : 0.45"
        />
      </g>

      <g v-for="dot in dots" :key="dot.puuid">
        <circle :cx="dot.x" :cy="dot.y" r="3.9" fill="#000" fill-opacity="0.55" />
        <g :transform="`translate(${dot.x} ${dot.y})`">
          <image
            :href="champIcon(dot.championId)"
            x="-2.7"
            y="-2.7"
            width="5.4"
            height="5.4"
            clip-path="url(#mm-dot)"
            preserveAspectRatio="xMidYMid slice"
          >
            <title>{{ championName(dot.championId) }} · level {{ dot.level }}</title>
          </image>
        </g>
        <circle
          :cx="dot.x"
          :cy="dot.y"
          r="3"
          fill="none"
          :stroke="dot.teamId === 100 ? 'var(--color-blue)' : 'var(--color-red)'"
          :stroke-width="dot.puuid === highlight ? 1.1 : 0.8"
        />
        <circle
          v-if="dot.puuid === highlight"
          :cx="dot.x"
          :cy="dot.y"
          r="4.9"
          fill="none"
          stroke="var(--color-ink)"
          stroke-width="0.8"
          stroke-opacity="0.85"
        />
      </g>
    </svg>
  </div>
</template>
