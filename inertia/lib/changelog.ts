/**
 * The desktop app's release notes as /app/changelog draws them, read on the server
 * (app/services/changelog.ts) from the app's CHANGELOG.md: the page gets them ready to draw.
 */

/** A run of text: plain, bold (`b`), emphasis (`i`) or code (`c`) (`changelog_parse.ts`). */
export interface Run {
  s: string
  b?: true
  i?: true
  c?: true
}

/** A marked line: its headline, its first sentence, the rest that "More" opens, its picture. */
export interface ChangelogFeature {
  key: string
  title: string | null
  first: Run[]
  more: Run[]
  /** `/changelog/<name>.webp?v=…`, with its size in pixels. */
  src?: string
  w?: number
  h?: number
}

/** A list line: its first sentence, and the rest that opening it adds. */
export interface ChangelogItem {
  key: string
  first: Run[]
  more: Run[]
}

export interface ChangelogGroup {
  /** As written: New, Changed, Improved, Fixed, Removed. */
  title: string
  /** Fixed and Removed read quieter. */
  quiet: boolean
  items: ChangelogItem[]
}

export interface ChangelogRelease {
  version: string
  /** `YYYY-MM-DD`, and as the page prints it ("October 15, 2026"); none while unreleased. */
  date: string | null
  day: string | null
  /** The first marked line with a picture: the version's lead. */
  hero: ChangelogFeature | null
  features: ChangelogFeature[]
  groups: ChangelogGroup[]
}
