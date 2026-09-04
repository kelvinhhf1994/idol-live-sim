import type { IdolMember } from "../scene/createChibiIdol";

/** Stage capacity of the idol line-up; the HUD lets the player show 1..MAX. */
export const MAX_IDOL_COUNT = 7;

/**
 * Seven-member line-up in one black-and-silver stage costume. Members read
 * apart through hair, headpiece and member colour rather than through outfit.
 */
export const IDOL_MEMBERS: readonly IdolMember[] = [
  {
    hair: "long",
    hairColor: 0x171320,
    accent: 0xc9d2e0,
    headpiece: "none",
    expression: "open",
    eye: 0x8b5cf6,
    socks: "knee",
    sleeves: "crop",
  },
  {
    hair: "twin",
    hairColor: 0x4a2c22,
    accent: 0xff5c9d,
    headpiece: "ribbon",
    expression: "open",
    eye: 0xc8862f,
    socks: "thigh",
    sleeves: "jacket",
  },
  {
    hair: "bob",
    hairColor: 0xb08858,
    accent: 0x9b6cf6,
    headpiece: "bow",
    expression: "open",
    eye: 0x2f8f7a,
    socks: "knee",
    sleeves: "crop",
  },
  {
    hair: "sideTail",
    hairColor: 0xc0788a,
    streakColor: 0xf0d8de,
    accent: 0x3f8cff,
    headpiece: "catEars",
    expression: "open",
    eye: 0x3f8cff,
    socks: "thigh",
    sleeves: "jacket",
  },
  {
    hair: "halfUp",
    hairColor: 0xd8d6e2,
    accent: 0x8ce03f,
    headpiece: "ribbon",
    expression: "open",
    eye: 0x2f7fd9,
    socks: "knee",
    sleeves: "crop",
  },
  {
    hair: "long",
    hairColor: 0xd2384f,
    streakColor: 0xf3ece8,
    accent: 0xff3b52,
    headpiece: "catEars",
    expression: "closed",
    eye: 0xd94f6a,
    socks: "thigh",
    sleeves: "crop",
  },
  {
    hair: "hime",
    hairColor: 0x1b1622,
    accent: 0xe7b23a,
    headpiece: "bow",
    expression: "closed",
    eye: 0xc8862f,
    socks: "knee",
    sleeves: "jacket",
  },
];
