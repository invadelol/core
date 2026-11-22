import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import riotQuota, { type QuotaKind } from '#services/quota/riot_quota'
import { crossSiteRequest } from '#utils/origins'

/**
 * On a route that can make invade.lol ask Riot: refuses a browser request made for another
 * site's page (`crossSiteRequest`), then runs the route under the client's Riot quota (`kind`;
 * none only counts what it spends). `crossSite` lets other sites in, for images they embed.
 */
export default class RiotQuotaMiddleware {
  async handle(
    ctx: HttpContext,
    next: NextFn,
    options: { kind?: QuotaKind; crossSite?: boolean } = {}
  ) {
    if (!options.crossSite && crossSiteRequest(ctx.request)) {
      return ctx.response.status(403).send({
        errors: [{ message: 'Not available to other sites', code: 'E_CROSS_SITE' }],
      })
    }
    return riotQuota.run(ctx.request.ip(), options.kind ?? null, () => next())
  }
}
