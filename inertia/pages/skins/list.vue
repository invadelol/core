<script setup lang="ts">
import { computed, ref } from 'vue'
import { Head, Link, router } from '@inertiajs/vue3'
import SiteLayout from '../../components/SiteLayout.vue'
import Icon from '../../components/ui/Icon.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import SkinCell from '../../components/skins/SkinCell.vue'
import PersonAvatar from '../../components/skins/PersonAvatar.vue'
import { browserWrite } from '../../lib/browser_write.js'
import { signInHref, useViewer } from '../../lib/account.js'
import { SKIN_LIMITS, type SkinListPage } from '../../lib/skin_types.js'
import '../../css/skins.css'

/**
 * `/skins/lists/<id>`: one person's list of skins, in their order. Anyone can like it; its owner
 * renames it, takes skins out of it or deletes it (skins go in from a skin's page).
 */
const props = defineProps<{ list: SkinListPage }>()
const { viewer } = useViewer()

const liked = ref(props.list.liked)
const likes = ref(props.list.likes)
const error = ref('')

async function like() {
  if (!viewer.value) return router.visit(signInHref())
  const on = !liked.value
  liked.value = on
  likes.value += on ? 1 : -1
  error.value = ''
  try {
    await browserWrite('PUT', `/api/skin-lists/${props.list.id}/like`, { on })
  } catch (failure) {
    liked.value = !on
    likes.value += on ? -1 : 1
    error.value = (failure as Error).message
  }
}

const editing = ref(false)
const title = ref(props.list.title)
const body = ref(props.list.body)
const busy = ref(false)
async function save() {
  busy.value = true
  error.value = ''
  try {
    await browserWrite('PATCH', `/api/skin-lists/${props.list.id}`, {
      title: title.value,
      body: body.value,
    })
    editing.value = false
    router.reload({ only: ['list'] })
  } catch (failure) {
    error.value = (failure as Error).message
  } finally {
    busy.value = false
  }
}

const removing = ref(false)
async function remove() {
  busy.value = true
  try {
    await browserWrite('DELETE', `/api/skin-lists/${props.list.id}`)
    router.visit(`/u/${props.list.owner.handle}/skins`)
  } catch (failure) {
    error.value = (failure as Error).message
    busy.value = false
  }
}

async function takeOut(skinId: number) {
  error.value = ''
  try {
    await browserWrite('PUT', `/api/skin-lists/${props.list.id}/skins/${skinId}`, { on: false })
    router.reload({ only: ['list'] })
  } catch (failure) {
    error.value = (failure as Error).message
  }
}

const owner = computed(() => `/u/${props.list.owner.handle}`)
</script>

<template>
  <Head :title="list.title" />
  <SiteLayout>
    <div class="wrap skn-wrap">
      <nav class="crumbs skn-crumbs" aria-label="Breadcrumb">
        <Link href="/skins">Skins</Link><Icon name="chevr" /><Link :href="owner">{{
          list.owner.name
        }}</Link
        ><Icon name="chevr" /><span class="t1" aria-current="page">{{ list.title }}</span>
      </nav>

      <header class="skn-lhead">
        <div v-if="!editing">
          <h1 class="skn-h1">{{ list.title }}</h1>
          <div class="skn-lby" style="margin-top: 10px">
            <PersonAvatar :src="list.owner.avatarUrl" :size="20" /><Link :href="owner">{{
              list.owner.name
            }}</Link>
            <span class="num">{{ list.count }} {{ list.count === 1 ? 'skin' : 'skins' }}</span>
          </div>
          <p v-if="list.body">{{ list.body }}</p>
        </div>
        <form v-else class="skn-editor" style="flex: 1; max-width: 640px" @submit.prevent="save">
          <label class="meta" for="skn-list-title">Title</label>
          <input id="skn-list-title" v-model="title" :maxlength="SKIN_LIMITS.listTitle" required />
          <label class="meta" for="skn-list-body">Description</label>
          <textarea id="skn-list-body" v-model="body" :maxlength="SKIN_LIMITS.listBody" />
          <div class="row">
            <button type="button" class="btn sm" @click="editing = false">Cancel</button>
            <button type="submit" class="btn sm" :disabled="busy || !title.trim()">Save</button>
          </div>
        </form>
        <div class="skn-btns" style="margin: 0">
          <button
            type="button"
            class="btn"
            :class="{ ghost: !liked }"
            :aria-pressed="liked"
            @click="like"
          >
            <Icon name="heart" />{{ likes.toLocaleString('en-US') }}
          </button>
          <template v-if="list.mine && !editing">
            <button type="button" class="btn" @click="editing = true">
              <Icon name="pencil" />Edit
            </button>
            <button v-if="!removing" type="button" class="btn ghost" @click="removing = true">
              Delete
            </button>
            <template v-else>
              <button type="button" class="btn" :disabled="busy" @click="remove">
                Delete this list
              </button>
              <button type="button" class="btn ghost" @click="removing = false">Keep it</button>
            </template>
          </template>
        </div>
      </header>
      <p v-if="error" class="skn-err" role="alert">{{ error }}</p>

      <div v-if="list.skins.length" class="skn-row skn-lgrid">
        <div v-for="(s, i) in list.skins" :key="s.id" class="skn-lcell">
          <SkinCell :skin="s" :rank="i + 1" />
          <button
            v-if="list.mine"
            type="button"
            class="btn sm ghost"
            :aria-label="`Take ${s.name} out of the list`"
            @click="takeOut(s.id)"
          >
            <Icon name="x" :size="14" />Take out
          </button>
        </div>
      </div>
      <EmptyState
        v-else
        title="No skins in this list yet"
        :line="list.mine ? 'Add skins from their pages, with Add to a list.' : undefined"
        icon="list"
      />
    </div>
  </SiteLayout>
</template>
