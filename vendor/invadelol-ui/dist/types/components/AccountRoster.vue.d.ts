import type { AccountProfile } from '../logic/accounts';
import '../styles/base.css';
import '../styles/primitives.css';
import '../styles/profile.css';
import '../styles/accounts.css';
/**
 * The League accounts of an Invade account, one row each. The main one (opened first on the site
 * and in the app) carries a badge; another row can take its place. `verify` asks the host to add
 * an account: only the desktop app can prove one.
 */
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
