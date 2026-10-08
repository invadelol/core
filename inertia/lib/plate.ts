import type { InjectionKey, Ref } from 'vue'

/**
 * A share (0–1) of each plate's score to show, provided by a demo that counts a plate up as it
 * lights (the /app page). Pages that do not provide it show the score as it is.
 */
export const PLATE_REVEAL: InjectionKey<Ref<number>> = Symbol('plate-reveal')
