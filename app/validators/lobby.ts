import vine from '@vinejs/vine'

/** The players of one lobby, by Riot ID, and how many stored games to answer for each. */
export const lobbyGamesValidator = vine.compile(
  vine.object({
    platform: vine.string().trim().toUpperCase().maxLength(8).optional(),
    count: vine.number().withoutDecimals().min(1).max(40).optional(),
    players: vine
      .array(
        vine.object({
          gameName: vine.string().trim().minLength(1).maxLength(32),
          tagLine: vine.string().trim().minLength(1).maxLength(8),
        })
      )
      .minLength(1)
      .maxLength(10),
  })
)
