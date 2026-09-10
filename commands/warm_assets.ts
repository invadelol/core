import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

import riotAssetsService from '#services/riot/assets'
import { ASSET_KINDS, type AssetKind } from '#constants/assets'

/**
 * Pulls every known game asset through the proxy once, so the bytes are
 * already mirrored before a visitor asks for them. Safe to re-run: anything
 * already in the mirror is served from there and never re-fetched.
 */
export default class WarmAssets extends BaseCommand {
  static commandName = 'assets:warm'
  static description = 'Mirror Riot game art so the first page view is served from cache'

  static options: CommandOptions = { startApp: true }

  @flags.array({
    description: `Limit to specific kinds (${ASSET_KINDS.join(', ')})`,
  })
  declare kinds?: string[]

  @flags.number({ description: 'How many assets to fetch at once' })
  declare concurrency?: number

  async run() {
    const kinds = (this.kinds?.length ? this.kinds : [...ASSET_KINDS]).filter(
      (kind): kind is AssetKind => (ASSET_KINDS as readonly string[]).includes(kind)
    )

    if (!kinds.length) {
      this.logger.error(`No valid kinds given. Pick from: ${ASSET_KINDS.join(', ')}`)
      return
    }

    const batchSize = Math.max(1, this.concurrency ?? 12)

    for (const kind of kinds) {
      // 'rank' has no manifest; its ids are the tier names.
      const ids =
        kind === 'rank'
          ? [
              'iron',
              'bronze',
              'silver',
              'gold',
              'platinum',
              'emerald',
              'diamond',
              'master',
              'grandmaster',
              'challenger',
            ]
          : await riotAssetsService.ids(kind)

      if (!ids.length) {
        this.logger.warning(`${kind}: manifest empty, skipping`)
        continue
      }

      let placeholders = 0
      const task = this.logger.await(`${kind}: ${ids.length} assets`).start()

      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize)
        const results = await Promise.all(batch.map((id) => riotAssetsService.get(kind, id)))
        placeholders += results.filter((asset) => asset.placeholder).length
      }

      task.stop()

      if (placeholders) {
        this.logger.warning(
          `${kind}: ${ids.length} done, ${placeholders} fell back to placeholders`
        )
      } else {
        this.logger.success(`${kind}: ${ids.length} done`)
      }
    }
  }
}
