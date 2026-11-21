/// <reference path="../../adonisrc.ts" />
/// <reference path="../../config/inertia.ts" />
/// <reference types="vite/client" />

import '../css/app.css'
import { createSSRApp, h } from 'vue'
import type { DefineComponent } from 'vue'
import { createInertiaApp, router } from '@inertiajs/vue3'
import { resolvePageComponent } from '@adonisjs/inertia/helpers'
import { installIconFallback } from '../lib/icon_fallback.js'
import { installTouchTitles } from '../lib/touch_titles.js'
import { enterPageStyles, showPageStyles, startPageStyles } from '../lib/page_styles.js'
import { invadeUi } from './ui.js'

installIconFallback()
installTouchTitles()

const appName = import.meta.env.VITE_APP_NAME || 'invade.lol'

createInertiaApp({
  progress: { color: '#7b6dff' },

  title: (title: string) => (title ? `${title} | ${appName}` : appName),

  resolve: async (name: string) => {
    const page = await resolvePageComponent(
      `../pages/${name}.vue`,
      import.meta.glob<DefineComponent>('../pages/**/*.vue')
    )
    // Its stylesheets are loaded with it: on for the page about to be drawn (lib/page_styles.ts).
    enterPageStyles(name)
    return page
  },

  setup({ el, App, props, plugin }) {
    // Only the shown page's stylesheets apply, however it was reached.
    startPageStyles(props.initialPage.component)
    router.on('navigate', (event) => showPageStyles(event.detail.page.component))
    router.on('success', (event) => showPageStyles(event.detail.page.component))
    createSSRApp({ render: () => h(App, props) })
      .use(plugin)
      .use(invadeUi())
      .mount(el)
  },
})
