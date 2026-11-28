/**
 * New Dawn, Riot's 2027 update to League: everything the hub (`/new-dawn`) says, in one place.
 * Every fact comes from Riot's own posts and videos, paraphrased, each with its link; rumours are
 * real reports with who said them and when. Edited by hand when Riot speaks: add the post or the
 * rumour, move `updated`, and the counts on the page follow.
 *
 * Public numbers (YouTube views, X likes) are as read on `PUBLIC_COUNTS_READ`. Times are UTC.
 * Text in `parts` arrays alternates plain and bold: even indexes plain, odd indexes bold.
 */

/** A picture of the hub's own (Riot's stills and frames, the developers, the emotes). */
export const ndImage = (name: string) => `/new-dawn-art/${name}.webp`

const YT = 'https://www.youtube.com/watch?v='
const X = 'https://x.com/'
const LOL = 'https://www.leagueoflegends.com/en-us/'

export const TEASER_ID = 'vs3p3mNhRXo'
export const TEASER_URL = `${YT}${TEASER_ID}`
export const DEV_UPDATE_URL = `${YT}rw98WDnsgkw`
export const RIOT_PAGE_URL = `${LOL}new-dawn/`
export const TLDW_2027_URL = `${LOL}news/dev/tldw-season-1-2027-dev-update---lol-website-article-lollol27-s1225r001/`
const TLDW_DEMACIA_URL = `${LOL}news/dev/tldw-for-demacia-dev-update/`
const TLDW_JULY_URL = `${LOL}news/dev/tldw-classic-mayhem-more-dev-update/`
const ESPORTS_2027_URL = 'https://lolesports.com/en-US/news/lol-esports-2027-and-beyond'
const IG_RUNES_URL =
  'https://insider-gaming.com/riot-meddler-confirms-lol-new-dawn-will-have-runes/'
const PCG_URL =
  'https://www.pcgamer.com/games/moba/league-of-legends-will-get-an-overhaul-called-new-dawn-with-new-visuals-build-options-and-an-updated-client/'
const INVEN_URL =
  'https://www.invenglobal.com/articles/28658/riot-games-reveals-league-of-legends-new-dawn-a-2027-overhaul-of-the-game'
const SHORT_URL = 'https://www.youtube.com/shorts/L9YEN13RjSo'
const MEDDLER_NOV_16 = `${X}RiotMeddler/status/2122139728287818230`
const MEDDLER_DEC_18 = `${X}RiotMeddler/status/2001780724853276988`
const MEDDLER_JUN_12_ENGINE = `${X}RiotMeddler/status/2065519045911429321`
const MEDDLER_JUN_12_WORLDS = `${X}RiotMeddler/status/2065529735866904851`
const WORLDS_VENUE_URL =
  'https://lolesports.com/en-US/lolesports/news/worlds-2026-venue-event-policies'
const VICTORIOUS_WIKI_URL = 'https://wiki.leagueoflegends.com/en-us/Victorious'
/** A video at a second, as YouTube links it. */
const at = (url: string, second: number) => `${url}&t=${second}s`

/** A link to a source, as the page writes it. */
export interface Source {
  label: string
  href: string
}

/** Text with bold runs: even indexes plain, odd indexes bold. */
export type Parts = string[]

/** The plain text of `parts` (for search engines and labels). */
export const plain = (parts: Parts) => parts.join('')

/** The faces of the people who speak for Riot, from Riot's own videos and their public posts. */
export const FACES = {
  meddler: ndImage('meddler'),
  pabro: ndImage('pabro'),
  merrill: ndImage('merrill'),
  pupulasers: ndImage('pupulasers'),
} as const
export type Face = keyof typeof FACES

/* ── The page ───────────────────────────────────────────────────── */

/** When the hub last took in something Riot said (UTC). Move it with every edit to the hub. */
const UPDATED_AT = new Date('2026-11-21T16:22:00Z')
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const two = (n: number) => String(n).padStart(2, '0')
/** The day as the page writes it, without the year ("21 Nov"). */
export const UPDATED_DAY = `${UPDATED_AT.getUTCDate()} ${MONTHS[UPDATED_AT.getUTCMonth()]}`

export const NEW_DAWN = {
  /** The line under the tabs, from `UPDATED_AT`. */
  updated: `Updated ${UPDATED_DAY} ${UPDATED_AT.getUTCFullYear()}, ${two(UPDATED_AT.getUTCHours())}:${two(UPDATED_AT.getUTCMinutes())}, from Riot's own posts and videos`,
  /** The same, for search engines (`dateModified`). */
  modified: UPDATED_AT.toISOString().replace('.000Z', 'Z'),
  lead: [
    "Riot's 2027 update to League: a modernized client built into the game and a visually revamped Summoner's Rift. ",
    'Full reveal in early January',
    ', launch later in 2027.',
  ] as Parts,
  /** The tab pages' shorter line. */
  leadShort: [
    "Riot's 2027 update to League. ",
    'Full reveal in early January',
    ', launch later in 2027.',
  ] as Parts,
  next: {
    title: 'The full reveal, early January',
    line: 'Riot gave no day on 16 Nov. It lands on this page within the hour.',
    lineShort: 'No day given yet. It lands here within the hour.',
  },
} as const

