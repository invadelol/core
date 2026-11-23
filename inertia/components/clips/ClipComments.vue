<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import { Link, router } from '@inertiajs/vue3'
import Icon from '../ui/Icon.vue'
import { champIcon, championName } from '../../lib/assets.js'
import { since } from '../../lib/ladders.js'
import { signInHref, useViewer } from '../../lib/account.js'
import { clipApi, clipClock } from '../../lib/clips.js'
import type { Clip, ClipComment } from '../../lib/clip_types.js'

/**
 * A clip's comments: the composer (naming the clip's moment the video is at), then the
 * conversations, the most GG'd first, each with its replies (one level). A comment says the
 * champion its writer played in this game; its time jumps the video there.
 */
const props = defineProps<{
  clip: Clip
  comments: ClipComment[]
  canComment: boolean
  now: number
}>()
const emit = defineEmits<{ seek: [ms: number]; change: [comments: ClipComment[]] }>()

const { viewer } = useViewer()
const list = shallowRef(props.comments)
const SHOWN = 5
const expanded = ref(false)
const ordered = computed(() =>
  [...list.value].sort((a, b) => b.gg - a.gg || Date.parse(a.createdAt) - Date.parse(b.createdAt))
)
const shown = computed(() => (expanded.value ? ordered.value : ordered.value.slice(0, SHOWN)))

const draft = ref('')
const replyTo = ref<string | null>(null)
const replyDraft = ref('')
const busy = ref(false)
const problem = ref('')

function update(next: ClipComment[]) {
  list.value = next
  emit('change', next)
}

async function send(body: string, parentId?: string) {
  if (!body.trim()) return false
  busy.value = true
  problem.value = ''
  try {
    const answer = await clipApi.comment(props.clip.id, {
      body,
      parentId,
      atMs: parentId ? null : Math.round(props.now),
    })
    update(answer.comments)
    return true
  } catch (error) {
    problem.value = error instanceof Error ? error.message : 'That did not go through.'
    return false
  } finally {
    busy.value = false
  }
}
async function post() {
  if (await send(draft.value)) draft.value = ''
}
async function reply(parent: ClipComment) {
  if (await send(replyDraft.value, parent.id)) {
    replyDraft.value = ''
    replyTo.value = null
  }
}
async function remove(comment: ClipComment) {
  try {
    update((await clipApi.uncomment(props.clip.id, comment.id)).comments)
  } catch (error) {
    problem.value = error instanceof Error ? error.message : 'That did not go through.'
  }
}

/** A GG on a comment: signed out, to the sign-in first; one's own comment takes none. */
async function gg(comment: ClipComment) {
  if (!viewer.value) return router.visit(signInHref())
  const on = !comment.ggByViewer
  try {
    const answer = await clipApi.gg(props.clip.id, on, comment.id)
    const patch = (c: ClipComment): ClipComment =>
      c.id === comment.id ? { ...c, ...answer } : { ...c, replies: c.replies.map(patch) }
    update(list.value.map(patch))
  } catch (error) {
    problem.value = error instanceof Error ? error.message : 'That did not go through.'
  }
}

const total = computed(() => list.value.reduce((n, c) => n + 1 + c.replies.length, 0))
const role = (c: ClipComment) =>
  c.byAuthor ? 'author' : c.championId ? `${championName(c.championId)} in this game` : null
</script>

<template>
  <section class="clp-comments" aria-labelledby="clp-comments-h">
    <div class="clp-sec-h">
      <h2 id="clp-comments-h">Comments</h2>
      <span class="meta num">{{ total }}</span>
    </div>

    <form v-if="canComment" class="clp-compose" @submit.prevent="post">
      <img v-if="viewer?.avatarUrl" class="clp-av" :src="viewer.avatarUrl" alt="" />
      <span v-else class="clp-av none"><Icon name="user" :size="16" /></span>
      <label class="field clp-field">
        <input
          v-model="draft"
          maxlength="500"
          placeholder="Add a comment"
          aria-label="Add a comment"
        />
        <span class="clp-stamp num">at {{ clipClock(now) }}</span>
      </label>
      <button type="submit" class="btn sm" :disabled="busy || !draft.trim()">Post</button>
    </form>
    <div v-else-if="!viewer" class="clp-signin">
      <span>Sign in to comment and say GG</span>
      <Link class="btn sm pri" :href="signInHref(`/clip/${clip.id}`)">Sign in</Link>
    </div>
    <p v-else class="meta clp-hint">
      {{
        clip.comments === 'off'
          ? 'Comments are off on this clip.'
          : 'Only the players of this game can comment.'
      }}
    </p>
    <p v-if="problem" class="clp-err" role="alert">{{ problem }}</p>

    <ul class="clp-thread">
      <li v-for="c in shown" :key="c.id" class="clp-c">
        <template v-for="item in [c, ...c.replies]" :key="item.id">
          <div class="clp-c-row" :class="{ reply: item !== c }">
            <span class="clp-face">
              <img v-if="item.author.avatarUrl" class="clp-av" :src="item.author.avatarUrl" alt="" />
              <span v-else class="clp-av none"><Icon name="user" :size="16" /></span>
              <img
                v-if="item.championId"
                class="clp-champ"
                :src="champIcon(item.championId)"
                alt=""
              />
            </span>
            <div class="clp-c-body">
              <p class="clp-c-h">
                <Link :href="`/u/${item.author.handle}`">{{ item.author.name }}</Link>
                <span v-if="role(item)" class="meta">{{ role(item) }}</span>
                <span class="meta">{{ since(Date.parse(item.createdAt)) }}</span>
              </p>
              <p class="clp-c-t">
                <button
                  v-if="item.atMs !== null"
                  type="button"
                  class="clp-c-at num"
                  :aria-label="`Go to ${clipClock(item.atMs)}`"
                  @click="emit('seek', item.atMs!)"
                >
                  {{ clipClock(item.atMs) }}</button
                >{{ item.body }}
              </p>
              <p class="clp-c-acts">
                <button
                  type="button"
                  class="clp-gg"
                  :class="{ on: item.ggByViewer }"
                  :aria-pressed="item.ggByViewer"
                  :disabled="item.mine"
                  @click="gg(item)"
                >
                  GG <span class="num">{{ item.gg }}</span>
                </button>
                <button
                  v-if="item === c && canComment"
                  type="button"
                  class="clp-link"
                  @click="replyTo = replyTo === c.id ? null : c.id"
                >
                  Reply
                </button>
                <button
                  v-if="item.mine || clip.mine"
                  type="button"
                  class="clp-link"
                  @click="remove(item)"
                >
                  Delete
                </button>
              </p>
            </div>
          </div>
        </template>
        <form v-if="replyTo === c.id" class="clp-compose reply" @submit.prevent="reply(c)">
          <label class="field clp-field">
            <input
              v-model="replyDraft"
              maxlength="500"
              :placeholder="`Reply to ${c.author.name}`"
              :aria-label="`Reply to ${c.author.name}`"
            />
          </label>
          <button type="submit" class="btn sm" :disabled="busy || !replyDraft.trim()">Reply</button>
        </form>
      </li>
    </ul>
    <button
      v-if="!expanded && ordered.length > SHOWN"
      type="button"
      class="btn sm clp-more"
      @click="expanded = true"
    >
      Show {{ ordered.length - SHOWN }} more
    </button>
  </section>
</template>
