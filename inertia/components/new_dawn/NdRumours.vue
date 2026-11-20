<script setup lang="ts">
import Icon from '../ui/Icon.vue'
import NdVote from './NdVote.vue'
import { DISCORD_URL } from '../../lib/links.js'
import {
  FACES,
  RUMOURS,
  RUMOUR_RULES,
  ndImage,
  type RumourStatus,
  type VoteTally,
} from '../../lib/new_dawn.js'
import type { IconName } from '../../lib/icons.js'

/**
 * The hub's Rumours: what leakers, insiders and the press said about New Dawn, each with who said
 * it and when, its status in one word, Riot's answer with its link, and a no-stakes vote while
 * Riot has not settled it. A status changes when Riot speaks, never on a vote.
 */
defineProps<{ votes: Record<string, VoteTally> | null }>()

const GLYPH: Record<RumourStatus, IconName> = {
  yes: 'check',
  half: 'half',
  open: 'question',
  no: 'x',
}
const CLOSED: Record<'yes' | 'no', { title: string; line: string }> = {
  yes: { title: 'Happened', line: 'Riot confirmed it. No vote.' },
  no: { title: 'Closed', line: 'Riot answered. No vote.' },
}
const count = (s: RumourStatus) => RUMOURS.filter((r) => r.status === s).length
const tally = [
  { n: RUMOURS.length, label: 'Reports' },
  { n: count('yes'), label: 'Confirmed' },
  { n: count('half'), label: 'Half right' },
  { n: count('open'), label: 'Open' },
  { n: count('no'), label: 'Debunked or missed' },
]
</script>

<template>
  <div class="nw-rum">
    <section class="card lit-sheet nw-ri" aria-label="Rumours">
      <span class="nw-tea"
        ><img :src="ndImage('poro-brew')" alt="" width="140" height="140"
      /></span>
      <div>
        <h2 class="h2">Rumours</h2>
        <p>What leakers, insiders and the press said about New Dawn, next to what Riot answered.</p>
        <div class="nw-tally">
          <div v-for="t in tally" :key="t.label">
            <b>{{ t.n }}</b
            ><span>{{ t.label }}</span>
          </div>
        </div>
      </div>
      <ul class="nw-rules">
        <li v-for="r in RUMOUR_RULES" :key="r">
          <Icon name="check" :size="15" /><span>{{ r }}</span>
        </li>
      </ul>
    </section>

    <section class="card nw-rl" aria-label="Reports">
      <article v-for="r in RUMOURS" :key="r.id" class="nw-rw">
        <figure class="nw-rp fr">
          <img
            :src="r.pic.src"
            alt=""
            loading="lazy"
            :style="r.pic.pos ? { objectPosition: r.pic.pos } : undefined"
          />
          <figcaption>{{ r.pic.caption }}</figcaption>
        </figure>
        <div class="nw-rbody">
          <div class="nw-rst">
            <span class="nw-sts" :class="`st-${r.status}`"
              ><Icon :name="GLYPH[r.status]" :size="15" />{{ r.word }}</span
            ><span class="lab">{{ r.date }}</span>
          </div>
          <h3>{{ r.title }}</h3>
          <p class="nw-cl">{{ r.claim }}</p>
          <div class="nw-rby">
            <span>Reported by</span
            ><a
              v-for="s in r.reportedBy"
              :key="s.label"
              class="nw-ext"
              :href="s.href"
              target="_blank"
              rel="noreferrer"
              >{{ s.label }}<Icon name="external" :size="13"
            /></a>
          </div>
          <div v-if="r.answer" class="nw-ans">
            <img :src="FACES[r.answer.face]" alt="" width="30" height="30" loading="lazy" />
            <div>
              <div class="nw-aq">{{ r.answer.quote }}</div>
              <div class="nw-aw">
                <span>Riot's answer</span
                ><a class="nw-ext" :href="r.answer.who.href" target="_blank" rel="noreferrer"
                  >{{ r.answer.who.label }}<Icon name="external" :size="13"
                /></a>
              </div>
            </div>
          </div>
          <div v-else class="nw-ans nw-ans0">
            <div class="nw-aq">Riot hasn't answered. The January reveal should.</div>
          </div>
        </div>
        <NdVote
          v-if="r.vote"
          :rumour="r.id"
          :question="r.vote.question"
          :tally="votes?.[r.id] ?? null"
          layout="row"
        />
        <div v-else class="nw-rv">
          <span class="nw-closed"
            ><b>{{ CLOSED[r.status === 'yes' ? 'yes' : 'no'].title }}</b
            >{{ CLOSED[r.status === 'yes' ? 'yes' : 'no'].line }}</span
          >
        </div>
      </article>

      <article class="nw-rw nw-rw0">
        <span class="nw-rp nw-rp0" aria-hidden="true">?</span>
        <div class="nw-rbody">
          <div class="nw-rst"><span class="nw-sts st-no">Nothing yet</span></div>
          <h3>A release date leak</h3>
          <p class="nw-cl">Nobody with a track record has a month. Riot says later in 2027.</p>
        </div>
        <div class="nw-rv">
          <span class="nw-closed"><b>Seen one?</b>Post it with its link in #new-dawn.</span>
          <a class="btn sm" :href="DISCORD_URL" target="_blank" rel="noreferrer"
            ><Icon name="discord" :size="16" />Open #new-dawn</a
          >
        </div>
      </article>
    </section>
  </div>
</template>
