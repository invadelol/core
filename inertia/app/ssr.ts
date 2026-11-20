/// <reference types="vite/client" />

import { createInertiaApp } from '@inertiajs/vue3'
import { renderToString } from '@vue/server-renderer'
import { createSSRApp, h, type DefineComponent } from 'vue'
import { invadeUi } from './ui.js'

export default function render(page: any) {
  return createInertiaApp({
    page,
    render: renderToString,
    // The same template as the browser (app.ts), so search engines read the full title.
    title: (title: string) => (title ? `${title} | invade.lol` : 'invade.lol'),
    resolve: (name: string) => {
      const pages = import.meta.glob<DefineComponent>('../pages/**/*.vue', { eager: true })
      return pages[`../pages/${name}.vue`]
    },

    setup({ App, props, plugin }) {
      return createSSRApp({ render: () => h(App, props) })
        .use(plugin)
        .use(invadeUi())
    },
  })
}
