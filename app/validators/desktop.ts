import vine from '@vinejs/vine'

/**
 * Request shapes of the desktop routes (docs/desktop-sync.md §2). Shape
 * only: whether an upload describes a plausible game is decided by
 * `match_validation.ts` (E_INVALID_MATCH), and LP reports by `lp.ts`.
 */

const strictNumber = () => vine.number({ strict: true })
const strictBoolean = () => vine.boolean({ strict: true })
const rawPuuid = () =>
  vine
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/)

export const registerDeviceValidator = vine.compile(
  vine.object({
    app: vine
      .string()
      .trim()
      .maxLength(32)
      .regex(/^[0-9A-Za-z.+-]+$/),
    os: vine.enum(['macos', 'windows']),
  })
)

export const linkValidator = vine.compile(
  vine.object({
    gameName: vine.string().trim().minLength(1).maxLength(32),
    tagLine: vine.string().trim().minLength(1).maxLength(8),
    platform: vine.string().trim().toUpperCase().maxLength(8),
    rawPuuid: rawPuuid().nullable().optional(),
    source: vine.enum(['lcu', 'riot_id']),
  })
)

export const unlinkValidator = vine.compile(
  vine.object({
    puuid: vine
      .string()
      .trim()
      .regex(/^[a-zA-Z0-9_-]{78}$/),
  })
)

export const resolveValidator = vine.compile(
  vine.object({
    gameName: vine.string().trim().minLength(1).maxLength(32),
    tagLine: vine.string().trim().minLength(1).maxLength(8),
    platform: vine.string().trim().toUpperCase().maxLength(8).optional(),
  })
)

const team = vine.object({
  teamId: strictNumber(),
  win: vine.string(),
  bans: vine
    .array(vine.object({ championId: strictNumber(), pickTurn: strictNumber() }))
    .maxLength(10)
    .optional(),
  baronKills: strictNumber().optional(),
  dragonKills: strictNumber().optional(),
  hordeKills: strictNumber().optional(),
  riftHeraldKills: strictNumber().optional(),
  towerKills: strictNumber().optional(),
  inhibitorKills: strictNumber().optional(),
  firstBlood: strictBoolean().optional(),
  firstTower: strictBoolean().optional(),
  firstBaron: strictBoolean().optional(),
  firstDargon: strictBoolean().optional(),
  firstInhibitor: strictBoolean().optional(),
  firstRiftHerald: strictBoolean().optional(),
})

const participant = vine.object({
  participantId: strictNumber(),
  teamId: strictNumber(),
  championId: strictNumber(),
  spell1Id: strictNumber().nullable().optional(),
  spell2Id: strictNumber().nullable().optional(),
  position: vine.string().maxLength(16).nullable().optional(),
  // Numbers and booleans only; checked value by value by the structural rules.
  stats: vine.record(vine.any()),
  timeline: vine
    .object({
      lane: vine.string().maxLength(16).nullable().optional(),
      role: vine.string().maxLength(16).nullable().optional(),
    })
    .nullable()
    .optional(),
})

const identity = vine.object({
  participantId: strictNumber(),
  player: vine.object({
    puuid: vine.string(),
    gameName: vine.string().maxLength(32),
    tagLine: vine.string().maxLength(8),
    profileIcon: strictNumber().nullable().optional(),
  }),
})

/** Two hours of one-minute frames, with room to spare. */
const MAX_FRAMES = 200

export const uploadValidator = vine.compile(
  vine.object({
    schema: vine.literal(1),
    matchId: vine.string().maxLength(32),
    uploader: rawPuuid(),
    capturedAt: strictNumber(),
    app: vine.string().trim().maxLength(32),
    game: vine.object({
      gameId: strictNumber(),
      platformId: vine.string().maxLength(8),
      gameCreation: strictNumber(),
      gameDuration: strictNumber(),
      queueId: strictNumber(),
      mapId: strictNumber(),
      gameMode: vine.string().maxLength(32),
      gameType: vine.string().maxLength(32),
      gameVersion: vine.string().maxLength(32),
      participantIdentities: vine.array(identity).maxLength(16),
      participants: vine.array(participant).maxLength(16),
      teams: vine.array(team).maxLength(16),
    }),
    timeline: vine
      .object({
        frameInterval: strictNumber(),
        frames: vine
          .array(
            vine.object({
              timestamp: strictNumber(),
              participantFrames: vine.record(vine.any()),
              events: vine.array(vine.any()),
            })
          )
          .maxLength(MAX_FRAMES),
      })
      .nullable()
      .optional(),
    lp: vine.any().optional(),
  })
)

/**
 * A batch of player snapshots (§6.1). Only the batch is checked here: 1–25
 * players, each an object with a raw PUUID, no PUUID twice. Everything else
 * is checked player by player (`player_rules.ts`), so one bad player is
 * `rejected` on its own instead of failing the batch.
 */
export const playersValidator = vine.compile(
  vine.object({
    schema: vine.literal(1),
    platform: vine.string().trim().toUpperCase().maxLength(8),
    app: vine.string().trim().maxLength(32),
    players: vine
      .array(
        vine
          .object({ rawPuuid: vine.string().trim().toLowerCase().maxLength(64) })
          .allowUnknownProperties()
      )
      .minLength(1)
      .maxLength(25)
      .distinct('rawPuuid'),
  })
)
