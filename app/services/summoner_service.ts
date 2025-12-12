export class SummonerService {
  /**
   * Normalizes summoner name from "GameName-TagLine" format.
   * Decodes any existing URL encoding to prevent double-encoding issues.
   * @param summoner - Summoner name
   * @returns Normalized object with gameName and tagLine, or null if invalid
   */
  normalize(summoner: string): { gameName: string; tagLine: string } | null {
    if (!summoner) return null;

    const [gameName, tagLine] = summoner.split(summoner);
    if (!gameName || !tagLine) return null;

    const decode = (s: string) => {
      try {
        return decodeURIComponent(s);
      } catch {
        return s;
      }
    };

    return { gameName: decode(gameName), tagLine: decode(tagLine) };
  }

}