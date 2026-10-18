import type { FavoriteFolder, FavoriteProfile } from "../logic/accounts";
import "../styles/accounts.css";
type __VLS_Props = {
    folders: FavoriteFolder[];
    profiles: FavoriteProfile[];
    status?: string;
    layout?: "strip" | "list";
    busy?: boolean;
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
    status: string;
    layout: "strip" | "list";
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
declare const _default: typeof __VLS_export;
export default _default;
