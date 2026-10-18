/** User accounts are distinct from the League profiles a device observes. */
export interface AccountProfile {
    puuid: string;
    gameName: string;
    tagLine: string;
    platform: string;
    profileIconId: number | null;
    tier?: string | null;
    division?: string | null;
    lp?: number | null;
    verifiedAt?: string;
}
export interface FavoriteFolder {
    id: string;
    name: string;
}
export interface FavoriteProfile extends AccountProfile {
    folderId: string | null;
}
export interface InvadeAccountData {
    user: {
        id: string;
        name: string;
        provider: string;
    } | null;
    mainPuuid: string | null;
    accounts: AccountProfile[];
    folders: FavoriteFolder[];
    favorites: FavoriteProfile[];
    devices: {
        id: string;
        os: string;
        app: string;
        lastSeenAt: string | null;
    }[];
}
