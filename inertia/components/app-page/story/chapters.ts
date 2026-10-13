/**
 * The story the /app page tells: one game, chapter by chapter. `len` is the chapter's scroll
 * length in screen heights. The copy is plain on purpose: what happens, then one checkable fact.
 */
export interface Chapter {
  id: string
  len: number
  n?: string
  name?: string
  title?: string
  body?: string
  fact?: string
}

export const CHAPTERS: Chapter[] = [
  { id: 'hero', len: 0.45 },
  {
    id: 'draft',
    len: 1.8,
    n: '01',
    name: 'Champ select',
    title: 'Viego is in your jungle.',
    body: 'Counters ranks the three best picks into him. Lock in, and the rune page for your role is already in the client.',
    fact: 'Matchups under 50 games are left out, never guessed.',
  },
  {
    id: 'game',
    len: 2.1,
    n: '02',
    name: 'In game',
    title: 'The things you would count yourself.',
    body: 'Objectives times dragon and Baron. Performance holds your CS, gold and kill share against the rank above yours, and Next item counts down the gold to your next buy.',
    fact: 'Read from the game’s own local API, once a second. No memory reading.',
  },
  {
    id: 'tab',
    len: 1.1,
    n: '03',
    name: 'Hold Tab',
    title: 'Who is ahead, lane by lane.',
    body: 'Hold Tab and each lane’s gold lead sits on its row of the scoreboard, with your team’s lead above it. Let go and it’s gone.',
    fact: 'Placed from the game’s own scoreboard layout, at any resolution.',
  },
  {
    id: 'play',
    len: 1.6,
    n: '04',
    name: 'The play',
    title: 'Double kill at 15:19.',
    body: 'Invade records the game on your graphics card. When it ends, your kills and objectives are already clips, cut without re-encoding.',
    fact: 'Ctrl Shift H keeps the last seconds of anything else.',
  },
  {
    id: 'after',
    len: 1.7,
    n: '05',
    name: 'After the game',
    title: 'A score for every game.',
    body: 'From 0 to 100, against the other nine players and weighted for your role. The game lands in your history and your LP line moves with it.',
    fact: 'All ten players are scored, the same way every game.',
  },
  {
    id: 'web',
    len: 1.2,
    n: '06',
    name: 'invade.lol',
    title: 'Already on your web profile.',
    body: 'Every game you finish is on invade.lol the moment it ends, scored the same way. With League closed, the app reads it back from there.',
    fact: 'Finished games only. Nothing is sent during a game.',
  },
]

/** Where each chapter starts, in screen heights from the top of the story. */
export const STARTS: number[] = []
for (let i = 0, at = 0; i < CHAPTERS.length; at += CHAPTERS[i].len, i++) STARTS.push(at)
export const TOTAL = STARTS[STARTS.length - 1] + CHAPTERS[CHAPTERS.length - 1].len

/** A rectangle of the 1280 × 720 world. */
export type Rect = [x: number, y: number, w: number, h: number]
const FULL: Rect = [0, 0, 1280, 720]

/**
 * The camera, chapter by chapter: [chapter, progress, desktop rect, phone rect]. Desktop shows
 * the whole screen and pushes in on the moment; a phone follows tight crops so it is always
 * readable. Between two keys the camera eases.
 */
const KEYS: Array<[string, number, Rect, Rect]> = [
  ['hero', 0, [0, 70, 1050, 590], [0, 110, 420, 575]],
  ['draft', 0.05, [0, 70, 1050, 590], [0, 110, 420, 575]],
  ['draft', 0.16, [520, 40, 760, 428], [990, 40, 290, 300]],
  ['draft', 0.46, [520, 40, 760, 428], [990, 40, 290, 300]],
  ['draft', 0.58, [0, 40, 760, 428], [0, 56, 270, 300]],
  ['draft', 0.66, [0, 40, 760, 428], [0, 56, 270, 300]],
  ['draft', 0.72, [0, 70, 900, 506], [0, 56, 270, 560]],
  ['draft', 0.94, [0, 70, 900, 506], [0, 56, 270, 560]],
  ['draft', 1, FULL, [0, 56, 270, 560]],
  ['game', 0.06, FULL, [0, 236, 240, 200]],
  ['game', 0.14, [0, 0, 800, 450], [0, 236, 240, 200]],
  ['game', 0.3, [0, 0, 800, 450], [0, 236, 240, 200]],
  ['game', 0.38, [0, 0, 800, 450], [470, 0, 300, 120]],
  ['game', 0.7, [0, 0, 800, 450], [470, 0, 300, 120]],
  ['game', 0.76, [480, 270, 800, 450], [960, 392, 300, 160]],
  ['game', 1, [480, 270, 800, 450], [960, 392, 300, 160]],
  ['tab', 0.1, [150, 84, 980, 551], [440, 120, 400, 480]],
  ['tab', 0.88, [150, 84, 980, 551], [440, 120, 400, 480]],
  ['play', 0.06, [330, 110, 700, 394], [480, 160, 420, 340]],
  ['play', 0.4, [330, 110, 700, 394], [480, 160, 420, 340]],
  ['play', 0.5, FULL, [450, 160, 360, 400]],
  ['play', 1, FULL, [450, 160, 360, 400]],
  ['after', 0.05, FULL, [600, 60, 380, 420]],
  ['after', 0.26, FULL, [600, 60, 380, 420]],
  ['after', 0.32, FULL, [228, 64, 350, 250]],
  ['after', 0.58, FULL, [228, 64, 350, 250]],
  ['after', 0.64, FULL, [228, 300, 350, 380]],
  ['after', 1, FULL, [228, 300, 350, 380]],
  ['web', 0.12, FULL, [228, 300, 350, 380]],
  ['web', 0.7, FULL, [440, 0, 440, 602]],
  ['web', 1, FULL, [440, 0, 440, 602]],
]

export const CAMERA = KEYS.map(([id, p, d, m]) => {
  const i = CHAPTERS.findIndex((c) => c.id === id)
  return { s: STARTS[i] + p * CHAPTERS[i].len, d, m }
})
