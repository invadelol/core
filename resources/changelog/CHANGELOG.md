# Changelog

## 0.3.2

### New

- **Your game, live on your Discord profile.** While you play, friends see your champion, rank and score on a card drawn by invade.lol, with a line that follows the game: a gank, a multikill, a stolen Baron, your CS. A button opens the game live on invade.lol, and the result stays up for three minutes after the game. Settings → Discord turns it off, or hides the live button. <!-- highlight --> <!-- image presence.webp -->
- **Most picked augments in ARAM: Mayhem.** When you can choose an augment (at the start, while dead, just after you respawn), a small panel lists the augments players pick most on your champion, by rarity, in your language. <!-- image augments.webp -->
- **Invade starts when you log in.** It waits in the tray, ready for your first game, and opening it yourself still shows the window. Settings → Startup turns it off, and updates keep your choice.
- **Anonymous crash reports.** When Invade crashes, it reports the version, your system and the first line of the error, with names, Riot IDs and folders removed, so the crash gets fixed without you having to report it. Settings → Data turns it off; until you change it, it follows your usage statistics choice.
- **What's new has its own page.** The (i) at the top right now opens the notes of every version, with pictures. The window after an update leads there too, and Settings no longer has a Changelog.

### Changed

- **Move a panel by its header.** Grab the whole top of a panel, Invade logo included, and it follows from the first click. A cursor just passing over a panel still leaves your clicks to the game.
- **The overlay follows the game mode.** Outside Summoner's Rift (ARAM, ARAM: Mayhem, Arena and other modes), it no longer shows Rift objectives, lane gold, rank targets or builds, and champ select no longer imports a Rift rune page. Both ARAM modes keep the team gold lead on the scoreboard. The Live tab no longer suggests Rift builds, lane picks or draft odds in those champ selects either.
- **Patches go by their 2026 names.** Builds, tiers and matchups say Patch 26.19, as in the game client and Riot's patch notes.
- **Build rows only say how many games they rest on.** The win rate, pick rate and confidence next to spells, skill order, starting items and the other rows are gone.

### Fixed

- **Scoreboard gold is right.** It counts what your items really cost, so finishing an item no longer makes a lane look behind and starting items never show as a lead. Each figure stays on its player however often you open the scoreboard. Gold per minute and the Live tab's team gold count the same way. <!-- highlight -->
- **Overlays you switch off stay off after a restart.** Invade now saves your overlay choices, panel positions and the tray's Show / hide the moment you change them, so a shutdown, a crash or an update can no longer turn every overlay back on. <!-- highlight -->
- **Runes you change yourself in champ select stay yours.** Invade no longer writes its page over yours, even when you open or click the app. Its import button still puts its page in when you ask.
- **Deleting a whole game works on Windows again.** It failed with "Could not move to the Recycle Bin, Code 124". If the Recycle Bin or Trash can't take a recording, Invade says why and what to do, and never deletes it for good. A game still recording or saving can't be deleted.
- **Home: the rank tile no longer writes over today's games** in a small window, in any language.
- **Mac: the overlay shows over League in Borderless.** Clips record the game's window there instead of the whole screen, and moving a panel no longer takes the focus away from the game.

## 0.3.1 - 2026-10-15

### New

- **Summoner spells go in with the runes.** When Invade puts your rune page in the client, the build's two summoner spells go in too. Flash stays on your key (D or F), junglers keep Smite, and a spell you change yourself is left alone for the rest of the champ select. Settings → Champ select turns it off. <!-- highlight --> <!-- image spells.webp -->
- **Images ship with the app.** Champions, items, runes, spells, abilities and rank emblems are packed in Invade, so they show at once, even offline; invade.lol only fills in what came out after the release.
- **What's new, after each update.** A small window tells you what changed the first time you open Invade after an update, and the (i) at the top right keeps every version. <!-- image whatsnew.webp -->

### Changed

- **Update from the sidebar, even during a game.** The update sits at the bottom left again, with its progress. It installs mid-game too: the game is not touched, the overlay is back a few seconds later, and a clip being recorded is kept.
- **Every player of your game is read from the loading screen on.** As soon as the client names the ten players, Invade reads each one's rank and champion mastery, then their recent games, and sends them to invade.lol as it reads them, during the game, so every profile you meet is complete there. The game you just played still goes first, the moment it ends. Settings → invade.lol says what is sent. <!-- highlight -->
- **One Invade at a time.** Opening Invade again brings the running window forward instead of starting a second copy.
- **The tray's Show / hide overlay is remembered** across launches.
- **Safer release builds:** each window may only do what it needs, a stricter content policy, and diagnostics that show `~` instead of your home folder.

### Fixed

