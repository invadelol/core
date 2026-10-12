/**
 * SVG path through points sorted by x: a monotone cubic (d3's `curveMonotoneX`), smooth without
 * ever bulging past a point, so a chart never shows a value that was not reached.
 */
export declare function monotone(p: readonly (readonly [number, number])[]): string;
