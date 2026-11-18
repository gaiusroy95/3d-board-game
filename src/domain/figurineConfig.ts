/**
 * Figurine costs/conditions from client `dev-brief/figurine/*.txt`.
 */

export interface FigurineSlotConfig {
  readonly slotIndex: number; // 0..6
  readonly learnCost: number;
  readonly activateCost: number;
  readonly unlockSummary: string;
  readonly rewardSummary: string;
  readonly skillSummaries: readonly [string, string];
}

/** Activation cost when using a skill (Rules.txt). */
export const FIGURINE_ACTIVATE_COST: Record<number, number> = {
  0: 500,
  1: 500,
  2: 1000,
  3: 1000,
  4: 1500,
  5: 1500,
  6: 2000,
};

export const FIGURINE_CONFIG: readonly FigurineSlotConfig[] = [
  {
    slotIndex: 0,
    learnCost: 4000,
    activateCost: 500,
    unlockSummary: "Borrow ≥10000 OR reactivate special card",
    rewardSummary: "Chosen build value ×4 (built×3 + unblock)",
    skillSummaries: [
      "Block resource for 2 rounds",
      "Choose built ×2 (built×1 + unblock)",
    ],
  },
  {
    slotIndex: 1,
    learnCost: 4000,
    activateCost: 500,
    unlockSummary: "Minimum 3 lives made",
    rewardSummary: "Destroy build → +5 points; skill uses raise card limit",
    skillSummaries: [
      "Raise special-card play limit (5 / 6 / 7)",
      "Second skill TBD from client wording",
    ],
  },
  {
    slotIndex: 2,
    learnCost: 6000,
    activateCost: 1000,
    unlockSummary: "≥1 borrow offered to someone",
    rewardSummary: "Use skill 3 times",
    skillSummaries: [
      "Force them give you a skill (max 2 swaps)",
      "Let them use your skill for escalating fees",
    ],
  },
  {
    slotIndex: 3,
    learnCost: 6000,
    activateCost: 1000,
    unlockSummary: "General 3 + borrow offered accepted",
    rewardSummary: "7000 cash OR cover one build cost <10000",
    skillSummaries: [
      "Construct on their board; return 20/30/40% per round (3/5/7)",
      "Force them take borrow only from you",
    ],
  },
  {
    slotIndex: 4,
    learnCost: 10000,
    activateCost: 1500,
    unlockSummary: "6 lives OR Deck3 special card",
    rewardSummary: "Reward changer / reactivate reward",
    skillSummaries: [
      "Change reward for your figurines 1–4",
      "Activate chosen 1–4 reward on another player's figurine",
    ],
  },
  {
    slotIndex: 5,
    learnCost: 10000,
    activateCost: 1500,
    unlockSummary: "2 knockouts in one round OR Deck3 activation card",
    rewardSummary: "Reactivate 1 skill if not learned",
    skillSummaries: [
      "Switch unlearned skill on one of your figurines",
      "Switch unlearned skill on all players with that figurine",
    ],
  },
  {
    slotIndex: 6,
    learnCost: 10000,
    activateCost: 2000,
    unlockSummary: "6 lives + all figurines + 6 skills (dense wording)",
    rewardSummary: "+1 life",
    skillSummaries: [
      "Gain 10 points",
      "Force return 50% of cash borrowed",
    ],
  },
];

export function getFigurineConfig(slotIndex: number): FigurineSlotConfig {
  const cfg = FIGURINE_CONFIG.find((c) => c.slotIndex === slotIndex);
  if (!cfg) throw new Error(`Invalid figurine slot ${slotIndex}`);
  return cfg;
}