- **Enemy ranks and profile links are back in game.** 0.3.0 took every player the client lists without a name for a hidden one; only a player the game itself hides stays anonymous now. <!-- highlight --> <!-- image ranks.webp -->
- **Windows: Invade closed itself about 3 seconds after launch** on a PC started less than 6 hours before.
- **Windows: Show in folder and Open in player** opened the wrong folder.
- **A damaged recording** no longer crashes or freezes the app, at launch or on the Recordings page.
- **The overlay no longer freezes** when the game's live data has an empty field.
- **Scouting** no longer takes a champion hovered for a ban for the ally's locked pick.
- **Your own rune page named "Invade…"** is never overwritten or deleted.
- And about 25 smaller fixes found by a new, much deeper test suite.

## 0.3.0 - 2026-10-14

### New

- **Discord, X and Report a bug** at the top right of the window: join the community, follow Invade, or tell us what broke, in one click.
- **Riot's legal notice** at the bottom of Settings.

### Changed

- **A real Invade score, and a harder one.** Each game is now measured against the Emerald pace of your role (CS, gold, kill participation, vision, KDA) as well as against your lobby, so your average reflects your level instead of sitting near 50. An average Emerald game is about 41, 80 is roughly one game in 25, 90 a few in a thousand, and 100 takes a game of the year. Scores below 80 spread wider, so a good game and a rough one no longer look alike. The app and invade.lol give the same score for the same game. <!-- image score.webp -->
- **80 and 90 glow gold** on the score dial.
- **AFK players are not scored** and no longer count when the rest of the lobby is rated.
- **No flash when you change a filter.** Home's queue, the profile's feed, Champions (rank and role), a champion's build and Matchups keep what they show until the new data has arrived, then swap in one go: no empty frame, no skeleton, no crest fading out and back, no dials redrawing. A slow answer dims the page slightly; a fast one shows nothing.
- **A champion's page changes role or rank in one go:** figures, build and matchups swap together, never one role on top and another below.
- **ARAM augments show their popularity only.** Riot's developer rules do not allow augment win rates, so their tier and performance are gone.
- **Brawl and League Classic games stay off invade.lol and out of your stats.** Riot has not approved Brawl data and asks that League Classic data not be shown, so these games are no longer uploaded, listed, counted or scored.
- **Players who hide their name are never identified.** In champ select and in game, a player the client marks as hidden (ranked lobbies, streamer mode's Hide My Name) is never looked up, shown or sent to invade.lol.

## 0.2.9 - 2026-10-12

### New

- **Counters overlay** in champ select: once your lane opponent is known, the three best picks into them. The same counter engine drives the Matchups page and the Live tab.
- **League closed, data still there:** match details, scores, *Played with* and any player you click open from invade.lol when the League client cannot answer.
- **Favorite games and clips.** Star a game or a clip; favorite clips are never removed by the storage limit.
- **Record all PC sound** (Settings → Recordings): Discord, music and other apps in your clips, with their own volume. Off by default.
- **Search players from invade.lol:** the search bar (⌘K) suggests players as you type, even with League closed.
- **Infinite match history:** older games load as you scroll.
- **Player detail in a match:** click a scoreboard row to see that player's build, score breakdown and lane matchup.
- **Copy diagnostics** and **Open logs folder** (Settings → Updates), to send us what went wrong when runes or overlays do not work.

### Improved

- **Home** is one calm screen of tiles that never scrolls: rank, a larger performance column (score, CS, KP, vision, KDA, gold per minute), match history with scores, clips, favorites and champions. <!-- image home.webp -->
- **Profile:** balanced at every window width; a calmer LP history chart; full rank emblems that never cover text.
- **Rune import:** the button really imports and shows the client's answer; runes follow every change of pick; your existing rune pages are kept whenever possible.
- **Champ select overlays** are on by default and appear within about a second.
- **League in a custom folder** is found from the running client.
- **Scoreboard gold (Tab)** sits down the middle of the scoreboard, on small plates.
- **invade.lol** receives every game the app reads (your games, matches you open, profiles you view), compressed and only when it does not have them yet.
- **Champions:** grouped by tier by default; the table head stays solid.
- **Window light:** one soft violet light, no tier tint across the page.
- **Overlays page:** shows an alert only when something needs fixing.
- Matches and profiles are drawn by the same components as invade.lol.

### Fixed

- Runes imported only for the first champion, or for a champion being banned.
- Clicking *Use this setup & import runes* said "Runes imported" without importing.
- Match details and other players' profiles were empty with League closed.
- Games that ended while Invade was closed never reached invade.lol.
- Sorting the Champions table by a column turned *Group by tier* off for good.
- Clip cards grew on hover and clips were squashed on small windows.
- The recording dot was stretched.

### Removed

- The **Win & gold** overlay.
- The "League is closed" notes on Home, the profile and the sidebar.