/* ── In the teaser ──────────────────────────────────────────────── */

/**
 * The teaser's cast, in order, with the second each one first shows (checked frame by frame on the
 * video, 21 Nov 2026). Their stills are later frames of the same shots.
 */
export const CAST = [
  { key: 'blitzcrank', name: 'Blitzcrank', time: '0:50', second: 50 },
  { key: 'lux', name: 'Lux', time: '1:04', second: 64 },
  { key: 'leona', name: 'Leona', time: '1:07', second: 67 },
  { key: 'sett', name: 'Sett', time: '1:09', second: 69 },
  { key: 'ekko', name: 'Ekko', time: '1:16', second: 76 },
  { key: 'jhin', name: 'Jhin', time: '1:24', second: 84 },
  { key: 'ahri', name: 'Ahri', time: '1:30', second: 90 },
] as const
/** The cast's shots end where the lobby begins. */
export const CAST_END = 98

export const teaserAt = (second: number) => at(TEASER_URL, second)
/** m:ss of a second in the teaser. */
export const clock = (second: number) =>
  `${Math.floor(second / 60)}:${String(Math.floor(second % 60)).padStart(2, '0')}`

/** A moment of the teaser, from its English captions (quotes) and its frames. */
export interface Moment {
  second: number
  label: string
  /** Who says the quote. */
  who?: string
}

export const TEASER = {
  length: '2:01',
  meta: '2:01, aired at the Worlds final in Brooklyn on 14 Nov, 2,137,614 views on 19 Nov',
  /** The Worlds final's venue and day (lolesports.com). */
  venue: { label: 'Worlds final, Barclays Center, 14 Nov', href: WORLDS_VENUE_URL } as Source,
  /** The teaser apart from the cast, in order (the cast runs from 0:50 to 1:37). */
  moments: [
    { second: 0, label: 'Pabro and Meddler' },
    { second: 26, label: '"The client, for one, has to be better"', who: 'Pabro' },
    { second: 29, label: '"Next year we\'re releasing a modernized client"', who: 'Pabro' },
    {
      second: 34,
      label: '"Visually revamping Summoner\'s Rift, evolving its gameplay"',
      who: 'Meddler',
    },
    { second: 45, label: 'The dawn' },
    { second: 50, label: 'Seven champions, a new look' },
    { second: 98, label: 'A lobby of five' },
    { second: 99, label: 'Blitzcrank picks God Hand' },
    { second: 100, label: 'Vayne dashes through a wall' },
    { second: 106, label: 'New minions' },
    { second: 109, label: 'Baron Nashor' },
    { second: 118, label: '"Full reveal in January"' },
  ] as Moment[],
  godHand: {
    second: 99,
    text: `At 1:39 a Blitzcrank player picks an option called God Hand, then fights up close; at 1:40 Vayne dashes through a wall. Riot had not explained these choices by ${UPDATED_DAY}.`,
    sources: [
      { label: 'PC Gamer', href: PCG_URL },
      { label: 'Inven Global', href: INVEN_URL },
    ] as Source[],
    quote:
      '"Other content (I\'m sure you know what I\'m alluding to) is getting added that adds complexity."',
    who: 'Meddler on Reddit, 16 Nov',
    href: IG_RUNES_URL,
  },
  /** The lobby of five (Irelia, Ahri, Blitzcrank, Ashe, Master Yi) and the new Rift. */
  shots: [
    {
      pic: 'teaser-lobby',
      alt: 'Five champions in a lobby, from the teaser',
      time: '1:38',
      second: 98,
      title: 'A first look at the client',
      text: 'Five champions in a lobby. Pabro at 0:29: "So next year we\'re releasing a modernized client."',
      faces: [
        { id: 39, name: 'Irelia' },
        { id: 103, name: 'Ahri' },
        { id: 53, name: 'Blitzcrank' },
        { id: 22, name: 'Ashe' },
        { id: 11, name: 'Master Yi' },
      ],
    },
    {
      pic: 'teaser-minions',
      alt: "New minions on Summoner's Rift, from the teaser",
      time: '1:46',
      second: 106,
      title: 'The Rift, redrawn',
      text: 'New minions at 1:46 and a new Baron Nashor at 1:49, new ability effects from 1:40.',
      faces: [],
    },
  ],
} as const

/* ── Coming in January ──────────────────────────────────────────── */

/** Ranked Rush: the real tiers from where everyone starts in January up to Emerald. */
export const LADDER = [
  { tier: 'iron', name: 'Iron IV', note: 'January' },
  { tier: 'bronze', name: 'Bronze', note: '' },
  { tier: 'silver', name: 'Silver', note: '' },
  { tier: 'gold', name: 'Gold', note: '' },
  { tier: 'platinum', name: 'Platinum', note: '' },
  { tier: 'emerald', name: 'Emerald', note: '' },
] as const

