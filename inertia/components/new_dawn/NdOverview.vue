<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Link } from '@inertiajs/vue3'
import Icon from '../ui/Icon.vue'
import DiscordMark from '../header/DiscordMark.vue'
import NdText from './NdText.vue'
import NdPostPic from './NdPostPic.vue'
import NdVote from './NdVote.vue'
import NdPlayer from './NdPlayer.vue'
import { currentOf, playInView, playing } from './teaser.js'
import { DISCORD_URL } from '../../lib/links.js'
import { SHOW_RUNES } from '../../lib/features.js'
import { champIcon } from '../../lib/assets.js'
import { emblemBackgroundFluid } from '../../lib/facet.js'
import {
  CAST,
  CAST_END,
  FACES,
  FAQ,
  ITEMS,
  KIND_LABEL,
  LADDER,
  LATEST,
  MAYHEM,
  NEW_DAWN,
  OPEN_QUESTIONS,
  POSTS,
  RANKED_RUSH,
  RUMOURS,
  RUMOURS_CARD,
  RUNES,
  TEASER,
  TEASER_URL,
  TLDW_2027_URL,
  VICTORIOUS,
  ndImage,
  teaserAt,
  type PostKind,
  type VoteTally,
} from '../../lib/new_dawn.js'
import type { IconName } from '../../lib/icons.js'

/**
 * The hub's Overview: what is next from Riot, the teaser's cast and its new ideas, what changes in
 * January (Ranked Rush, items, runes, skins, Mayhem), the doors to the two other tabs, then what
 * people ask and what Riot has not answered yet.
 */
defineProps<{ votes: Record<string, VoteTally> | null }>()

/** The Mayhem augment, the menu art's own copy (/cdn has no augment art for ARAM). */
const POROKING = '/menu-art/poroking.webp'

const KIND_ICON: Record<PostKind, IconName> = {
  video: 'youtube',
  article: 'page',
  x: 'x',
  reddit: 'reddit',
  page: 'page',
}

const latest = LATEST.map((id) => POSTS.find((p) => p.id === id)!)
const firstSentence = (text: string) => `${text.split('. ')[0].replace(/\.$/, '')}.`
const rumours = RUMOURS_CARD.map((id) => RUMOURS.find((r) => r.id === id)!)
/** A tier's crest from /cdn/emblem, filling its box at any size. */
const crest = (tier: string) => ({ background: emblemBackgroundFluid(tier, 1) ?? '' })
/** The champion on screen while the teaser plays its cast. */
const castNow = computed(() => {
  const now = playing()
  return now !== null && now < CAST_END ? currentOf(CAST.map((c) => c.second)) : null
})
const player = ref<HTMLElement>()
/** Plays the teaser from a moment, the player brought into view when it is out of sight. */
const seek = (second: number) =>
  playInView(second, player.value?.querySelector<HTMLElement>('.nw-vid'))

/** `→` in an item's line: an arrow between its two halves. */
const halves = (line: string) => line.split('→')

