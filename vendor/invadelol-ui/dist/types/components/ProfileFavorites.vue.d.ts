import type { FavoriteFolder, FavoriteProfile } from '../logic/accounts';
import '../styles/accounts.css';
/**
 * Favorite players, sorted into folders (a Clash team, a duo…), synced by the host. `strip` sits
 * above a match history: folder tabs and a few tiles. `list` is the full manager: a folder rail
 * and one row per player. Folders are created and renamed in place; a player's menu moves it
 * between folders or removes it.
 */
type __VLS_Props = {
    folders: FavoriteFolder[];
    profiles: FavoriteProfile[];
    status?: string;
    layout?: 'strip' | 'list';
    busy?: boolean;
    /** Tiles shown in the strip before "Show all". */
    limit?: number;
    /** The strip's title (default: Favorites). */
    title?: string;
};
declare const __VLS_export: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    search: () => any;
    move: (puuid: string, folderId: string | null) => any;
    open: (profile: FavoriteProfile) => any;
    create: (name: string) => any;
    rename: (id: string, name: string) => any;
    removeFolder: (id: string) => any;
    remove: (puuid: string) => any;
}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{
    onSearch?: (() => any) | undefined;
    onMove?: ((puuid: string, folderId: string | null) => any) | undefined;
    onOpen?: ((profile: FavoriteProfile) => any) | undefined;
    onCreate?: ((name: string) => any) | undefined;
    onRename?: ((id: string, name: string) => any) | undefined;
    onRemoveFolder?: ((id: string) => any) | undefined;
    onRemove?: ((puuid: string) => any) | undefined;
}>, {
    title: string;
    status: string;
    layout: "strip" | "list";
    limit: number;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
declare const _default: typeof __VLS_export;
export default _default;