export const RANKED_RUSH = {
  title: 'Everyone starts at Iron IV',
  when: 'In January, as the season starts',
  rows: [
    { key: 'Visible rank', before: 'Yours', after: 'Iron IV' },
    { key: 'MMR', before: 'Yours', after: 'The same' },
    { key: 'LP per win', before: 'Usual', after: 'Massive, on the way up' },
  ],
  climb:
    "Five tiers up from Iron IV to Emerald. Invade's desktop app logs your LP after every game, so each tier you take back shows up the moment you win it.",
} as const

/** Items: `→` in a line is drawn as an arrow. */
export const ITEMS = {
  line: 'The on-hit overhaul, three new items',
  changed: [
    { id: 3302, name: 'Terminus', line: 'Armor and magic resist→piercing through foes' },
    { id: 3091, name: "Wit's End", line: 'Now a go-to move speed item against magic' },
    { id: 3153, name: 'Blade of the Ruined King', line: 'Its slow→the new Fatetaker' },
    { id: 4633, name: 'Riftmaker', line: 'New stats and new uniques' },
  ],
  added: [
    {
      name: 'Fatetaker',
      line: 'On-hit: attack speed, armor, a three-hit passive, the slow without cooldown',
    },
    { name: 'Lifebloom Crown', line: 'AP: omnivamp, and healing past full health' },
    { name: 'Gravescourge', line: 'Lethality: summons Mistwraiths that chase nearby enemies' },
  ],
  removed: { name: 'Faelights', line: 'Removed from the Rift' },
} as const

export const RUNES = {
  /** Kleptomancy's rune id, for its icon. */
  kleptomancy: 8359,
  back: {
    title: 'Kleptomancy is back',
    line: 'A Keystone again. Its new loot gives a small discount in the shop.',
  },
  added: {
    title: 'Titanborn',
    line: 'Armor and magic resist ramp up in champion fights, then a shockwave at full stacks.',
  },
} as const

/** Past Victorious skins, by champion id and skin number (their loading art). */
export const VICTORIOUS = {
  skins: [
    { champion: 40, skin: 4, name: 'Victorious Janna' },
    { champion: 53, skin: 36, name: 'Victorious Blitzcrank' },
    { champion: 201, skin: 51, name: 'Victorious Braum' },
  ],
  title: 'Past Victorious skins, again',
  line: 'New variants, unlocked with Timeless Tokens, without waiting for the end of the year.',
  note: '22 Victorious skins exist. Riot has not said which return, or for how many Timeless Tokens.',
  noteSource: { label: 'League wiki', href: VICTORIOUS_WIKI_URL } as Source,
} as const

export const MAYHEM = {
  title: 'ARAM: Mayhem breaks more rules',
  line: 'Augments can overload, one makes your inventory bigger. Players vote old augments back, the first one "shortly after the update".',
} as const

/* ── Riot's posts ───────────────────────────────────────────────── */

export type PostKind = 'video' | 'article' | 'x' | 'reddit' | 'page'
/** Who speaks, for the "Who speaks" card. */
export type Speaker = 'meddler' | 'pabro' | 'league' | 'esports'

export interface Post {
  id: string
  kind: PostKind
  /** The month it belongs to on the list. */
  month: string
  /** As the page writes it (UTC). */
  when: string
  /** The first row of the list, drawn larger. */
  lead?: boolean
  /** Its picture (`ndImage`), or the post itself drawn as a card (`xpost`). */
  pic?: string
  pos?: string
  /** A video's length, on its picture. */
  length?: string
  xpost?: { face: Face; name: string; handle: string; text: string; likes?: string }
  title: string
  by: { face: Face | null; name: string }
  speakers: Speaker[]
  said: string
  /** Its public number, as read on `PUBLIC_COUNTS_READ`. */
  count?: { value: number; unit: string }
  link: Source
  /** A video's chapters; `on` marks the one about New Dawn. */
  chapters?: { time: string; label: string; second: number; on?: boolean }[]
  /** A video's short name in the views card. */
  short?: string
}

/** When the public numbers (views, likes) were read. */
export const PUBLIC_COUNTS_READ = { iso: '2026-11-19', label: 'Read 19 Nov' } as const

