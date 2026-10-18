import type { AccountProfile } from "../logic/accounts";
import "../styles/accounts.css";
type __VLS_Props = {
    accounts: AccountProfile[];
    mainPuuid: string | null;
    busy?: boolean;
};
declare const __VLS_export: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    main: (puuid: string) => any;
    open: (profile: AccountProfile) => any;
    verify: () => any;
}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{
    onMain?: ((puuid: string) => any) | undefined;
    onOpen?: ((profile: AccountProfile) => any) | undefined;
    onVerify?: (() => any) | undefined;
}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
declare const _default: typeof __VLS_export;
export default _default;
