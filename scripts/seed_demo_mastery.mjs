/**
 * Local development only: gives the fictional demo profile (Briar Signal#5555, puuid
 * `demohomea0010…`) a full champion mastery pool, so Champions → Mastery can be seen without
 * Riot. Writes one `player_mastery` row (source `desktop`), the snapshot the mastery API falls
 * back to when Riot cannot answer. Idempotent: running it again rewrites the same row.
 *
 *   node scripts/seed_demo_mastery.mjs
 *
 * Every figure here is made up. It refuses to run in production or against a remote database.
 */
import pg from 'pg'

try {
  process.loadEnvFile('.env')
} catch {
  // The environment may already be set.
}

const { NODE_ENV, DB_HOST = '127.0.0.1', DB_PORT, DB_USER, DB_PASSWORD, DB_DATABASE } = process.env
if (NODE_ENV === 'production' || !['127.0.0.1', 'localhost', '::1'].includes(DB_HOST)) {
  console.error('Refusing to seed: this script only writes to a local development database.')
  process.exit(1)
}

/** A few mains, then a long tail, as a real pool looks. */
const MAINS = [
  [14, 1_284_350],
  [233, 742_910],
  [96, 516_205],
  [112, 311_480],
  [238, 268_120],
  [110, 201_975],
  [895, 174_300],
  [11, 152_640],
  [420, 131_080],
  [98, 118_455],
]

const TAIL = [
  58, 63, 64, 103, 893, 887, 22, 427, 421, 350, 235, 203, 92, 86, 114, 234, 267, 517, 901, 111, 141,
  40, 37, 19, 68, 56, 25, 429, 950, 526, 1, 3, 4, 7, 8, 10, 12, 13, 15, 17, 18, 21, 24, 28, 31, 36,
  39, 45, 51, 53, 54, 61, 67, 75, 81, 84, 89, 99, 104, 117, 122, 145, 157, 202, 222, 266, 412, 777,
]

/** Deterministic, so every run writes the same pool. */
let seed = 5555
const random = () => {
  seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648
  return seed / 2_147_483_648
}

/** Points to a level as the current system reads (marks gate the levels past five). */
function levelOf(points) {
  const steps = [0, 600, 1800, 4200, 6600, 9600, 12_600, 15_600, 18_600, 21_600]
  if (points >= 21_600) return 10 + Math.floor(((points - 21_600) / 11_000) * 0.8)
  let level = 1
  for (const [index, step] of steps.entries()) if (points >= step) level = index + 1
  return level
}

const DAY = 86_400_000
const now = Date.now()
const entries = [
  ...MAINS.map(([championId, championPoints], index) => ({
    championId,
    championPoints,
    lastPlayTime: now - Math.round((0.2 + index * 1.6 + random() * 3) * DAY),
  })),
  ...TAIL.map((championId, index) => ({
    championId,
    championPoints: Math.round(110_000 * (index + 2) ** -1.1 * (0.75 + random() * 0.5)),
    lastPlayTime: now - Math.round((6 + index * 9 + random() * 40) * DAY),
  })),
].map((entry) => ({ ...entry, championLevel: levelOf(entry.championPoints) }))

const client = new pg.Client({
  host: DB_HOST,
  port: Number(DB_PORT ?? 5432),
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_DATABASE,
})
await client.connect()
try {
  const { rows } = await client.query(
    `SELECT puuid FROM riot_player
     WHERE game_name = 'Briar Signal' AND tag_line = '5555' AND puuid LIKE 'demohome%'`
  )
  if (!rows.length) {
    console.error('The demo profile Briar Signal#5555 is not in this database.')
    process.exitCode = 1
  } else {
    await client.query(
      `INSERT INTO player_mastery (puuid, entries, observed_at, source, device_id)
       VALUES ($1, $2, now(), 'desktop', NULL)
       ON CONFLICT (puuid) DO UPDATE
       SET entries = excluded.entries, observed_at = excluded.observed_at,
           source = excluded.source, device_id = NULL`,
      [rows[0].puuid, JSON.stringify(entries)]
    )
    const total = entries.reduce((sum, entry) => sum + entry.championPoints, 0)
    console.log(`Seeded ${entries.length} champions (${total} points) for Briar Signal#5555.`)
  }
} finally {
  await client.end()
}