export const POSTS: Post[] = [
  {
    id: 'season-2027-dev-update',
    kind: 'video',
    month: 'November 2026',
    when: '16 Nov 2026, 16:00',
    lead: true,
    pic: 'video-season-2027',
    length: '5:27',
    title: 'Season 1 2027 dev update',
    by: { face: 'pabro', name: 'Pabro and Meddler' },
    speakers: ['pabro', 'meddler'],
    said: 'At 0:17, a full reveal "in early January, in place of the usual Season Start moment", broader playtesting "shortly after that reveal", the launch later in 2027 with the Season Start cinematic. Then January: two Keystones and the on-hit overhaul, Ranked Rush at 3:49, Mayhem at 4:32.',
    count: { value: 1273879, unit: 'views' },
    link: { label: 'Watch on YouTube', href: DEV_UPDATE_URL },
    chapters: [
      { time: '0:00', label: 'Intro', second: 0 },
      { time: '0:11', label: 'New Dawn roadmap', second: 11, on: true },
      { time: '0:43', label: 'Gameplay', second: 43 },
      { time: '3:49', label: 'Ranked Rush', second: 229 },
      { time: '4:32', label: 'Mayhem', second: 272 },
    ],
    short: 'Season 1 2027 dev update',
  },
  {
    id: 'tldw-2027',
    kind: 'article',
    month: 'November 2026',
    when: '16 Nov 2026, 16:00',
    pic: 'article-tldw-2027',
    title: 'TL;DW: Season 1 2027 Dev Update',
    by: { face: 'meddler', name: 'Meddler' },
    speakers: ['meddler'],
    said: 'The same news as a list: reveal in January, cinematic at launch, playtests after the reveal, every item and rune change, Ranked Rush, Timeless Victorious skins, Mayhem.',
    link: { label: 'Read on leagueoflegends.com', href: TLDW_2027_URL },
  },
  {
    id: 'meddler-four-answers',
    kind: 'x',
    month: 'November 2026',
    when: '16 Nov 2026, 01:28',
    xpost: {
      face: 'meddler',
      name: 'Andrei van Roon',
      handle: '@RiotMeddler',
      text: "You'll still pick Runes, including a Keystone, in New Dawn. The Rune system is getting streamlined somewhat given other additions, it's not getting removed though.",
      likes: '41,390',
    },
    title: 'Meddler answers four questions',
    by: { face: 'meddler', name: 'Meddler, head of League Studio' },
    speakers: ['meddler'],
    said: 'Runes stay, Keystone included. An upgraded Hextech engine, not a new one. A massive update, not a separate game, and "New Dawn" names the update only. Every champion and skin stays usable.',
    count: { value: 41390, unit: 'likes' },
    link: { label: 'Read on X', href: MEDDLER_NOV_16 },
  },
  {
    id: 'meddler-runes-hint',
    kind: 'reddit',
    month: 'November 2026',
    when: '16 Nov 2026',
    xpost: {
      face: 'meddler',
      name: 'Meddler',
      handle: 'r/leagueoflegends',
      text: "Other content (I'm sure you know what I'm alluding to) is getting added that adds complexity. We don't think League should get substantially more complex, hence some streamlining of some Runes.",
    },
    title: 'A hint about what comes with the runes',
    by: { face: 'meddler', name: 'Meddler' },
    speakers: ['meddler'],
    said: "Why runes get lighter: other content adds complexity. Insider Gaming reads it as a nod to champion choices like the teaser's God Hand.",
    link: { label: 'Read the quote', href: IG_RUNES_URL },
  },
  {
    id: 'teaser',
    kind: 'video',
    month: 'November 2026',
    when: '14 Nov 2026, 22:00',
    pic: 'video-teaser',
    length: '2:01',
    title: 'League of Legends: New Dawn teaser',
    by: { face: 'pabro', name: 'Pabro and Meddler' },
    speakers: ['pabro', 'meddler'],
    said: 'Shown during the Worlds final at Barclays Center, Brooklyn. At 0:26, "The client, for one, has to be better"; from 0:50 a new look for Blitzcrank, Lux, Leona, Sett, Ekko, Jhin and Ahri; from 1:38, 12 seconds of new gameplay.',
    count: { value: 2137614, unit: 'views' },
    link: { label: 'Watch on YouTube', href: TEASER_URL },
    short: 'Teaser',
  },
  {
    id: 'league-x-teaser',
    kind: 'x',
    month: 'November 2026',
    when: '14 Nov 2026, 21:59',
    pic: 'blitzcrank',
    pos: '76% 40%',
    length: '2:01',
    title: '"A peek at where we\'re headed for 2027"',
    by: { face: null, name: '@LeagueOfLegends' },
    speakers: ['league'],
    said: "The teaser on League's own account, posted a minute before it went up on YouTube.",
    count: { value: 56314, unit: 'likes, 1,980 replies' },
    link: { label: 'Read on X', href: `${X}LeagueOfLegends/status/2121724627667824796` },
  },
  {
    id: 'riot-new-dawn-page',
    kind: 'page',
    month: 'November 2026',
    when: '14 Nov 2026',
    pic: 'dawn-1280',
    pos: '20% 40%',
    title: "Riot's New Dawn page",
    by: { face: null, name: 'leagueoflegends.com' },
    speakers: ['league'],
    said: '"The Future of League is Coming Soon": a sign-up for news and the playtests, the dev update, and the two stills used on this page.',
    link: { label: "Open Riot's page", href: RIOT_PAGE_URL },
  },
  {
    id: 'esports-2027',
    kind: 'article',
    month: 'November 2026',
    when: '13 Nov 2026',
    pic: 'article-esports-2027',
    pos: '50% 60%',
    title: 'LoL Esports 2027 and beyond',
    by: { face: null, name: 'LoL Esports' },
    speakers: ['esports'],
    said: 'The 2027 calendar: First Stand: All In in China, MSI in Valencia, Worlds in Japan and South Korea with the final at the new Seoul Arena. Formats in January.',
    link: { label: 'Read on lolesports.com', href: ESPORTS_2027_URL },
  },
  {
    id: 'classic-mayhem-dev-update',
    kind: 'video',
    month: 'July 2026',
    when: '14 Jul 2026, 15:00',
    pic: 'video-classic-mayhem',
    length: '7:11',
    title: 'Classic, Mayhem and more dev update',
    by: { face: 'pabro', name: 'Pabro and Meddler' },
    speakers: ['pabro', 'meddler'],
    said: 'The promise for this autumn: "at Worlds we\'ll give a little peek into some future plans for 2027 and beyond".',
    count: { value: 357285, unit: 'views' },
    link: { label: 'Read the TL;DW', href: TLDW_JULY_URL },
    short: 'Classic, Mayhem and more',
  },
  {
    id: 'meddler-around-worlds',
    kind: 'x',
    month: 'June 2026',
    when: '12 Jun 2026, 20:20',
    xpost: {
      face: 'meddler',
      name: 'Andrei van Roon',
      handle: '@RiotMeddler',
      text: "We'll have more to share about what we're working on in addition to a client update sometime around (or at) Worlds",
      likes: '673',
    },
    title: 'More "around (or at) Worlds"',
    by: { face: 'meddler', name: 'Meddler' },
    speakers: ['meddler'],
    said: 'A date for the next news, kept: the teaser aired at the Worlds final.',
    count: { value: 673, unit: 'likes' },
    link: { label: 'Read on X', href: MEDDLER_JUN_12_WORLDS },
  },
  {
    id: 'meddler-engine',
    kind: 'x',
    month: 'June 2026',
    when: '12 Jun 2026, 19:38',
    xpost: {
      face: 'meddler',
      name: 'Andrei van Roon',
      handle: '@RiotMeddler',
      text: "With League we're investing further in the custom game engine League uses, since that's been tailored for MOBA gameplay specifically and fits League's needs really well.",
      likes: '1,531',
    },
    title: "The client moves into the game's engine",
    by: { face: 'meddler', name: 'Meddler' },
    speakers: ['meddler'],
    said: 'League keeps its own engine, built for a MOBA. The client stops being a separate app and moves into it.',
    count: { value: 1531, unit: 'likes' },
    link: { label: 'Read on X', href: MEDDLER_JUN_12_ENGINE },
  },
  {
    id: 'demacia-dev-update',
    kind: 'video',
    month: 'January 2026',
    when: '8 Jan 2026, 16:00',
    pic: 'video-demacia',
    length: '16:49',
    title: 'For Demacia dev update',
    by: { face: 'pabro', name: 'Pabro and Meddler' },
    speakers: ['pabro', 'meddler'],
    said: 'At the end, from 15:04: bigger long-term updates, "not League of Legends 2": a new integrated client, a revamped Rift, pre-game choices such as runes, a new player experience.',
    count: { value: 561664, unit: 'views' },
    link: { label: 'Read the TL;DW', href: TLDW_DEMACIA_URL },
    short: 'For Demacia dev update',
  },
  {
    id: 'meddler-shared-early',
    kind: 'x',
    month: 'December 2025',
    when: '18 Dec 2025, 22:24',
    xpost: {
      face: 'meddler',
      name: 'Andrei van Roon',
      handle: '@RiotMeddler',
      text: 'We were planning to share this video with you in early January as part of the bigger Season Start moment, but since some early speculation is making the rounds, we felt we should share it earlier.',
      likes: '8,570',
    },
    title: 'Shared early, because of the leak',
    by: { face: 'meddler', name: 'Meddler' },
    speakers: ['meddler'],
    said: "Hours after Bloomberg's report, the plan in five points: a client built into the game, a new Rift, gameplay changes, runes and pre-game, new players.",
    count: { value: 8570, unit: 'likes' },
    link: { label: 'Read on X', href: MEDDLER_DEC_18 },
  },
  {
    id: 'league-after-2026',
    kind: 'video',
    month: 'December 2025',
    when: '18 Dec 2025, 22:18',
    pic: 'video-league-after-2026',
    pos: '50% 30%',
    length: '1:35',
    title: 'League after 2026',
    by: { face: 'pabro', name: 'Pabro and Meddler' },
    speakers: ['pabro', 'meddler'],
    said: '"We\'re often asked if we\'re gonna make League of Legends 2 some day, and the answer to that has been and remains, no." The majority of the League team is on the bigger update.',
    count: { value: 427560, unit: 'views' },
    link: { label: 'Watch on YouTube', href: SHORT_URL },
    short: 'League after 2026',
  },
]

