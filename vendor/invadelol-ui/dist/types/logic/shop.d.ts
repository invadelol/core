/** A player's purchases as the build path reads them. */
import type { Purchase } from './types.js';
/** One visit to the shop: what was bought and sold, same items stacked. */
export interface ShopVisit {
    /** Seconds into the game of its first action. */
    t: number;
    items: {
        item: number;
        sold: boolean;
        count: number;
        t: number;
    }[];
}
/**
 * A player's purchases as visits to the shop, in order. Actions closer than `VISIT_GAP` share a
 * visit; inside one, the same item bought (or sold) again is counted, not repeated.
 */
export declare function shopVisits(purchases: Purchase[]): ShopVisit[];
