export type StatGroups = Map<string, Set<symbol>>;
export declare function provideStatGroups(): StatGroups;
export declare const useStatGroups: () => StatGroups | null;