/** How each kind reads above a post's title. */
export const KIND_LABEL: Record<PostKind, string> = {
  video: 'Video',
  article: 'Article',
  x: 'Post on X',
  reddit: 'Comment on Reddit',
  page: 'Page',
}

/** The type filter of the posts list. */
export const POST_FILTERS = [
  { key: 'all', label: 'All', kinds: ['video', 'article', 'x', 'reddit', 'page'] },
  { key: 'videos', label: 'Videos', kinds: ['video'] },
  { key: 'posts', label: 'Posts', kinds: ['x', 'reddit'] },
  { key: 'articles', label: 'Articles', kinds: ['article', 'page'] },
] as const satisfies readonly { key: string; label: string; kinds: readonly PostKind[] }[]

export const SPEAKERS: { key: Speaker; name: string; role: string; face: Face | null }[] = [
  { key: 'meddler', name: 'Meddler', role: 'Head of League Studio', face: 'meddler' },
  { key: 'pabro', name: 'Pabro', role: 'Executive producer', face: 'pabro' },
  { key: 'league', name: 'League of Legends', role: "Riot's account and site", face: null },
  { key: 'esports', name: 'LoL Esports', role: 'lolesports.com', face: null },
]

/** The overview's three latest: the dev update, Meddler's answers, the teaser. */
export const LATEST = ['season-2027-dev-update', 'meddler-four-answers', 'teaser']

