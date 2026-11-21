import { reactive } from 'vue'
import { TEASER_ID } from '../../lib/new_dawn.js'

/**
 * The teaser's player on the hub, shared by the player itself, the cast and the stills that seek
 * it, and the stage's "Watch the teaser". Nothing reaches YouTube before a visitor asks to play:
 * the first play mounts the privacy-enhanced embed (youtube-nocookie.com) at that second; later
 * ones seek it through the embed's own messages (no script of YouTube's on the page). The state
 * only changes in the browser, after a click, so a server render always reads the first one.
 */
export const PLAYER_ORIGIN = 'https://www.youtube-nocookie.com'

export const teaser = reactive({
  /** The embed is on the page (after the first play). */
  on: false,
  /** Where the embed starts, in whole seconds. */
  start: 0,
  /** The player's time as it reports it, in seconds; null until it does. */
  time: null as number | null,
  /** The embed's window, once it loaded. */
  frame: null as HTMLIFrameElement | null,
  /** The last second asked for, shown as the current moment until the player reports. */
  asked: null as number | null,
})

export const embedSrc = (start: number, origin: string) =>
  `${PLAYER_ORIGIN}/embed/${TEASER_ID}?${new URLSearchParams({
    autoplay: '1',
    start: String(Math.floor(start)),
    enablejsapi: '1',
    rel: '0',
    playsinline: '1',
    origin,
  })}`

function send(func: string, args: unknown[] = []) {
  teaser.frame?.contentWindow?.postMessage(
    JSON.stringify({ event: 'command', func, args }),
    PLAYER_ORIGIN
  )
}

/** Plays the teaser from `second`: mounts the embed there, or seeks the one already playing. */
export function playAt(second: number) {
  teaser.asked = second
  if (!teaser.on) {
    teaser.start = second
    teaser.on = true
    return
  }
  teaser.time = second
  send('seekTo', [second, true])
  send('playVideo')
}

/** Plays from `second`, and brings `el` (the player) into view when it is out of sight. */
export function playInView(second: number, el: HTMLElement | null | undefined) {
  playAt(second)
  const box = el?.getBoundingClientRect()
  if (box && (box.top < 0 || box.bottom > window.innerHeight))
    el!.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

/** The embed loaded: ask it to report its time (the IFrame API's own "listening" handshake). */
export function listen(frame: HTMLIFrameElement) {
  teaser.frame = frame
  frame.contentWindow?.postMessage(
    JSON.stringify({ event: 'listening', id: 'nd-teaser', channel: 'widget' }),
    PLAYER_ORIGIN
  )
}

/** A message from the embed: its time, when it says it. */
export function onPlayerMessage(event: MessageEvent) {
  if (event.origin !== PLAYER_ORIGIN || typeof event.data !== 'string') return
  try {
    const data = JSON.parse(event.data) as { event?: string; info?: { currentTime?: unknown } }
    const t = data.info?.currentTime
    if (data.event === 'infoDelivery' && typeof t === 'number') teaser.time = t
  } catch {
    /* not one of the player's messages */
  }
}

/** Where the teaser is: the player's own time, or the second just asked for; null before a play. */
export const playing = () => (teaser.on ? (teaser.time ?? teaser.asked) : null)

/** The moment a list of timed moments is at: the last one started, by the player's time. */
export function currentOf(seconds: number[]): number | null {
  const now = playing()
  if (now === null) return null
  let found: number | null = null
  for (const s of seconds) if (s <= now + 0.25) found = s
  return found
}
