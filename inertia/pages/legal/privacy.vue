<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3'
import LegalLayout from '../../components/LegalLayout.vue'
import { DISCORD_URL, SYNC_CONTRACT_URL } from '../../lib/links.js'
import type { LegalPublisher } from '../../lib/legal.js'

/** `/privacy`: what invade.lol and the desktop app process, why, who gets it, and for how long. */
defineProps<{ publisher: LegalPublisher }>()
</script>

<template>
  <Head title="Privacy policy" />

  <LegalLayout title="Privacy policy" :updated="publisher.updated">
    <p>
      invade.lol and the Invade desktop app are run by
      <template v-if="publisher.name">{{ publisher.name }}</template>
      <template v-else>the publisher named in the <Link href="/legal">legal notice</Link></template
      ><template v-if="publisher.address">, {{ publisher.address }}</template
      ><template v-if="publisher.email">
        (<a :href="`mailto:${publisher.email}`">{{ publisher.email }}</a
        >)</template
      >. We are the data controller under the GDPR.
    </p>

    <h2>What we process</h2>
    <p>
      <strong>League of Legends data from Riot Games.</strong> When someone looks up a player on
      invade.lol, we fetch public data from Riot Games’ API: Riot ID, PUUID, region, level, profile
      icon, ranks, champion mastery, match history and match timelines. We store it to show profiles
      and match pages.
    </p>
    <p><strong>What the desktop app sends, if you use it.</strong></p>
    <p>
      It sends the games you play, and nothing the League client shows about other players: that
      stays on your computer. Versions before 0.3.7 also sent the recent games of the other players
      of your games, and the rank, level and mastery of the players the client showed you;
      invade.lol stopped taking those on 2 November 2026. What they sent before then stays on the
      profiles it updated, unless you ask us to remove it (below). The app sends:
    </p>
    <ul>
      <li>
        Each game you finish, as it ends (since version 0.3.9): the League client’s data for the
        game and its timeline, reduced to the Riot IDs, PUUIDs and icons of the ten players, numeric
        statistics, and kills, objectives, buildings, items, skills and wards. It adds each player’s
        position as the app estimates it, and your LP change when it is certain.
      </li>
      <li>The Riot accounts signed in on your computer, once each, so their games reach their profiles.</li>
      <li>
        Your device, with its first game or crash report: a random device token and its signing
        secret, the app version and operating system, and a keyed hash of your IP address used
        against abuse. We never store the address itself.
      </li>
      <li>
        The Riot IDs it looks up on invade.lol (one you type, a player you keep in the app, the
        Update button), to find their profile.
      </li>
      <li>
        The champion, role, rank bracket and patch of the statistics it asks for, which name no
        player.
      </li>
    </ul>
    <p>
      <strong>Anonymous usage statistics.</strong> The app sends one event when it starts and one
      when it updates to Aptabase, on servers in the EU. These events carry no identifier that links
      them to you. Switch them off in Settings, Data.
    </p>
    <p>
      <strong>Anonymous crash reports.</strong> When the app crashes, it sends us the app version,
      your operating system and its version, which part crashed, and the first line of the error
      with its place in the code, with user names, Riot IDs and identifiers removed. They are kept
      90 days and never linked to your device or accounts. Switch them off in Settings, Data.
    </p>
    <p>
      <strong>Website visits.</strong> We count page views, downloads and clicks on outside links
      with OpenPanel, which we run on our own server. It sets no cookies and doesn’t keep your IP
      address. The app’s device registrations and uploaded games are counted there too, under the
      device’s random id. Our servers keep technical logs (IP address, browser, page) for 14 days for
      security. invade.lol sets no cookies.
    </p>
    <p>
      <strong>What never leaves your computer.</strong> The app’s database (your accounts, games,
      favorites and settings) and your recordings and clips.
    </p>

    <h2>Why, and on what legal basis</h2>
    <ul>
      <li>
        Showing League profiles and match statistics, and keeping them current through the app: our
        legitimate interest in running a statistics service for League of Legends players, with data
        Riot Games makes available for such services (GDPR article 6(1)(f)).
      </li>
      <li>
        Syncing your own games when you use the app: the service you asked for (article 6(1)(b)).
      </li>
      <li>
        Security, signed requests and rate limits: our legitimate interest in protecting the
        service.
      </li>
      <li>
        Anonymous usage statistics: our legitimate interest in knowing how many people use the app.
        You can opt out.
      </li>
    </ul>

    <h2>Who receives it</h2>
    <ul>
      <li>Anyone visiting invade.lol sees public profiles and match pages.</li>
      <li>
        Our service providers: {{ publisher.hostCompany ?? 'our hosting provider' }} for the
        servers, Cloudflare (R2 storage), Aptabase (usage statistics, EU) and GitHub (app downloads
        and updates).
      </li>
      <li>We do not sell data and we show no ads.</li>
    </ul>

    <h2>How long we keep it</h2>
    <ul>
      <li>
        Profiles and matches: while the profile is shown on invade.lol, or until you ask us to
        remove it.
      </li>
      <li>Device records: until the device has been inactive for 12 months.</li>
      <li>Server logs: 14 days.</li>
    </ul>

    <h2>Your rights</h2>
    <p>
      You can ask to access, correct or erase your data, to restrict its use, to object to it,
      including to your profile being shown, and to receive it in a portable format. Write to
      <a v-if="publisher.email" :href="`mailto:${publisher.email}`">{{ publisher.email }}</a>
      <template v-else
        >us on our <a :href="DISCORD_URL" target="_blank" rel="noreferrer">Discord</a></template
      >
      with your Riot ID. We answer within one month. You can also complain to the CNIL (<a
        href="https://www.cnil.fr"
        target="_blank"
        rel="noreferrer"
        >cnil.fr</a
      >).
    </p>

    <h2>If you don’t use Invade</h2>
    <p>
      Your profile can appear on invade.lol because someone looked you up or played a game with an
      Invade user. To have it removed, write to
      <a v-if="publisher.email" :href="`mailto:${publisher.email}`">{{ publisher.email }}</a>
      <template v-else
        >us on our <a :href="DISCORD_URL" target="_blank" rel="noreferrer">Discord</a></template
      >
      with your Riot ID. We will ask you to prove the account is yours (for example by setting a
      short code we give you as your League client status) before removing it.
    </p>

    <h2>What the app sends, field by field</h2>
    <p>
      The exact contract between the app and invade.lol is public:
      <a :href="SYNC_CONTRACT_URL" target="_blank" rel="noreferrer">docs/desktop-sync.md</a> in the
      site’s source on GitHub.
    </p>

    <h2>Changes</h2>
    <p>
      We change the date at the top when this policy changes, and announce important changes on our
      <a :href="DISCORD_URL" target="_blank" rel="noreferrer">Discord</a>.
    </p>

    <p class="fine">
      Invade isn’t endorsed by Riot Games and doesn’t reflect the views or opinions of Riot Games or
      anyone officially involved in producing or managing Riot Games properties. Riot Games and all
      associated properties are trademarks or registered trademarks of Riot Games, Inc.
    </p>
  </LegalLayout>
</template>