/* ── Rumours ────────────────────────────────────────────────────── */

export type RumourStatus = 'half' | 'open' | 'yes' | 'no'

export interface Rumour {
  /** Its address in votes; never changes once votes exist. */
  id: string
  status: RumourStatus
  word: string
  date: string
  title: string
  claim: string
  pic: { src: string; caption: string; pos?: string }
  reportedBy: Source[]
  answer: { face: Face; quote: string; who: Source } | null
  /** The no-stakes question, while Riot has not settled it. */
  vote: { question: string } | null
  /** Its row in the overview's Rumours card. */
  card?: { title: string; source: string }
}

export const RUMOURS: Rumour[] = [
  {
    id: 'runes-loadouts',
    status: 'half',
    word: 'Half right',
    date: 'Nov 2026',
    title: 'Runes swapped for three champion loadouts',
    claim:
      "Runes removed; each champion gets three loadouts instead, one letting Jinx's ultimate hit turrets.",
    pic: { src: ndImage('teaser-blitzcrank'), caption: 'Blitzcrank at 1:00; God Hand at 1:39' },
    reportedBy: [
      {
        label: 'Reddit user Local_Anything191',
        href: 'https://bo3.gg/lol/news/rumor-league-of-legends-rune-system-to-be-removed-with-new-dawn',
      },
      { label: 'leakers on X, via Insider Gaming', href: IG_RUNES_URL },
    ],
    answer: {
      face: 'meddler',
      quote:
        '"You\'ll still pick Runes, including a Keystone, in New Dawn." And champion choices like God Hand are real: the teaser shows one.',
      who: { label: 'Meddler on X, 16 Nov 2026', href: MEDDLER_NOV_16 },
    },
    vote: { question: 'More God Hands in January?' },
    card: {
      title: 'Runes swapped for champion loadouts',
      source: 'Reddit leak, Nov 2026. Riot: runes stay, but God Hand is real.',
    },
  },
  {
    id: 'wild-rift-look',
    status: 'open',
    word: 'Open',
    date: '14 Nov 2026',
    title: "A look closer to Wild Rift's",
    claim:
      'New models for champions, Baron and the Elder Dragon, "much more in line with the art style of Wild Rift".',
    pic: { src: ndImage('teaser-ahri'), caption: 'Ahri, teaser 1:34' },
    reportedBy: [{ label: "PC Gamer's read of the teaser", href: PCG_URL }],
    answer: null,
    vote: { question: 'Will it look like Wild Rift?' },
    card: {
      title: "A look closer to Wild Rift's",
      source: "PC Gamer's read of the teaser, 14 Nov 2026",
    },
  },
  {
    id: 'league-next',
    status: 'yes',
    word: 'Confirmed',
    date: '18 Dec 2025',
    title: '"League Next", the biggest update in League\'s history',
    claim:
      'Characters, arenas, menus and interface rebuilt for new players, backend work to patch faster. Codename League Next.',
    pic: {
      src: ndImage('video-league-after-2026'),
      caption: "Riot's answer, the same day",
      pos: '50% 0%',
    },
    reportedBy: [
      {
        label: "Bloomberg, Cecilia D'Anastasio",
        href: 'https://www.bloomberg.com/news/articles/2025-12-18/riot-has-a-secret-plan-to-remake-its-league-of-legends-game',
      },
    ],
    answer: {
      face: 'meddler',
      quote:
        'Confirmed within hours: a client built into the game, a new Rift, gameplay changes. The name became New Dawn; faster patching is not confirmed.',
      who: { label: 'Meddler on X, 18 Dec 2025', href: MEDDLER_DEC_18 },
    },
    vote: null,
  },
  {
    id: 'league-2-in-2026',
    status: 'no',
    word: 'Debunked',
    date: '10 Nov 2025',
    title: 'League of Legends 2, as early as late 2026',
    claim:
      'A sequel with legacy code removed and champion kits re-balanced, out in the second half of 2026.',
    pic: { src: FACES.pabro, caption: 'Pabro, 18 Dec 2025' },
    reportedBy: [
      {
        label: 'Summoner Park on Weibo, since deleted',
        href: 'https://x.com/igenico/status/1987812460615832005',
      },
      {
        label: 'translated by BLGenico on X',
        href: 'https://x.com/igenico/status/1987812460615832005',
      },
    ],
    answer: {
      face: 'pabro',
      quote:
        '"We\'re often asked if we\'re gonna make League of Legends 2 some day, and the answer to that has been and remains, no."',
      who: { label: 'Pabro, 18 Dec 2025', href: SHORT_URL },
    },
    vote: null,
    card: {
      title: 'League of Legends 2 in 2026',
      source: 'Summoner Park on Weibo, Nov 2025. Pabro: "has been and remains, no".',
    },
  },
  {
    id: 'change-forever-2025',
    status: 'no',
    word: 'Missed',
    date: '16 Dec 2023',
    title: '"2025 will change League forever"',
    claim:
      "Riot's own hint, the last of ten points about the game's future posted by League's game director at the time.",
    pic: { src: FACES.pupulasers, caption: 'Pupulasers, then game director' },
    reportedBy: [
      { label: 'Pupulasers on X', href: `${X}RiotPupulasers/status/1735934564034302057` },
    ],
    answer: {
      face: 'meddler',
      quote:
        'It slipped by two years: the full reveal is in January 2027, the launch later in 2027.',
      who: { label: 'Dev update, 16 Nov 2026', href: DEV_UPDATE_URL },
    },
    vote: null,
  },
  {
    id: 'riot-mmo-leak',
    status: 'no',
    word: 'Debunked',
    date: 'Nov 2026',
    title: 'A leaked Riot MMO, from a "New Dawn" leaker',
    claim:
      'A PvPvE MMO with three factions, shared as coming from a leaker said to have described New Dawn a year early.',
    pic: { src: FACES.merrill, caption: 'Marc Merrill, Riot co-founder' },
    reportedBy: [
      {
        label: 'r/MMORPG thread',
        href: 'https://www.reddit.com/r/MMORPG/comments/1xwfgr2/riot_mmo_leaks_potentially_credible/',
      },
      { label: 'MeinMMO, 17 Nov', href: 'https://mein-mmo.de/riot-mmo-leak-design-fragwuerdig/' },
    ],
    answer: {
      face: 'merrill',
      quote: '"Nonsense." MeinMMO reports the leaker then said he made it up.',
      who: {
        label: 'Marc Merrill on X, 16 Nov 2026',
        href: `${X}MarcMerrill/status/2122117831798165566`,
      },
    },
    vote: null,
  },
]

