<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3'
import LegalLayout from '../../components/LegalLayout.vue'
import type { LegalPublisher } from '../../lib/legal.js'

/** `/legal`: who publishes and hosts invade.lol (mentions légales), and the terms of use. */
defineProps<{ publisher: LegalPublisher }>()
</script>

<template>
  <Head title="Legal notice" />

  <LegalLayout title="Legal notice">
    <h2>Publisher</h2>
    <ul>
      <li v-if="publisher.name">{{ publisher.name }}</li>
      <li v-if="publisher.address">{{ publisher.address }}</li>
      <li v-if="publisher.email">
        <a :href="`mailto:${publisher.email}`">{{ publisher.email }}</a>
      </li>
      <li v-if="publisher.phone">{{ publisher.phone }}</li>
    </ul>
    <p v-if="!publisher.address">
      The publisher is a private individual whose identity is held by the host, as article 6-III-2
      of the French law for confidence in the digital economy (LCEN) allows.
    </p>
    <p v-if="publisher.name">Publication director: {{ publisher.name }}.</p>

    <template v-if="publisher.host">
      <h2>Host</h2>
      <p>{{ publisher.host }}</p>
    </template>

    <p>
      What invade.lol and the desktop app process is in the
      <Link href="/privacy">privacy policy</Link>.
    </p>

    <h2 id="terms">Terms of use</h2>
    <ul>
      <li>Invade and invade.lol are free and provided as they are, without warranty.</li>
      <li>
        The app is for your personal use. Don’t resell it, repackage it or use it to get around
        Riot’s rules.
      </li>
      <li>Don’t scrape invade.lol or overload its API. We may block abusive traffic.</li>
      <li>Your use of League of Legends stays governed by Riot’s own terms.</li>
      <li>French law applies.</li>
    </ul>
  </LegalLayout>
</template>
