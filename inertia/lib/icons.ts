import type { Component } from 'vue'
import type { ObjectiveIconName, StatIconName } from '@invadelol/ui'
import {
  AppWindow,
  ArrowDown,
  ArrowLeftRight,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  BadgeCheck,
  Ban,
  Bell,
  Bookmark,
  BookmarkCheck,
  BookmarkPlus,
  ChartLine,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock,
  Coins,
  Copy,
  CornerDownLeft,
  Crown,
  Download,
  Droplet,
  ExternalLink,
  Eye,
  FileText,
  Film,
  Flag,
  Flame,
  FlaskConical,
  Globe,
  GripVertical,
  Heart,
  House,
  Image,
  Keyboard,
  Laptop,
  Layers,
  LayoutGrid,
  Link,
  List,
  ListPlus,
  Lock,
  LogOut,
  Map as MapIcon,
  Menu,
  MessageSquare,
  Minus,
  Monitor,
  Moon,
  Newspaper,
  Pencil,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Route,
  ScrollText,
  Search,
  Settings,
  Share2,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Square,
  Star,
  Sun,
  Swords,
  Target,
  TrendingUp,
  Trophy,
  User,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-vue-next'

/**
 * The site's icons, in the line family invade.lol has always drawn with: Lucide's glyphs (24 px
 * grid, 2 px strokes, round caps and joins), the set the profile, the search and the header used
 * before the redesign. A game concept takes Riot's own glyph instead (`riot*` names, from
 * @invadelol/ui: the client's post-game stat icons and match-history objectives), and a brand
 * keeps its own mark (`paths`). Components/ui/Icon.vue draws every kind from its name, so a page
 * only ever picks a name.
 */

/** A brand mark or a shape Lucide has no glyph for, drawn on the old 20 px grid. */
type Paths = { paths: { d: string; transform?: string }[] }
/** Riot's own glyph for a game concept. */
type Riot = { stat: StatIconName } | { objective: ObjectiveIconName }
export type IconDef = Component | Paths | Riot

export const ICONS = {
  search: Search,
  home: House,
  list: List,
  grid: LayoutGrid,
  /** A pro: the star the pro ladder and the home's pros card wear. */
  pro: Star,
  trophy: Trophy,
  crown: Crown,
  /** A chart: the site's charts are one line. */
  chart: ChartLine,
  /** A rise: what a patch moved, a climb. */
  trend: TrendingUp,
  live: Radio,
  play: Play,
  layers: Layers,
  user: User,
  users: Users,
  /** Follow someone; once followed, the check. */
  follow: UserPlus,
  following: UserCheck,
  /** Save a build to one's own; once saved, the check. */
  save: BookmarkPlus,
  saved: BookmarkCheck,
  /** A link to copy. */
  link: Link,
  sliders: SlidersHorizontal,
  download: Download,
  arrow: ArrowRight,
  up: ArrowUp,
  down: ArrowDown,
  chev: ChevronDown,
  chevr: ChevronRight,
  bell: Bell,
  clock: Clock,
  swords: Swords,
  flame: Flame,
  /** First blood. */
  blood: Droplet,
  ban: Ban,
  shield: Shield,
  route: Route,
  star: Star,
  external: ExternalLink,
  share: Share2,
  refresh: RefreshCw,
  copy: Copy,
  eye: Eye,
  target: Target,
  coin: Coins,
  window: AppWindow,
  heart: Heart,
  x: X,
  back: ChevronLeft,
  plus: Plus,
  /** The Enter key, on the search's highlighted row. */
  enter: CornerDownLeft,
  check: Check,
  /** An Invade profile's edit, a review's. */
  pencil: Pencil,
  /** A skin on the wishlist. */
  bookmark: Bookmark,
  /** Add a skin to a list. */
  listPlus: ListPlus,
  /** A beta tester. */
  flask: FlaskConical,
  /** A verified pro's Invade profile. */
  verified: BadgeCheck,
  /** A row that drags into another place. */
  grip: GripVertical,
  image: Image,
  /** A clip only its owner sees, one only its link opens. */
  lock: Lock,
  minimap: MapIcon,
  scroll: ScrollText,
  keyboard: Keyboard,
  flag: Flag,
  globe: Globe,
  compare: ArrowLeftRight,
  /** Both ways at once: a change that buffs and nerfs. */
  updown: ArrowUpDown,
  logout: LogOut,
  settings: Settings,
  news: Newspaper,
  spark: Sparkles,
  min: Minus,
  max: Square,
  fwd: ChevronRight,
  menu: Menu,
  sun: Sun,
  moon: Moon,
  monitor: Monitor,
  laptop: Laptop,
  /** A video to start (a play triangle on its own). */
  triangle: Play,
  /** An article or a web page. */
  page: FileText,
  film: Film,
  chat: MessageSquare,
  question: CircleHelp,

  // Riot's glyphs, for what the game itself draws.
  riotKda: { stat: 'kda' },
  riotDamage: { stat: 'damage' },
  riotTaken: { stat: 'taken' },
  riotGold: { stat: 'gold' },
  riotCs: { stat: 'cs' },
  riotVision: { stat: 'vision' },
  riotTower: { objective: 'tower' },
  riotInhib: { objective: 'inhib' },
  riotDragon: { objective: 'dragon' },
  riotBaron: { objective: 'baron' },
  riotHerald: { objective: 'herald' },
  riotGrubs: { objective: 'grubs' },

  // Brand marks and shapes of our own.
  discord: {
    paths: [
      { d: 'M5 5.5 8 4.5l.5 1h3l.5-1 3 1 2 6.5-3.5 3-1-1.5h-5l-1 1.5L3 12Z' },
      { d: 'M7.5 9.5h1M11.5 9.5h1' },
    ],
  },
  github: {
    paths: [
      {
        d: 'M7.5 17.5v-3l-1-1.5C3.5 12.5 3 10.5 3 8.5l1-2.5-.3-2.5 2.6 1h5.4l2.6-1-.3 2.5 1 2.5c0 2-.5 4-3.5 4.5l-1 1.5v3',
      },
      { d: 'M7.5 15.5c-2 .5-3-.5-3.5-1.5' },
    ],
  },
  /** A video on YouTube. */
  youtube: {
    paths: [
      {
        d: 'M2.5 6.5c0-1.4 1-2.5 2.4-2.6C6.6 3.8 8.3 3.7 10 3.7s3.4.1 5.1.2c1.4.1 2.4 1.2 2.4 2.6v7c0 1.4-1 2.5-2.4 2.6-1.7.1-3.4.2-5.1.2s-3.4-.1-5.1-.2c-1.4-.1-2.4-1.2-2.4-2.6Z',
      },
      { d: 'm8.5 7.5 4 2.5-4 2.5Z' },
    ],
  },
  /** A comment on Reddit. */
  reddit: {
    paths: [
      { d: 'M10 7.5c3.6 0 6.5 2 6.5 4.5S13.6 16.5 10 16.5 3.5 14.5 3.5 12 6.4 7.5 10 7.5Z' },
      { d: 'M10 7.5 11 3.5l3 .8' },
      { d: 'M7.5 11.5h.01M12.5 11.5h.01M8 14c1.2.7 2.8.7 4 0' },
    ],
  },
  /** Half right: a disc, its right half filled (the first path takes the fill). */
  half: { paths: [{ d: 'M10 3a7 7 0 1 1 0 14Z' }, { d: 'M10 3a7 7 0 1 0 0 14' }] },
} satisfies Record<string, IconDef>

export type IconName = keyof typeof ICONS

/**
 * The colour an icon carries in a section or card head, where it says what the section is about
 * (`tone="auto"` on Icon.vue): gold for the best, the pros and gold itself, red for bans and
 * first blood. Every other head icon stays violet.
 */
export type IconTone = 'gold' | 'red'

export const ICON_TONES: Partial<Record<IconName, IconTone>> = {
  trophy: 'gold',
  crown: 'gold',
  star: 'gold',
  pro: 'gold',
  coin: 'gold',
  riotGold: 'gold',
  ban: 'red',
  blood: 'red',
}