/** The overview's Rumours card: the two still open to a vote, then the oldest debunked. */
export const RUMOURS_CARD = ['runes-loadouts', 'wild-rift-look', 'league-2-in-2026']

export const RUMOUR_RULES = [
  'Only reports with a named source and a date',
  "Riot's answer next to each, with its link",
  'A status changes when Riot speaks, never on a vote',
  'Votes have no stakes, no points, no prizes',
]

/** A rumour's votes as the server reads them, and the visitor's own. */
export interface VoteTally {
  yes: number
  no: number
  mine: 'yes' | 'no' | null
}

/** The rumours that take a vote: their ids, for the server. */
export const VOTABLE = RUMOURS.filter((r) => r.vote).map((r) => r.id)

/* ── What people ask ────────────────────────────────────────────── */

const S_X16 = { label: 'Meddler on X, 16 Nov', href: MEDDLER_NOV_16 }
const S_DEV = { label: 'Dev update, 16 Nov, at 0:17', href: at(DEV_UPDATE_URL, 17) }
const S_TLDW = { label: 'TL;DW, 16 Nov', href: TLDW_2027_URL }
const S_SHORT = { label: 'Pabro, 18 Dec 2025', href: SHORT_URL }
const S_TEASER = { label: 'Teaser, 14 Nov, at 0:26', href: at(TEASER_URL, 26) }
const S_TEASER_RIFT = { label: 'Teaser, 14 Nov, at 0:34', href: at(TEASER_URL, 34) }
const S_TEASER_GOD_HAND = { label: 'Teaser, 14 Nov, at 1:39', href: at(TEASER_URL, 99) }
const S_JUN = { label: 'Meddler on X, 12 Jun', href: MEDDLER_JUN_12_ENGINE }
const S_DEC = { label: 'Meddler on X, 18 Dec 2025', href: MEDDLER_DEC_18 }

/** Each answer's picture: a face, a still, champions, or Keystones. */
export type Visual =
  | { kind: 'face'; face: Face }
  | { kind: 'still'; pic: string }
  | { kind: 'champions'; ids: number[] }
  | { kind: 'keystones'; ids: number[] }

export interface Question {
  q: string
  a: Parts
  sources: Source[]
  visual: Visual
}

