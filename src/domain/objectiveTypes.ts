import type { PlayerId } from "./board";

export const MAX_RACE_OBJECTIVE_SELECTIONS = 4;

export type RaceObjectiveId =
  | "race-3-figurines"
  | "race-10-builds"
  | "race-10-skills"
  | "race-20-specials"
  | "race-7-lives"
  | "race-whisky-l3-x10"
  | "race-vodka-l4-x10-whisky-l4-x5";

export type AnytimeObjectiveId =
  | "money-skills-15k"
  | "money-borrow-15k"
  | "money-skills-30k"
  | "money-borrow-30k"
  | "money-skills-45k"
  | "money-borrow-45k"
  | "survive-5-lives-until-first-ko"
  | "survive-until-2-ko";

export type ObjectiveId = RaceObjectiveId | AnytimeObjectiveId;

export interface ObjectiveDef {
  readonly id: ObjectiveId;
  readonly kind: "race" | "anytime";
  readonly title: string;
  readonly description: string;
  readonly points: 5;
}

export interface PlayerObjectiveStats {
  readonly buildsPlaced: number;
  readonly skillsLearned: number;
  readonly specialCardsPlayed: number;
  readonly whiskyL3Payouts: number;
  readonly vodkaL4Payouts: number;
  readonly whiskyL4Payouts: number;
  readonly moneyFromSkills: number;
  readonly moneyFromBorrows: number;
  readonly livesAtFirstKnockout: number | null;
  readonly survivedSecondKnockout: boolean;
}

export function emptyObjectiveStats(): PlayerObjectiveStats {
  return {
    buildsPlaced: 0,
    skillsLearned: 0,
    specialCardsPlayed: 0,
    whiskyL3Payouts: 0,
    vodkaL4Payouts: 0,
    whiskyL4Payouts: 0,
    moneyFromSkills: 0,
    moneyFromBorrows: 0,
    livesAtFirstKnockout: null,
    survivedSecondKnockout: false,
  };
}

export interface MatchObjectivesState {
  readonly raceClaimedBy: Readonly<Record<string, PlayerId>>;
  readonly anytimeClaimedBy: Readonly<Record<string, readonly PlayerId[]>>;
  readonly selectTurnsRemaining: number | null;
  readonly selectWindowOpened: boolean;
}

export function createInitialObjectivesState(): MatchObjectivesState {
  return {
    raceClaimedBy: {},
    anytimeClaimedBy: {},
    selectTurnsRemaining: null,
    selectWindowOpened: false,
  };
}

export const RACE_OBJECTIVES: readonly ObjectiveDef[] = [
  {
    id: "race-3-figurines",
    kind: "race",
    title: "First to 3 figurines",
    description: "Be first to own 3 figurines.",
    points: 5,
  },
  {
    id: "race-10-builds",
    kind: "race",
    title: "First to 10 builds",
    description: "Be first to place 10 builds.",
    points: 5,
  },
  {
    id: "race-10-skills",
    kind: "race",
    title: "First to 10 skills",
    description: "Be first to learn 10 skills.",
    points: 5,
  },
  {
    id: "race-20-specials",
    kind: "race",
    title: "First to 20 specials",
    description: "Be first to play 20 special cards.",
    points: 5,
  },
  {
    id: "race-7-lives",
    kind: "race",
    title: "First to 7 lives",
    description: "Be first to reach 7 lives.",
    points: 5,
  },
  {
    id: "race-whisky-l3-x10",
    kind: "race",
    title: "Whisky L3 ×10",
    description: "First to receive money from Whisky Level 3 ten times.",
    points: 5,
  },
  {
    id: "race-vodka-l4-x10-whisky-l4-x5",
    kind: "race",
    title: "Vodka L4 ×10 & Whisky L4 ×5",
    description:
      "First to receive money from Vodka L4 ten times and Whisky L4 five times.",
    points: 5,
  },
];

export const ANYTIME_OBJECTIVES: readonly ObjectiveDef[] = [
  {
    id: "money-skills-15k",
    kind: "anytime",
    title: "Skills cash 15 000",
    description: "Make 15 000 from skills.",
    points: 5,
  },
  {
    id: "money-borrow-15k",
    kind: "anytime",
    title: "Borrow cash 15 000",
    description: "Make 15 000 from borrows.",
    points: 5,
  },
  {
    id: "money-skills-30k",
    kind: "anytime",
    title: "Skills cash 30 000",
    description: "Make 30 000 from skills.",
    points: 5,
  },
  {
    id: "money-borrow-30k",
    kind: "anytime",
    title: "Borrow cash 30 000",
    description: "Make 30 000 from borrows.",
    points: 5,
  },
  {
    id: "money-skills-45k",
    kind: "anytime",
    title: "Skills cash 45 000",
    description: "Make 45 000 from skills.",
    points: 5,
  },
  {
    id: "money-borrow-45k",
    kind: "anytime",
    title: "Borrow cash 45 000",
    description: "Make 45 000 from borrows.",
    points: 5,
  },
  {
    id: "survive-5-lives-until-first-ko",
    kind: "anytime",
    title: "5 lives until first KO",
    description: "Still have at least 5 lives when the first player is knocked out.",
    points: 5,
  },
  {
    id: "survive-until-2-ko",
    kind: "anytime",
    title: "Survive to 2 KOs",
    description: "Still alive when the second knockout happens.",
    points: 5,
  },
];

export const ALL_OBJECTIVES: readonly ObjectiveDef[] = [
  ...RACE_OBJECTIVES,
  ...ANYTIME_OBJECTIVES,
];
