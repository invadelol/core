/*
|--------------------------------------------------------------------------
| Edge globals
|--------------------------------------------------------------------------
|
| What the layout (resources/views/inertia_layout.edge) reads besides the page.
|
*/

import edge from 'edge.js'
import { pageStylesJson } from '#services/page_styles'

/** The stylesheets each page needs, written once into the page for inertia/lib/page_styles.ts. */
edge.global('pageStyles', pageStylesJson)