export const FAQ: Question[] = [
  {
    q: 'Is New Dawn League of Legends 2?',
    a: [
      'No. It is ',
      'a massive update to League itself',
      ', not a separate game. "New Dawn" names the update; the game keeps its name.',
    ],
    sources: [S_X16, S_SHORT],
    visual: { kind: 'face', face: 'pabro' },
  },
  {
    q: 'When does New Dawn come out?',
    a: [
      'Riot shows it in full in ',
      'early January',
      ', "in place of the usual Season Start moment". Broader ',
      'playtests',
      ' follow "shortly after that reveal"; the ',
      'launch is later in 2027',
      ', with the Season Start cinematic.',
    ],
    sources: [S_DEV, S_TLDW],
    visual: { kind: 'still', pic: 'dawn-1280' },
  },
  {
    q: 'Will I keep my champions and skins?',
    a: ['Yes. ', 'Every champion and skin', ' you have today stays usable when New Dawn launches.'],
    sources: [S_X16],
    visual: { kind: 'champions', ids: [53, 103, 99, 89, 245, 202] },
  },
  {
    q: 'Are runes being removed?',
    a: [
      'No. You still pick runes and ',
      'a Keystone',
      '. The system gets lighter to make room for other additions.',
    ],
    sources: [S_X16],
    visual: { kind: 'keystones', ids: [8010, 8112, 8229, 8437] },
  },
  {
    q: 'What happens to the client?',
    a: [
      'It becomes ',
      'part of the game',
      ': Riot moves the client into League\'s own engine. "The client, for one, has to be better."',
    ],
    sources: [S_DEC, S_JUN, S_TEASER],
    visual: { kind: 'still', pic: 'teaser-lobby' },
  },
  {
    q: "What changes on Summoner's Rift?",
    a: [
      '"',
      "Visually revamping Summoner's Rift, evolving its gameplay",
      '", Meddler says in the teaser. Some of January\'s changes are built to carry over into New Dawn.',
    ],
    sources: [S_TEASER_RIFT, S_DEC, S_TLDW],
    visual: { kind: 'still', pic: 'teaser-minions' },
  },
  {
    q: 'What is God Hand?',
    a: [
      'A choice a Blitzcrank player picks at 1:39 in the teaser before fighting up close. ',
      `Riot had not explained it by ${UPDATED_DAY}`,
      '; on 16 Nov Meddler hinted at new content that "adds complexity".',
    ],
    sources: [S_TEASER_GOD_HAND, { label: 'Meddler on Reddit, 16 Nov', href: IG_RUNES_URL }],
    visual: { kind: 'still', pic: 'teaser-blitzcrank' },
  },
  {
    q: 'How do I get into the playtests?',
    a: [
      '',
      "Sign up on Riot's New Dawn page.",
      ` Playtests start "shortly after" the January reveal. Regions, dates and numbers were not given by ${UPDATED_DAY}.`,
    ],
    sources: [S_TLDW, { label: "Riot's New Dawn page", href: RIOT_PAGE_URL }],
    visual: { kind: 'still', pic: 'video-season-2027' },
  },
]

/** What Riot has not answered yet. */
export const OPEN_QUESTIONS = [
  { q: "The reveal's exact day", a: 'Early January is all Riot has said' },
  { q: 'The launch date', a: 'Later in 2027, after the playtests' },
  { q: 'Mac, specs and platforms', a: 'League runs on Windows and macOS today' },
  { q: 'Who gets into the playtests', a: 'Regions and numbers not given' },
  { q: 'Ranked after Ranked Rush', a: "January is set, New Dawn's ranked is not" },
  { q: 'Apps that read the client', a: "Including Invade. We'll write here what works on day one" },
]

/* ── The three tabs ─────────────────────────────────────────────── */

export type NewDawnTab = 'overview' | 'posts' | 'rumours'

export const NEW_DAWN_TABS: {
  key: NewDawnTab
  label: string
  href: string
  count: number | null
}[] = [
  { key: 'overview', label: 'Overview', href: '/new-dawn', count: null },
  { key: 'posts', label: 'Riot posts', href: '/new-dawn/posts', count: POSTS.length },
  { key: 'rumours', label: 'Rumours', href: '/new-dawn/rumours', count: RUMOURS.length },
]

/** Each tab's title and description, for the page head and link previews. */
export const NEW_DAWN_META: Record<NewDawnTab, { title: string; description: string }> = {
  overview: {
    title: 'New Dawn: what Riot said about League in 2027',
    description:
      "New Dawn, Riot's 2027 update to League of Legends: a modernized client built into the game, a visually revamped Summoner's Rift, the full reveal in early January and the launch later in 2027. What the teaser showed, what changes in January, and what people ask, with Riot's sources.",
  },
  posts: {
    title: 'New Dawn: every Riot post and video',
    description: `Every post and video Riot published about New Dawn, newest first: the teaser, the dev updates, Meddler's answers on X and Reddit, with what each one said and its views or likes.`,
  },
  rumours: {
    title: 'New Dawn leaks and rumours',
    description:
      'The New Dawn leaks and rumours with a named source and a date, next to what Riot answered: confirmed, half right, open or debunked, and a vote on the ones still open.',
  },
}
