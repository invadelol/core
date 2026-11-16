<script setup lang="ts">
import SiteLayout from './SiteLayout.vue'
import Masthead from './ui/Masthead.vue'

/** The privacy policy and the legal notice (Facet): the site's frame around one column of text. */
defineProps<{ title: string; updated?: string | null }>()
</script>

<template>
  <SiteLayout>
    <div class="wrap">
      <Masthead :title="title" :meta="updated ? `Last updated ${updated}` : null" />
      <article class="legal">
        <slot />
      </article>
    </div>
  </SiteLayout>
</template>

<style>
.vb .legal {
  max-width: 720px;
  padding-bottom: 24px;
}
.vb .legal > :first-child {
  margin-top: 0;
}
.vb .legal h2 {
  margin-top: 40px;
  font-size: 20px;
  line-height: 1.2;
  font-weight: 650;
  letter-spacing: -0.012em;
  color: var(--t1);
  scroll-margin-top: 24px;
}
.vb .legal h3 {
  margin-top: 24px;
  font-size: 16px;
  font-weight: 650;
  color: var(--t1);
}
.vb .legal p,
.vb .legal li {
  font-size: 15px;
  line-height: 1.65;
  color: var(--t2);
}
.vb .legal p {
  margin-top: 12px;
}
.vb .legal ul {
  margin-top: 12px;
  padding-left: 1.25rem;
  list-style: disc;
}
.vb .legal li + li {
  margin-top: 6px;
}
.vb .legal li::marker {
  color: var(--t4);
}
.vb .legal strong {
  font-weight: 650;
  color: var(--t1);
}
.vb .legal a {
  color: var(--t1);
  text-decoration: underline;
  text-decoration-color: var(--line-3);
  text-underline-offset: 2px;
  overflow-wrap: anywhere;
}
.vb .legal a:hover {
  text-decoration-color: currentColor;
}
.vb .legal .fine {
  margin-top: 40px;
  font-size: 13px;
  color: var(--t3);
}
.vb .legal table {
  width: 100%;
  margin-top: 12px;
  border-collapse: collapse;
  font-size: 14px;
}
.vb .legal th,
.vb .legal td {
  padding: 8px 10px;
  border-top: 1px solid var(--line);
  text-align: left;
  vertical-align: top;
  color: var(--t2);
}
.vb .legal th {
  font-size: 12px;
  font-weight: 650;
  color: var(--t3);
}
</style>
