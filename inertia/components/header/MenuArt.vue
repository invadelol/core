<script setup lang="ts">
import { siteNav, type MenuArtName } from '../../lib/site_nav.js'

/**
 * The pictures of the header's menus: small compositions of League art (champion portraits, items,
 * runes, rank emblems, pro photos, league and team logos, all from /cdn) with Invade's own pieces
 * (tier tiles, LP chips, the live chip, the score dial, the glyph). Each is drawn on a 144 px
 * stage, as the design made them, and scaled to `size`. The one piece /cdn has no art for (the
 * Mayhem augment of ARAM) is a small file in public/menu-art. Team logos are drawn once the menus'
 * data has named the teams' ids.
 */
withDefaults(defineProps<{ name: MenuArtName; size?: number }>(), { size: 56 })

/** A logo the server cannot serve leaves its badge empty rather than show a placeholder. */
const gone = (event: Event) => ((event.target as HTMLImageElement).style.visibility = 'hidden')

const team = (slug: string) => {
  const id = siteNav.value?.art?.teams?.[slug]
  return id ? `/cdn/team/${id}?s=64` : null
}
</script>

<!-- Generated from the design's compositions (gen/menu_art): keep the numbers as they are. -->
<template>
  <span class="ma" :style="{ '--ma': size }" aria-hidden="true">
    <span class="ma-st">
      <template v-if="name === 'champions'"
        ><div
          class="ma-blk ma-s"
          style="left: 6px; top: 92px; width: 42px; height: 44px; font-size: 18px; padding-top: 9px"
        >
          S
        </div>
        <div
          class="ma-rp"
          style="
            left: 8px;
            top: 58px;
            width: 38px;
            height: 38px;
            --ring: #14121d;
            background-image: url(/cdn/champion/157.png);
            background-position: 50% 40%;
          "
        ></div>
        <div
          class="ma-blk ma-sp"
          style="
            left: 51px;
            top: 74px;
            width: 42px;
            height: 62px;
            font-size: 17px;
            padding-top: 9px;
          "
        >
          S+
        </div>
        <div
          class="ma-rp"
          style="
            left: 51px;
            top: 36px;
            width: 42px;
            height: 42px;
            --ring: #14121d;
            background-image: url(/cdn/champion/99.png);
            background-position: 50% 40%;
          "
        ></div>
        <div
          class="ma-blk ma-a"
          style="
            left: 96px;
            top: 106px;
            width: 42px;
            height: 30px;
            font-size: 18px;
            padding-top: 7px;
          "
        >
          A
        </div>
        <div
          class="ma-rp"
          style="
            left: 99px;
            top: 74px;
            width: 36px;
            height: 36px;
            --ring: #14121d;
            background-image: url(/cdn/champion/81.png);
            background-position: 50% 40%;
          "
        ></div
      ></template>
      <template v-else-if="name === 'items'"
        ><div
          class="ma-it"
          style="
            left: 2px;
            top: 30px;
            width: 60px;
            height: 60px;
            transform: rotate(-16deg);
            background-image: url(/cdn/item/3031.png);
          "
        ></div>
        <div
          class="ma-it"
          style="
            left: 82px;
            top: 30px;
            width: 60px;
            height: 60px;
            transform: rotate(16deg);
            background-image: url(/cdn/item/3084.png);
          "
        ></div>
        <div
          class="ma-it"
          style="
            left: 33px;
            top: 14px;
            width: 78px;
            height: 78px;
            background-image: url(/cdn/item/3089.png);
          "
        ></div>
        <div
          class="ma-tt ma-s"
          style="left: 86px; top: 88px; width: 44px; height: 44px; transform: rotate(8deg)"
        >
          <b style="font-size: 28px">S</b>
        </div></template
      >
      <template v-else-if="name === 'runes'"
        ><div
          class="ma-bd"
          style="
            left: 4px;
            top: 4px;
            width: 104px;
            height: 104px;
            background: radial-gradient(circle at 50% 42%, #2a2752, #100e1a 70%);
            box-shadow:
              inset 0 0 0 2.5px #8d9bff,
              inset 0 0 0 5px rgba(10, 9, 16, 0.9),
              inset 0 1.5px 0 rgba(255, 255, 255, 0.3),
              0 3.5px 0 #2c2670,
              0 14px 18px -6px rgba(2, 1, 8, 0.85);
          "
        >
          <img :src="'/cdn/perk/8229.png'" style="width: 100px; height: 100px" alt="" />
        </div>
        <div class="ma-bd" style="left: 101px; top: 45px; width: 38px; height: 38px">
          <img :src="'/cdn/perk/5001.png'" style="width: 25px; height: 25px" alt="" />
        </div>
        <div class="ma-bd" style="left: 85px; top: 77px; width: 38px; height: 38px">
          <img :src="'/cdn/perk/5005.png'" style="width: 25px; height: 25px" alt="" />
        </div>
        <div class="ma-bd" style="left: 53px; top: 99px; width: 38px; height: 38px">
          <img :src="'/cdn/perk/5008.png'" style="width: 25px; height: 25px" alt="" /></div
      ></template>
      <template v-else-if="name === 'duos'"
        ><div
          class="ma-pc"
          style="
            left: 10px;
            top: 10px;
            width: 74px;
            height: 74px;
            transform: rotate(-10deg);
            background-image: url(/cdn/champion/498.png);
            background-position: 50% 40%;
            background-size: 118%;
          "
        ></div>
        <div
          class="ma-pc"
          style="
            left: 56px;
            top: 46px;
            width: 80px;
            height: 80px;
            transform: rotate(6deg);
            background-image: url(/cdn/champion/497.png);
            background-position: 50% 35%;
            background-size: 118%;
          "
        ></div>
        <div
          class="ma-key"
          style="
            left: 30px;
            top: 92px;
            width: 36px;
            height: 36px;
            transform: rotate(-6deg);
            border-radius: 50%;
          "
        >
          <svg
            viewBox="0 0 20 20"
            style="width: 20px; height: 20px"
            fill="none"
            stroke="#fff"
            stroke-width="2.3"
            stroke-linecap="round"
          >
            <path d="M8.6 11.4 11.4 8.6" />
            <path d="M9.2 6.4 10.8 4.8a3 3 0 0 1 4.4 4.4L13.6 10.8" />
            <path d="M10.8 13.6 9.2 15.2a3 3 0 0 1-4.4-4.4L6.4 9.2" />
          </svg></div
      ></template>
      <template v-else-if="name === 'aram'"
        ><div
          class="ma-pc"
          style="
            left: 12px;
            top: 10px;
            width: 86px;
            height: 86px;
            transform: rotate(-8deg);
            background-image: url(/cdn/champion/99.png);
            background-position: 50% 40%;
            background-size: 118%;
          "
        ></div>
        <div
          class="ma-sh"
          style="left: 72px; top: 62px; width: 64px; height: 70.4px; transform: rotate(6deg)"
        >
          <svg
            viewBox="0 0 100 110"
            style="position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible"
          >
            <defs>
              <linearGradient id="ma-aram-pr" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="#ffd1f4" />
                <stop offset=".35" stop-color="#b7a6ff" />
                <stop offset=".68" stop-color="#8fe3ff" />
                <stop offset="1" stop-color="#ffe7a8" />
              </linearGradient>
              <linearGradient id="ma-aram-fc" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#2b2742" />
                <stop offset="1" stop-color="#121019" />
              </linearGradient>
            </defs>
            <path
              d="M50 4 93 28.5V81.5L50 106 7 81.5V28.5Z"
              fill="url(#ma-aram-pr)"
              stroke="url(#ma-aram-pr)"
              stroke-width="6"
              stroke-linejoin="round"
            />
            <path
              d="M50 13 85 33V77L50 97 15 77V33Z"
              fill="url(#ma-aram-fc)"
              stroke="#121019"
              stroke-width="1"
              stroke-linejoin="round"
            /></svg
          ><img
            :src="'/menu-art/poroking.webp'"
            style="position: absolute; left: 4%; top: 9%; width: 92%; height: auto"
            alt=""
          /></div
      ></template>
      <template v-else-if="name === 'overview'"
        ><div
          style="
            left: 14px;
            top: 4px;
            width: 104px;
            height: 104px;
            filter: drop-shadow(0 3px 0 #2c2670) drop-shadow(0 10px 10px rgba(2, 1, 8, 0.6));
          "
        >
          <div
            style="
              width: 100%;
              height: 100%;
              background: linear-gradient(170deg, #ffffff 20%, #c9c2ff 70%, #9b8fff);
              -webkit-mask: url(/cdn/league/worlds) center/contain no-repeat;
            "
          ></div>
        </div>
        <div class="ma-lv" style="left: 58px; top: 106px; transform: rotate(-4deg)">
          LIVE
        </div></template
      >
      <template v-else-if="name === 'pros'"
        ><div style="left: 18px; top: 24px; width: 84px; height: 90px; transform: rotate(-7deg)">
          <div
            class="ma-pc ma-ab"
            style="
              inset: 0;
              background: radial-gradient(circle at 80% 0%, #8b7fff, #4a3fc2 45%, #1b1842 100%);
            "
          ></div>
          <div class="ma-ab" style="inset: 0; clip-path: inset(-40% 0 0 0 round 0 0 16px 16px)">
            <img
              class="ma-ab"
              :src="'/cdn/pro/caps'"
              style="
                left: 50%;
                bottom: 0;
                width: 136%;
                transform: translateX(-50%);
                filter: drop-shadow(0 0 1px rgba(2, 1, 8, 0.4));
              "
              alt=""
            />
          </div>
        </div>
        <div class="ma-bd" style="left: 80px; top: 82px; width: 52px; height: 52px">
          <img
            v-if="team('g2-esports')"
            :src="team('g2-esports')"
            data-fallback="applied"
            @error="gone"
            style="width: 34px; height: 34px"
            alt=""
          /></div
      ></template>
      <template v-else-if="name === 'leagues'"
        ><div
          class="ma-sl"
          style="
            left: 45px;
            top: 34px;
            width: 54px;
            height: 66px;
            transform-origin: 50% 230%;
            transform: rotate(-21deg);
            z-index: 1;
          "
        >
          <img
            class="ma-ab"
            :src="'/cdn/league/lck'"
            style="
              left: 50%;
              top: 10px;
              width: 34px;
              height: 34px;
              transform: translateX(-50%);
              object-fit: contain;
            "
            alt=""
          />
        </div>
        <div
          class="ma-sl"
          style="
            left: 45px;
            top: 34px;
            width: 54px;
            height: 66px;
            transform-origin: 50% 230%;
            transform: rotate(21deg);
            z-index: 1;
          "
        >
          <img
            class="ma-ab"
            :src="'/cdn/league/lpl'"
            style="
              left: 50%;
              top: 10px;
              width: 34px;
              height: 34px;
              transform: translateX(-50%);
              object-fit: contain;
            "
            alt=""
          />
        </div>
        <div
          class="ma-sl"
          style="
            left: 45px;
            top: 34px;
            width: 54px;
            height: 66px;
            transform-origin: 50% 230%;
            transform: rotate(0deg);
            z-index: 2;
          "
        >
          <img
            class="ma-ab"
            :src="'/cdn/league/lec'"
            style="
              left: 50%;
              top: 10px;
              width: 38px;
              height: 38px;
              transform: translateX(-50%);
              object-fit: contain;
            "
            alt=""
          /></div
      ></template>
      <template v-else-if="name === 'teams'"
        ><div class="ma-bd" style="left: 6px; top: 12px; width: 60px; height: 60px">
          <img
            v-if="team('karmine-corp-blue')"
            :src="team('karmine-corp-blue')"
            data-fallback="applied"
            @error="gone"
            style="width: 38px; height: 38px; object-fit: contain"
            alt=""
          />
        </div>
        <div class="ma-bd" style="left: 78px; top: 12px; width: 60px; height: 60px">
          <img
            v-if="team('g2-esports')"
            :src="team('g2-esports')"
            data-fallback="applied"
            @error="gone"
            style="width: 40px; height: 40px; object-fit: contain"
            alt=""
          />
        </div>
        <div class="ma-bd" style="left: 34px; top: 52px; width: 76px; height: 76px">
          <img
            v-if="team('fnatic')"
            :src="team('fnatic')"
            data-fallback="applied"
            @error="gone"
            style="width: 48px; height: 48px; object-fit: contain"
            alt=""
          /></div
      ></template>
      <template v-else-if="name === 'solo'"
        ><div
          class="ma-pl"
          style="
            left: 28px;
            top: 82px;
            width: 88px;
            height: 52px;
            border-radius: 12px;
            font-size: 30px;
            padding-top: 6px;
            line-height: 1;
            z-index: 1;
          "
        >
          <span style="display: block; margin-right: 2px">#1</span>
        </div>
        <div
          class="ma-em"
          style="
            left: 10px;
            top: -18px;
            width: 124px;
            height: 124px;
            z-index: 2;
            background: url(/cdn/emblem/challenger.png) -164.23px -57.49px/451.41px auto no-repeat;
          "
        ></div
      ></template>
      <template v-else-if="name === 'flex'"
        ><div
          style="
            left: -1px;
            top: -12px;
            width: 142px;
            height: 142px;
            background: url(/cdn/emblem/grandmaster.png) -166.3px -63.93px/473.49px auto no-repeat;
            filter: drop-shadow(0 8px 10px rgba(2, 1, 8, 0.6));
          "
        ></div>
        <div
          class="ma-rp"
          style="
            left: 42px;
            top: 94px;
            width: 42px;
            height: 42px;
            --ring: #14121d;
            background-image: url(/cdn/champion/64.png);
          "
        ></div>
        <div
          class="ma-rp"
          style="
            left: 70px;
            top: 94px;
            width: 42px;
            height: 42px;
            --ring: #14121d;
            background-image: url(/cdn/champion/412.png);
          "
        ></div>
        <div
          class="ma-rp"
          style="
            left: 98px;
            top: 94px;
            width: 42px;
            height: 42px;
            --ring: #14121d;
            background-image: url(/cdn/champion/222.png);
          "
        ></div
      ></template>
      <template v-else-if="name === 'otp'"
        ><div
          class="ma-pc"
          style="
            left: 14px;
            top: 8px;
            width: 72px;
            height: 72px;
            transform: rotate(-10deg);
            background-image: url(/cdn/champion/92.png);
            background-position: 45% 40%;
            background-size: 118%;
          "
        ></div>
        <div
          class="ma-pc"
          style="
            left: 54px;
            top: 42px;
            width: 82px;
            height: 82px;
            transform: rotate(6deg);
            background-image: url(/cdn/champion/157.png);
            background-position: 50% 40%;
            background-size: 118%;
          "
        ></div>
        <img
          :src="'/cdn/mastery/10.png'"
          style="
            left: -6px;
            top: 72px;
            width: 72px;
            height: 72px;
            filter: drop-shadow(0 6px 8px rgba(2, 1, 8, 0.7));
          "
          alt=""
      /></template>
      <template v-else-if="name === 'proladder'"
        ><div style="left: 36px; top: 24px; width: 84px; height: 90px; transform: rotate(6deg)">
          <div
            class="ma-pc ma-ab"
            style="
              inset: 0;
              background: radial-gradient(circle at 80% 0%, #8b7fff, #4a3fc2 45%, #1b1842 100%);
            "
          ></div>
          <div class="ma-ab" style="inset: 0; clip-path: inset(-40% 0 0 0 round 0 0 16px 16px)">
            <img
              class="ma-ab"
              :src="'/cdn/pro/upset'"
              style="
                left: 50%;
                bottom: 0;
                width: 136%;
                transform: translateX(-50%);
                filter: drop-shadow(0 0 1px rgba(2, 1, 8, 0.4));
              "
              alt=""
            />
          </div>
        </div>
        <div
          style="
            left: -6px;
            top: 64px;
            width: 82px;
            height: 82px;
            background: url(/cdn/emblem/challenger.png) -108.6px -38.02px/298.51px auto no-repeat;
            filter: drop-shadow(0 8px 10px rgba(2, 1, 8, 0.6));
          "
        ></div
      ></template>
      <template v-else-if="name === 'live'"
        ><div
          class="ma-rp"
          style="
            left: 6px;
            top: 22px;
            width: 70px;
            height: 70px;
            --ring: #6c9bff;
            background-image: url(/cdn/champion/103.png);
          "
        ></div>
        <div
          class="ma-rp"
          style="
            left: 68px;
            top: 22px;
            width: 70px;
            height: 70px;
            --ring: #f06a82;
            background-image: url(/cdn/champion/517.png);
          "
        ></div>
        <div class="ma-lv" style="left: 42px; top: 98px">LIVE</div></template
      >
      <template v-else-if="name === 'multi'"
        ><div
          class="ma-sl"
          style="left: 16px; top: 8px; width: 72px; height: 124px; transform: rotate(-6deg)"
        >
          <div
            class="ma-rp ma-ab"
            style="
              left: 9px;
              top: 9px;
              width: 19px;
              height: 19px;
              box-shadow: inset 0 0 0 1px rgba(226, 221, 255, 0.22);
              background-image: url(/cdn/champion/164.png);
            "
          ></div>
          <div
            class="ma-ab"
            style="
              left: 34px;
              top: 16px;
              width: 24px;
              height: 5px;
              border-radius: 3px;
              background: rgba(194, 186, 255, 0.34);
            "
          ></div>
          <div
            class="ma-rp ma-ab"
            style="
              left: 9px;
              top: 30px;
              width: 19px;
              height: 19px;
              box-shadow: inset 0 0 0 1px rgba(226, 221, 255, 0.22);
              background-image: url(/cdn/champion/64.png);
            "
          ></div>
          <div
            class="ma-ab"
            style="
              left: 34px;
              top: 37px;
              width: 17px;
              height: 5px;
              border-radius: 3px;
              background: rgba(194, 186, 255, 0.22);
            "
          ></div>
          <div
            class="ma-rp ma-ab"
            style="
              left: 9px;
              top: 51px;
              width: 19px;
              height: 19px;
              box-shadow: inset 0 0 0 1px rgba(226, 221, 255, 0.22);
              background-image: url(/cdn/champion/103.png);
            "
          ></div>
          <div
            class="ma-ab"
            style="
              left: 34px;
              top: 58px;
              width: 27px;
              height: 5px;
              border-radius: 3px;
              background: rgba(194, 186, 255, 0.22);
            "
          ></div>
          <div
            class="ma-rp ma-ab"
            style="
              left: 9px;
              top: 72px;
              width: 19px;
              height: 19px;
              box-shadow: inset 0 0 0 1px rgba(226, 221, 255, 0.22);
              background-image: url(/cdn/champion/222.png);
            "
          ></div>
          <div
            class="ma-ab"
            style="
              left: 34px;
              top: 79px;
              width: 20px;
              height: 5px;
              border-radius: 3px;
              background: rgba(194, 186, 255, 0.22);
            "
          ></div>
          <div
            class="ma-rp ma-ab"
            style="
              left: 9px;
              top: 93px;
              width: 19px;
              height: 19px;
              box-shadow: inset 0 0 0 1px rgba(226, 221, 255, 0.22);
              background-image: url(/cdn/champion/412.png);
            "
          ></div>
          <div
            class="ma-ab"
            style="
              left: 34px;
              top: 100px;
              width: 22px;
              height: 5px;
              border-radius: 3px;
              background: rgba(194, 186, 255, 0.22);
            "
          ></div>
        </div>
        <div
          class="ma-key"
          style="left: 80px; top: 76px; width: 52px; height: 52px; transform: rotate(6deg)"
        >
          <svg
            viewBox="0 0 20 20"
            style="width: 30px; height: 30px"
            fill="none"
            stroke="#fff"
            stroke-width="2.4"
            stroke-linejoin="miter"
            stroke-linecap="butt"
          >
            <path
              d="M8.6 3.2 13.6 5.4 15.8 10.4 13.6 15.4 8.6 17.6 3.6 15.4 1.4 10.4 3.6 5.4Z"
              transform="translate(.6 -1.2) scale(.82)"
            />
            <path d="M13.2 13.2 18 18" />
          </svg></div
      ></template>
      <template v-else-if="name === 'stats'"
        ><div
          class="ma-ab"
          style="
            left: 14px;
            top: 92px;
            width: 36px;
            height: 44px;
            border-radius: 9px 9px 5px 5px;
            background: linear-gradient(180deg, #3a3391, #2c2670);
            box-shadow:
              inset 0 1.5px 0 rgba(255, 255, 255, 0.35),
              0 4px 0 #1b1842,
              0 14px 16px -6px rgba(2, 1, 8, 0.85);
          "
        ></div>
        <div
          class="ma-ab"
          style="
            left: 54px;
            top: 70px;
            width: 36px;
            height: 66px;
            border-radius: 9px 9px 5px 5px;
            background: linear-gradient(180deg, #7c6ff7, #5c4fe0);
            box-shadow:
              inset 0 1.5px 0 rgba(255, 255, 255, 0.35),
              0 4px 0 #3a3191,
              0 14px 16px -6px rgba(2, 1, 8, 0.85);
          "
        ></div>
        <div
          class="ma-ab"
          style="
            left: 94px;
            top: 44px;
            width: 36px;
            height: 92px;
            border-radius: 9px 9px 5px 5px;
            background: linear-gradient(180deg, #b3aaff, #8b7fff);
            box-shadow:
              inset 0 1.5px 0 rgba(255, 255, 255, 0.35),
              0 4px 0 #5246cf,
              0 14px 16px -6px rgba(2, 1, 8, 0.85);
          "
        ></div>
        <div
          class="ma-rp"
          style="
            left: 88px;
            top: 2px;
            width: 48px;
            height: 48px;
            --ring: #14121d;
            background-image: url(/cdn/champion/51.png);
            background-position: 50% 40%;
          "
        ></div
      ></template>
      <template v-else-if="name === 'app'"
        ><div class="ma-sl" style="left: 8px; top: 12px; width: 108px; height: 84px">
          <div
            class="ma-ab"
            style="
              left: 0;
              right: 0;
              top: 0;
              height: 18px;
              display: flex;
              align-items: center;
              gap: 4px;
              padding: 0 9px;
              background: #0d0c14;
              box-shadow: inset 0 -1px 0 rgba(194, 186, 255, 0.1);
            "
          >
            <span style="width: 6px; height: 6px; border-radius: 50%; background: #4a4660"></span
            ><span style="width: 6px; height: 6px; border-radius: 50%; background: #4a4660"></span
            ><span style="width: 6px; height: 6px; border-radius: 50%; background: #4a4660"></span>
          </div>
        </div>
        <div class="ma-ab ma-drop" style="left: 54px; top: 34px">
          <svg viewBox="54 22 155 170" style="width: 83.88px; height: 92px; fill: #8b7fff">
            <path
              d="M140.32,114.78l66.57-52.4-84.5,29.38,18.32-28.35-30.09,17.83,39.13-56.71-79.86,45.07-7.92,13.62.91,24.19,31.05,8.35,9.9,22.32,25.04,9.9-8.54,18.83-36.29.19v8.54l67.35,14.75-21.54-28.53,71.03-44.25-60.55-2.72ZM73.47,105.37l14.19-27.76,4.98,27.76h-19.17Z"
            />
            <polygon points="55.54 130.51 73.97 130.39 85.04 143.21 66.99 144.45 55.54 130.51" />
          </svg></div
      ></template>
    </span>
  </span>
</template>
