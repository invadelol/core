<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { router } from '@inertiajs/vue3'
import Icon from '../ui/Icon.vue'
import { refreshViewer, setFollow, signInHref, useViewer } from '../../lib/account.js'
import type { FollowKind, FollowState } from '../../lib/account_types.js'

/**
 * Follow a person (an Invade account), a League account or a pro: "Follow", or "Follow back" when
 * they follow the visitor; once followed, "Following" with a check, which reads "Unfollow" under
 * the pointer or the focus and stops following on a click. A visitor is sent to sign in first.
 * The button turns at once and turns back if the server says no; `change` gives the new state
 * (the follower count beside it follows).
 */
const props = withDefaults(
  defineProps<{
    kind: FollowKind
    id: string
    /** What the page said when it was drawn. */
    state: FollowState
    /** The target follows the visitor (a person only): "Follow back". */
    followsYou?: boolean
    /** Who, for the screen reader: "Follow Briar". */
    name: string
    small?: boolean
  }>(),
  { followsYou: false, small: false }
)
const emit = defineEmits<{ change: [state: FollowState] }>()

const { viewer } = useViewer()
const current = ref<FollowState>(props.state)
watch(
  () => props.state,
  (next) => (current.value = next)
)
const busy = ref(false)
const self = computed(() => props.kind === 'user' && viewer.value?.id === props.id)

const label = computed(() => {
  if (current.value.following) return 'Following'
  return props.followsYou ? 'Follow back' : 'Follow'
})

async function toggle() {
  if (!viewer.value) {
    router.visit(signInHref())
    return
  }
  if (busy.value) return
  const before = current.value
  const on = !before.following
  current.value = { following: on, followers: Math.max(0, before.followers + (on ? 1 : -1)) }
  emit('change', current.value)
  busy.value = true
  try {
    current.value = await setFollow(props.kind, props.id, on)
    emit('change', current.value)
    refreshViewer()
  } catch {
    current.value = before
    emit('change', before)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <button
    v-if="!self"
    type="button"
    class="btn fl-btn"
    :class="{ sm: small, on: current.following }"
    :aria-pressed="current.following"
    :aria-label="current.following ? `Unfollow ${name}` : `${label} ${name}`"
    data-track="follow"
    @click="toggle"
  >
    <Icon :name="current.following ? 'following' : 'follow'" :size="small ? 15 : 16" />
    <span class="fl-on">{{ label }}</span>
    <span v-if="current.following" class="fl-off" aria-hidden="true">Unfollow</span>
  </button>
</template>

<style scoped>
/* Following: the check in the accent; "Unfollow" takes its place under the pointer. */
.fl-btn.on :deep(svg) {
  color: var(--acc, var(--v300));
}
.fl-off {
  display: none;
}
@media (hover: hover) {
  .fl-btn.on:hover .fl-on,
  .fl-btn.on:focus-visible .fl-on {
    display: none;
  }
  .fl-btn.on:hover .fl-off,
  .fl-btn.on:focus-visible .fl-off {
    display: inline;
  }
  .fl-btn.on:hover,
  .fl-btn.on:focus-visible {
    color: var(--loss);
  }
  .fl-btn.on:hover :deep(svg),
  .fl-btn.on:focus-visible :deep(svg) {
    color: var(--loss);
  }
}
</style>
