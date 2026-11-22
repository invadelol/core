/**
 * An Invade account as the site and the desktop app receive it (`GET /api/account`,
 * `GET /api/desktop/account`, docs/desktop-sync.md §10). Shared by the server and the pages.
 */

export type AccountProvider = 'discord' | 'google'

/** A League account as an account lists it: owned, main or favorite. */
export interface AccountProfile {
  /** The Riot API PUUID (78 characters), as on every other route of the site. */
  puuid: string
  gameName: string
  tagLine: string
  platform: string
  profileIconId: number | null
  /** The newest Solo/Duo rank stored, when there is one. */
  tier: string | null
  division: string | null
  lp: number | null
}

export interface OwnedAccount extends AccountProfile {
  /** When a connected app last proved it (ISO). */
  verifiedAt: string
}

export interface FavoriteFolder {
  id: string
  name: string
}

export interface FavoriteProfile extends AccountProfile {
  folderId: string | null
  /** ISO. */
  addedAt: string
}

export interface AccountDevice {
  id: string
  os: string
  app: string
  linkedAt: string
  lastSeenAt: string | null
}

export interface AccountUser {
  id: string
  name: string
  /** The sign-in methods attached to the account. */
  providers: AccountProvider[]
  createdAt: string
}

export interface InvadeAccountData {
  user: AccountUser | null
  mainPuuid: string | null
  accounts: OwnedAccount[]
  folders: FavoriteFolder[]
  favorites: FavoriteProfile[]
  devices: AccountDevice[]
}

/** What every page knows about the signed-in visitor (the header's account menu). */
export interface Viewer {
  name: string
  main: AccountProfile | null
  accounts: number
  favorites: number
  apps: number
  /** The favorite players' PUUIDs, so a profile's star shows its state without a request. */
  favoritePuuids: string[]
}

/** One change, as `POST /api/account/changes` and `POST /api/desktop/account/changes` take it. */
export type AccountChange =
  | { type: 'main'; puuid: string }
  | { type: 'removeAccount'; puuid: string }
  | { type: 'favorite'; puuid: string; folderId?: string | null }
  | { type: 'removeFavorite'; puuid: string }
  | { type: 'moveFavorite'; puuid: string; folderId: string | null }
  | { type: 'createFolder'; id: string; name: string }
  | { type: 'renameFolder'; id: string; name: string }
  | { type: 'deleteFolder'; id: string }
  | { type: 'unlinkDevice'; deviceId: string }
  | { type: 'rename'; name: string }

export const emptyAccount = (): InvadeAccountData => ({
  user: null,
  mainPuuid: null,
  accounts: [],
  folders: [],
  favorites: [],
  devices: [],
})

/** Limits, the same for the site and the app. */
export const ACCOUNT_LIMITS = { folders: 30, favorites: 300, folderName: 40, displayName: 32 }
