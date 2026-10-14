/** Where the source lives. Linked from the footer on every page. */
export const REPO_URL = 'https://github.com/invadelol/core'

/** The community server. Linked from the footer; `/discord` redirects here. */
export const DISCORD_URL = 'https://discord.gg/JC2QTNmDyu'

/** The public contract between the desktop app and invade.lol: what the app sends, field by field. */
export const SYNC_CONTRACT_URL = `${REPO_URL}/blob/main/docs/desktop-sync.md`

/** The X account. Linked from the footer; `/x` redirects here. */
export const X_URL = 'https://x.com/invadedotlol'

/**
 * Where the desktop app's "Report a bug" button lands (`/bugs`). The invite for now: a direct
 * link to the #bug-reports forum only works for members, so new users join first.
 */
export const BUGS_URL = DISCORD_URL
