import type { FavoriteFolder, FavoriteProfile } from '../logic/accounts';
import '../styles/base.css';
import '../styles/primitives.css';
import '../styles/profile.css';
import '../styles/accounts.css';
/**
 * Favorite players, filtered by folder. `strip` sits above a match history: the players as a
 * grid of rows that open their profile, and a Manage link. `list` manages them: folders are
 * created, renamed and deleted from the head, and each row moves its player or removes it.
 */
type __VLS_Props = {
    folders: FavoriteFolder[];
    profiles: FavoriteProfile[];
    layout?: 'strip' | 'list';
    busy?: boolean;
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
    manage: () => any;
}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{
    onSearch?: (() => any) | undefined;
    onMove?: ((puuid: string, folderId: string | null) => any) | undefined;
    onOpen?: ((profile: FavoriteProfile) => any) | undefined;
    onCreate?: ((name: string) => any) | undefined;
    onRename?: ((id: string, name: string) => any) | undefined;
    onRemoveFolder?: ((id: string) => any) | undefined;
    onRemove?: ((puuid: string) => any) | undefined;
    onManage?: (() => any) | undefined;
}>, {
    title: string;
    layout: "strip" | "list";
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
declare const _default: typeof __VLS_export;
export default _default;
