/**
 * The champ select the /app page shows: Kestrel hovers Lee Sin in the jungle against Viego. The
 * figures are the shape of what the overlay shows, not live statistics.
 */
export const DRAFT = {
  runes: {
    champion: 'Lee Sin',
    position: 'Jungle',
    page: { p: [8000, 8010, 9111, 9104, 8299], s: [8400, 8473, 8242], m: [5007, 5008, 5011] },
    spells: [4, 11],
    skills: 'Q › W › E',
    boots: [3047],
    core: [6692, 3071, 6333],
  },
  odds: {
    win: 0.56,
    lanes: [
      { lane: 'TOP' as const, ally: 266, enemy: 897, w: 0.48 },
      { lane: 'JUNGLE' as const, ally: 64, enemy: 234, w: 0.52 },
      { lane: 'MID' as const, ally: 45, enemy: 103, w: 0.55 },
      { lane: 'ADC' as const, ally: 222, enemy: 145, w: 0.51 },
      { lane: 'SUPPORT' as const, ally: 412, enemy: 111, w: 0.53 },
    ],
  },
  counters: {
    enemy: { id: 234, name: 'Viego' },
    lane: 'JUNGLE' as const,
    picks: [
      { id: 64, name: 'Lee Sin', games: '4.2k', edge: 0.031, mine: 12 },
      { id: 254, name: 'Vi', games: '3.8k', edge: 0.026 },
      { id: 5, name: 'Xin Zhao', games: '2.9k', edge: 0.022 },
    ],
  },
}
