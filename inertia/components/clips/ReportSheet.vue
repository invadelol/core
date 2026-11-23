<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import Icon from '../ui/Icon.vue'
import { REPORT_WORDS, clipApi } from '../../lib/clips.js'
import { REPORT_NOTE_MAX, REPORT_REASONS, type ReportReason } from '../../lib/clip_types.js'

/**
 * Reports a clip, or one of its comments, to the team: why (one reason) and a few words if the
 * person wants. Sent once; the sheet then says it arrived.
 */
const props = defineProps<{
  clipId: string
  /** The comment reported, with its writer's name; none for the clip itself. */
  comment: { id: string; author: string } | null
}>()
const emit = defineEmits<{ close: [] }>()

const dialog = ref<HTMLDialogElement | null>(null)
const reasons = ref<HTMLFieldSetElement | null>(null)
const reason = ref<ReportReason | null>(null)
const note = ref('')
const busy = ref(false)
const problem = ref('')
const sent = ref(false)

const title = computed(() =>
  props.comment ? `Report ${props.comment.author}’s comment` : 'Report this clip'
)

async function send() {
  if (!reason.value || busy.value) return
  busy.value = true
  problem.value = ''
  try {
    await clipApi.report(
      props.clipId,
      { reason: reason.value, note: note.value.trim() },
      props.comment?.id
    )
    sent.value = true
  } catch (error) {
    problem.value = error instanceof Error ? error.message : 'That did not go through.'
  } finally {
    busy.value = false
  }
}

onMounted(() => {
  dialog.value?.showModal()
  reasons.value?.querySelector('input')?.focus()
})
</script>

<template>
  <dialog
    ref="dialog"
    class="clp-sheet"
    aria-labelledby="clp-report-title"
    @close="emit('close')"
    @click.self="dialog?.close()"
  >
    <div class="clp-sheet-in">
      <div class="clp-sheet-h">
        <h2 id="clp-report-title">{{ sent ? 'Thanks for telling us' : title }}</h2>
        <button type="button" class="btn sm ico" aria-label="Close" @click="dialog?.close()">
          <Icon name="x" />
        </button>
      </div>

      <template v-if="sent">
        <p class="clp-sheet-t">The team will look at it. Nobody else knows you sent it.</p>
        <div class="clp-sheet-f">
          <button type="button" class="btn" @click="dialog?.close()">Close</button>
        </div>
      </template>

      <form v-else class="clp-report" @submit.prevent="send">
        <fieldset ref="reasons" class="clp-reasons">
          <legend class="clp-sheet-t">What’s wrong with it?</legend>
          <label v-for="r in REPORT_REASONS" :key="r" class="clp-reason">
            <input v-model="reason" type="radio" name="reason" :value="r" />
            <span>{{ REPORT_WORDS[r] }}</span>
          </label>
        </fieldset>
        <label class="clp-note">
          <span class="clp-note-h"
            ><span>Add a note</span
            ><span class="meta num">{{ note.length }} / {{ REPORT_NOTE_MAX }}</span></span
          >
          <textarea
            v-model="note"
            :maxlength="REPORT_NOTE_MAX"
            rows="3"
            placeholder="Optional"
          ></textarea>
        </label>
        <p v-if="problem" class="clp-err" role="alert">{{ problem }}</p>
        <div class="clp-sheet-f">
          <button type="button" class="btn" @click="dialog?.close()">Cancel</button>
          <button type="submit" class="btn pri" :disabled="!reason || busy">Send report</button>
        </div>
      </form>
    </div>
  </dialog>
</template>
