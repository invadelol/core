import { defineConfig, type Plugin } from 'vite'
import adonisjs from '@adonisjs/vite/client'
import inertia from '@adonisjs/inertia/client'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

/**
 * @invadelol/ui's components import their own CSS. The site takes all of it once instead, as
 * `style.css` in Tailwind's components layer (inertia/css/app.css), so its utilities win over the
 * views' defaults: those imports would load it again outside the layer, so they import nothing.
 */
function uiStylesOnce(): Plugin {
  const none = '\0invade-ui-css'
  return {
    name: 'invade-ui-styles-once',
    enforce: 'pre',
    resolveId: (source, importer) => (source.endsWith('.css') && importer?.includes('/@invadelol/ui/dist/') ? none : undefined),
    load: (id) => (id === none ? '' : undefined),
  }
}

export default defineConfig({
  plugins: [
    uiStylesOnce(),
    tailwindcss(),
    inertia({ ssr: { enabled: true, entrypoint: 'inertia/app/ssr.ts' } }),
    // Template comments are documentation: the server build kept them while the browser build
    // dropped them, so every page with one failed hydration.
    vue({ template: { compilerOptions: { comments: false } } }),
    adonisjs({
      /**
       * Entrypoints of your application. Each entrypoint will
       * result in a separate bundle.
       */
      entrypoints: ['inertia/app/app.ts'],

      /**
       * Paths to watch and reload the browser on file change
       */
      reload: ['resources/views/**/*.edge'],
    }),
  ],
  // The package's modules import their CSS: served as they are in development (pre-bundling would
  // resolve those imports past uiStylesOnce), and bundled into the server build (Node cannot import CSS).
  optimizeDeps: { exclude: ['@invadelol/ui'] },
  ssr: { noExternal: ['@invadelol/ui'] },
})
