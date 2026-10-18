import type { AccountProfile } from '../logic/accounts';
import '../styles/accounts.css';
/**
 * The League accounts of one Invade account. The main one leads (it opens first on invade.lol and
 * in the app); the others follow as rows that can take its place. `pending` are accounts the host
 * has seen but that aren't verified yet (the app: accounts signed in on this computer), and
 * `current` the one signed in to League right now: only that one can be verified. The `extra`
 * slot adds the host's own figures to a row (the app: games saved, most played).
 */
type __VLS_Props = {
    accounts: AccountProfile[];
    mainPuuid: string | null;
    pending?: AccountProfile[];
    current?: string | null;
    busy?: boolean;
};
type __VLS_Slots = {
    extra?: (p: {
        profile: AccountProfile;
    }) => unknown;
};
declare const __VLS_base: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    main: (puuid: string) => any;
    open: (profile: AccountProfile) => any;
    verify: () => any;
}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{
    onMain?: ((puuid: string) => any) | undefined;
    onOpen?: ((profile: AccountProfile) => any) | undefined;
    onVerify?: (() => any) | undefined;
}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
declare const __VLS_export: __VLS_WithSlots<typeof __VLS_base, __VLS_Slots>;
declare const _default: typeof __VLS_export;
export default _default;
type __VLS_WithSlots<T, S> = T & {
    new (): {
        $slots: S;
    };
};
