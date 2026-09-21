/// <reference path="../../adonisrc.ts" />
/// <reference path="../../config/inertia.ts" />
/// <reference types="vite/client" />

import '../css/app.css'
import { createSSRApp, h } from 'vue'
import type { DefineComponent } from 'vue'
import { createInertiaApp } from '@inertiajs/vue3'
import { resolvePageComponent } from '@adonisjs/inertia/helpers'
import { installIconFallback } from '../lib/icon-fallback.js'
import { watchPalette } from '../lib/chart.js'

installIconFallback()
// Charts read their colours from the themed tokens, so they have to be told
// when the theme changes.
watchPalette()

const appName = import.meta.env.VITE_APP_NAME || 'invade.lol'

createInertiaApp({
  progress: { color: '#5b47e0' },

  title: (title: string) => (title ? `${title} · ${appName}` : appName),

  resolve: (name: string) => {
    return resolvePageComponent(
      `../pages/${name}.vue`,
      import.meta.glob<DefineComponent>('../pages/**/*.vue')
    )
  },

  setup({ el, App, props, plugin }) {
    createSSRApp({ render: () => h(App, props) })
      .use(plugin)
      .mount(el)
  },
})
