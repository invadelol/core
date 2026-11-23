import db from '@adonisjs/lucid/services/db'

/**
 * Verified pros: an administrator links a pro (the pro data core keeps) to the Invade account the
 * pro signed in with. The profile then shows the verified mark, their team, role and every
 * account the pro data lists. One account per pro, one pro per account.
 */
export type VerifyResult = 'linked' | 'no-account' | 'no-pro' | 'pro-taken'

export async function verifyPro(handle: string, slug: string): Promise<VerifyResult> {
  return db.transaction(async (trx) => {
    const user = await trx.from('invade_user').where('handle', handle.toLowerCase()).first()
    if (!user) return 'no-account'
    const pro = await trx.from('pro_player').where('slug', slug).first()
    if (!pro) return 'no-pro'
    const taken = await trx
      .from('invade_verified_pro')
      .where('player_id', pro.id)
      .whereNot('user_id', user.id)
      .first()
    if (taken) return 'pro-taken'
    await trx
      .knexQuery()
      .table('invade_verified_pro')
      .insert({ user_id: user.id, player_id: pro.id, verified_at: new Date() })
      .onConflict('user_id')
      .merge(['player_id', 'verified_at'])
    return 'linked'
  })
}

/** Takes the verification back; true when there was one. */
export async function unverifyPro(handle: string): Promise<boolean> {
  const user = await db.from('invade_user').where('handle', handle.toLowerCase()).first()
  if (!user) return false
  const removed = await db.from('invade_verified_pro').where('user_id', user.id).delete()
  return Number(removed) > 0
}
