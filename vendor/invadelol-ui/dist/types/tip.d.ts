/** Shows `text` over `target`; `linger` closes it by itself after that many ms (a tap). */
export declare function showTip(target: Element, text: string, linger?: number): void;
/** Hides the tooltip; with a `target`, only when it is that target's. */
export declare function hideTip(target?: Element): void;
/** Whether the tooltip is open on `target`. */
export declare const tipOn: (target: Element) => boolean;