/* The ladder's emblems step in from Iron IV to Emerald, 60 ms apart, once it comes into view. */
const ladder = ref<HTMLElement>()
const ladderState = ref<'' | 'nw-wait' | 'nw-in'>('')
let observer: IntersectionObserver | null = null
onMounted(() => {
  const el = ladder.value
  if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  if (el.getBoundingClientRect().top < window.innerHeight) return
  ladderState.value = 'nw-wait'
  observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return
      // One frame in the waiting state, then the steps rise in order.
      requestAnimationFrame(() => (ladderState.value = 'nw-in'))
      observer?.disconnect()
    },
    { threshold: 0.4 }
  )
  observer.observe(el)
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <section class="card nw-nx" aria-label="Next from Riot">
    <span class="nw-zz"><img :src="ndImage('poro-snoozy')" alt="" width="104" height="104" /></span>
    <div class="nw-nxt">
      <span class="lab">Next from Riot</span><b>{{ NEW_DAWN.next.title }}</b
      ><span class="meta">{{ NEW_DAWN.next.line }}</span>
    </div>
    <a class="btn sm" :href="DISCORD_URL" target="_blank" rel="noreferrer" data-track="newdawn_ping"
      ><Icon name="bell" :size="15" />Ping me on Discord</a
    >
  </section>

  <section id="teaser" class="nw-sec" aria-label="In the teaser">
    <div class="sec-h">
      <h2 class="h2">In the teaser</h2>
      <span class="meta num">{{ TEASER.meta }}</span>
      <a class="more" :href="TEASER_URL" target="_blank" rel="noreferrer"
        >Watch on YouTube<Icon name="external" :size="13"
      /></a>
    </div>
    <div ref="player"><NdPlayer /></div>
    <div class="nw-cast">
      <a
        v-for="c in CAST"
        :key="c.key"
        class="nw-c"
        :class="[`nw-c-${c.key}`, { on: castNow === c.second }]"
        :href="teaserAt(c.second)"
        :aria-label="`${c.name}, play the teaser from ${c.time}`"
        target="_blank"
        rel="noreferrer"
        @click.prevent="seek(c.second)"
        ><span class="fr"
          ><img
            :src="ndImage(`teaser-${c.key}`)"
            :alt="`${c.name} in the New Dawn teaser`"
            width="320"
            height="180"
            loading="lazy" /></span
        ><span class="nm"
          ><b>{{ c.name }}</b
          ><span class="meta num">{{ c.time }}</span></span
        ></a
      >
    </div>
    <div class="nw-tz">
      <article class="card nw-god">
        <div class="fr art">
          <img
            :src="ndImage('blitzcrank')"
            alt="Blitzcrank in the New Dawn teaser"
            width="1920"
            height="828"
            loading="lazy"
          />
        </div>
        <div class="txt">
          <span class="lab">The teaser's new idea</span>
          <h3>God Hand</h3>
          <p>{{ TEASER.godHand.text }}</p>
          <div class="nw-srcs">
            <a
              v-for="s in TEASER.godHand.sources"
              :key="s.href"
              class="nw-ext"
              :href="s.href"
              target="_blank"
              rel="noreferrer"
              >{{ s.label }}<Icon name="external" :size="13"
            /></a>
          </div>
          <div class="nw-q">
            <blockquote>{{ TEASER.godHand.quote }}</blockquote>
            <div class="nw-who">
              <img :src="FACES.meddler" alt="" width="22" height="22" loading="lazy" /><span
                class="meta"
                >{{ TEASER.godHand.who }}</span
              ><a
                class="nw-ext"
                :href="TEASER.godHand.href"
                target="_blank"
                rel="noreferrer"
                aria-label="Read the quote"
                ><Icon name="external" :size="13"
              /></a>
            </div>
          </div>
        </div>
      </article>
      <div class="nw-shots">
        <a
          v-for="s in TEASER.shots"
          :key="s.pic"
          class="card nw-shot"
          :href="teaserAt(s.second)"
          target="_blank"
          rel="noreferrer"
          @click.prevent="seek(s.second)"
          ><span class="fr"
            ><img :src="ndImage(s.pic)" :alt="s.alt" width="320" height="180" loading="lazy" /><span
              class="tc"
              >{{ s.time }}</span
            ></span
          >
          <div>
            <b>{{ s.title }}</b>
            <p>{{ s.text }}</p>
            <span v-if="s.faces.length" class="nw-faces"
              ><img
                v-for="f in s.faces"
                :key="f.id"
                :src="champIcon(f.id)"
                :alt="f.name"
                width="26"
                height="26"
                loading="lazy"
            /></span>
          </div>
        </a>
      </div>
    </div>
  </section>

  <section id="january" class="nw-sec" aria-label="Coming in January">
    <div class="sec-h">
      <h2 class="h2">Coming in January</h2>
      <span class="meta">From the 16 Nov dev update</span>
      <a class="more" :href="TLDW_2027_URL" target="_blank" rel="noreferrer"
        >Riot's TL;DW<Icon name="external" :size="13"
      /></a>
    </div>
    <div class="nw-jan">
      <article class="card lit-sheet nw-b nw-rr">
        <div class="bh"><span class="lab">Ranked Rush</span></div>
        <div class="hero">
          <span class="nw-emb" role="img" aria-label="Iron emblem" :style="crest('iron')" />
          <div>
            <h3>{{ RANKED_RUSH.title }}</h3>
            <span class="meta">{{ RANKED_RUSH.when }}</span>
          </div>
        </div>
        <div class="nw-ba">
          <div v-for="(r, i) in RANKED_RUSH.rows" :key="r.key" class="nw-ba-r">
            <span class="nw-k">{{ r.key }}</span>
            <span class="nw-v"
              ><span v-if="i === 0" class="nw-em"
                ><span
                  v-for="t in ['gold', 'emerald', 'master']"
                  :key="t"
                  class="nw-emb"
                  :style="crest(t)" /></span
              >{{ r.before }}</span
            >
            <span class="nw-ar"><Icon name="arrow" :size="16" /></span>
            <span class="nw-v nw-n"
              ><span
                v-if="i === 0"
                class="nw-emb"
                :style="{ ...crest('iron'), width: '30px', height: '30px' }"
              />{{ r.after }}</span
            >
          </div>
        </div>
        <div class="nw-climb">
          <div class="nw-well nw-lad">
            <ol
              ref="ladder"
              class="nw-steps"
              :class="ladderState"
              aria-label="From Iron IV to Emerald"
            >
              <li
                v-for="(s, i) in LADDER"
                :key="s.tier"
                class="nw-step"
                :class="{ 'nw-me': i === LADDER.length - 1 }"
                :style="{ '--i': i }"
              >
                <span class="nw-emb" :style="crest(s.tier)" /><b>{{ s.name }}</b
                ><span>{{ s.note }}</span>
              </li>
            </ol>
          </div>
          <p>{{ RANKED_RUSH.climb }}</p>
          <Link class="more" href="/app" prefetch>Get the app<Icon name="chevr" :size="14" /></Link>
        </div>
      </article>

      <article class="card nw-b nw-items">
        <div class="bh">
          <h3 class="h3">Items</h3>
          <span class="meta">{{ ITEMS.line }}</span>
          <Link class="more" href="/tier-list/items" prefetch
            >Items tier list<Icon name="chevr" :size="14"
          /></Link>
        </div>
        <div class="nw-ig">
          <div v-for="it in ITEMS.changed" :key="it.id" class="nw-it">
            <img
              :src="`/cdn/item/${it.id}.png`"
              :alt="it.name"
              width="44"
              height="44"
              loading="lazy"
            />
            <span
              ><b>{{ it.name }}</b
              ><span class="nw-d"
                ><template v-for="(h, k) in halves(it.line)" :key="k"
                  ><Icon v-if="k" name="arrow" :size="14" />{{ h }}</template
                ></span
              ></span
            >
          </div>
          <div v-for="it in ITEMS.added" :key="it.name" class="nw-it">
            <span class="nw-slot" aria-hidden="true">?</span>
            <span
              ><b>{{ it.name }}<span class="nw-new">New</span></b
              ><span class="nw-d">{{ it.line }}</span></span
            >
          </div>
          <div class="nw-it">
            <span class="nw-slot" aria-hidden="true"><Icon name="x" :size="16" /></span>
            <span
              ><b>{{ ITEMS.removed.name }}</b
              ><span class="nw-d">{{ ITEMS.removed.line }}</span></span
            >
          </div>
        </div>
      </article>

      <article class="card nw-b nw-runes">
        <div class="bh">
          <h3 class="h3">Runes</h3>
          <Link v-if="SHOW_RUNES" class="more" href="/tier-list/runes" prefetch
            >Runes tier list<Icon name="chevr" :size="14"
          /></Link>
        </div>
        <div class="nw-rk">
          <img
            :src="`/cdn/perk/${RUNES.kleptomancy}.png`"
            alt="Kleptomancy"
            width="76"
            height="76"
            loading="lazy"
          />
          <div>
            <b>{{ RUNES.back.title }}</b>
            <p>{{ RUNES.back.line }}</p>
          </div>
        </div>
        <div class="nw-rk">
          <span class="sock" aria-hidden="true">?</span>
          <div>
            <b>{{ RUNES.added.title }}<span class="nw-new">New</span></b>
            <p>{{ RUNES.added.line }}</p>
          </div>
        </div>
      </article>

      <article class="card nw-b nw-vic">
        <div class="bh"><h3 class="h3">Timeless Victorious</h3></div>
        <div class="nw-fan" aria-hidden="true">
          <img
            v-for="(s, k) in VICTORIOUS.skins"
            :key="s.skin"
            :class="['nw-fl', 'nw-fm', 'nw-frr'][k]"
            :src="`/cdn/loading/${s.champion}-${s.skin}.jpg`"
            alt=""
            width="92"
            height="167"
            loading="lazy"
          />
        </div>
        <b>{{ VICTORIOUS.title }}</b>
        <p>{{ VICTORIOUS.line }}</p>
        <span class="meta"
          >{{ VICTORIOUS.note }}
          <a class="nw-ext" :href="VICTORIOUS.noteSource.href" target="_blank" rel="noreferrer"
            >{{ VICTORIOUS.noteSource.label }}<Icon name="external" :size="12" /></a
        ></span>
      </article>

      <article class="card nw-b nw-may">
        <img :src="POROKING" alt="Poro King augment" width="56" height="56" loading="lazy" />
        <div class="nw-tx">
          <b>{{ MAYHEM.title }}</b>
          <p>{{ MAYHEM.line }}</p>
        </div>
      </article>
    </div>
  </section>

  <section class="nw-sec" aria-label="Latest">
    <div class="nw-duo">
      <section class="card nw-card" aria-label="Latest from Riot">
        <div class="nw-ch">
          <Icon name="film" :size="17" />
          <h2 class="h3">Latest from Riot</h2>
          <Link class="more" href="/new-dawn/posts" prefetch
            >All {{ POSTS.length }} posts and videos<Icon name="chevr" :size="14"
          /></Link>
        </div>
        <a
          v-for="p in latest"
          :key="p.id"
          class="nw-lr"
          :href="p.link.href"
          target="_blank"
          rel="noreferrer"
          ><NdPostPic :post="p" small />
          <div>
            <span class="nw-ty"
              ><Icon :name="KIND_ICON[p.kind]" :size="14" />{{ KIND_LABEL[p.kind] }},
              {{ p.when.split(',')[0] }}</span
            >
            <b>{{ p.title }}</b>
            <p>{{ firstSentence(p.said) }}</p>
          </div></a
        >
      </section>
      <section class="card nw-card" aria-label="Rumours">
        <div class="nw-ch">
          <Icon name="chat" :size="17" />
          <h2 class="h3">Rumours</h2>
          <Link class="more" href="/new-dawn/rumours" prefetch
            >All {{ RUMOURS.length }} rumours<Icon name="chevr" :size="14"
          /></Link>
        </div>
        <div v-for="r in rumours" :key="r.id" class="nw-rr2">
          <div class="top">
            <b>{{ r.card?.title ?? r.title }}</b
            ><span class="nw-sts" :class="`st-${r.status}`">{{ r.word }}</span>
          </div>
          <div class="meta src">{{ r.card?.source }}</div>
          <NdVote
            v-if="r.vote"
            :rumour="r.id"
            :question="r.vote.question"
            :tally="votes?.[r.id] ?? null"
            layout="card"
          />
        </div>
      </section>
    </div>
  </section>

  <section id="faq" class="nw-sec" aria-label="What people ask">
    <div class="sec-h"><h2 class="h2">What people ask</h2></div>
    <div class="nw-faq">
      <div v-for="f in FAQ" :key="f.q" class="nw-qa">
        <span class="vis">
          <span v-if="f.visual.kind === 'face'" class="nw-pq"
            ><img :src="FACES[f.visual.face]" alt="Pabro" width="92" height="92" loading="lazy"
          /></span>
          <span v-else-if="f.visual.kind === 'still'" class="fr"
            ><img :src="ndImage(f.visual.pic)" alt="" loading="lazy"
          /></span>
          <span v-else-if="f.visual.kind === 'champions'" class="nw-five"
            ><img
              v-for="id in f.visual.ids"
              :key="id"
              :src="champIcon(id)"
              alt=""
              width="28"
              height="28"
              loading="lazy"
          /></span>
          <span v-else class="nw-ks"
            ><img
              v-for="id in f.visual.ids"
              :key="id"
              :src="`/cdn/perk/${id}.png`"
              alt=""
              width="44"
              height="44"
              loading="lazy"
          /></span>
        </span>
        <div>
          <h3>{{ f.q }}</h3>
          <p><NdText :parts="f.a" /></p>
          <div class="nw-srcs">
            <a v-for="s in f.sources" :key="s.label" :href="s.href" target="_blank" rel="noreferrer"
              >{{ s.label }}<Icon name="external" :size="13"
            /></a>
          </div>
        </div>
      </div>
    </div>
    <div class="card lit-sheet nw-open">
      <img
        class="emo"
        :src="ndImage('blitz-confused')"
        alt=""
        width="148"
        height="148"
        loading="lazy"
      />
      <h3>Not answered yet</h3>
      <div class="nw-og">
        <div v-for="o in OPEN_QUESTIONS" :key="o.q" class="nw-o">
          <b>{{ o.q }}</b
          ><span>{{ o.a }}</span>
        </div>
      </div>
      <div class="nw-nf">
        <Icon name="bell" :size="16" />
        <b>Get a ping when Riot says more</b>
        <span class="meta">#new-dawn on Discord, or What's new in the app</span>
        <span class="btns"
          ><a class="btn sm" :href="DISCORD_URL" target="_blank" rel="noreferrer"
            ><DiscordMark :size="16" />Discord</a
          ><Link class="btn sm" href="/app" prefetch
            ><Icon name="download" :size="16" />Desktop app</Link
          ></span
        >
      </div>
    </div>
  </section>
</template>
