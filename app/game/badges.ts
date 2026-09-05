import type { BadgeId } from "./types";

export type BadgeDifficulty = "Milestone" | "Hard" | "Legendary";

export interface BadgeDefinition {
  id: BadgeId;
  name: string;
  icon: string;
  difficulty: BadgeDifficulty;
  clue: string;
}

export const BADGES = [
  { id: "grand-terminus", name: "Grand Terminus", icon: "🏛️", difficulty: "Milestone", clue: "Reach Station Tier 5." },
  { id: "storm-watcher", name: "Storm Watcher", icon: "⛈️", difficulty: "Milestone", clue: "See a thunderstorm." },
  { id: "midnight-arrival", name: "Midnight Arrival", icon: "🌙", difficulty: "Milestone", clue: "Serve an ÖBB Nightjet." },
  { id: "perfect-score", name: "Five-Star Corner", icon: "⭐", difficulty: "Milestone", clue: "Reach 100% Station Rating." },
  { id: "rush-hour", name: "Rush Hour", icon: "🚆", difficulty: "Hard", clue: "Host trains on all 5 platforms." },
  { id: "clean-comeback", name: "Clean Comeback", icon: "🧹", difficulty: "Hard", clue: "Clean from 20% or below." },
  { id: "millionaire", name: "Rail Millionaire", icon: "💰", difficulty: "Hard", clue: "Earn 1,000,000 coins before prestige." },
  { id: "master-engineer", name: "Master Engineer", icon: "🛠️", difficulty: "Hard", clue: "Complete every station development." },
  { id: "event-curator", name: "Event Curator", icon: "🎉", difficulty: "Hard", clue: "Serve both special-event trains." },
  { id: "complete-timetable", name: "Complete Timetable", icon: "📋", difficulty: "Legendary", clue: "Serve all 18 scheduled services." },
  { id: "storm-sleeper", name: "Storm Sleeper", icon: "⚡", difficulty: "Legendary", clue: "Serve Nightjet in a thunderstorm." },
  { id: "triple-prestige", name: "Three Times Rebuilt", icon: "♻️", difficulty: "Legendary", clue: "Reach Prestige 3." },
] as const satisfies readonly BadgeDefinition[];

export const BADGE_IDS = new Set<BadgeId>(BADGES.map((badge) => badge.id));

export function isBadgeId(value: unknown): value is BadgeId {
  return typeof value === "string" && BADGE_IDS.has(value as BadgeId);
}

export function newlyUnlockedBadgeIds(previous: readonly BadgeId[], current: readonly BadgeId[]) {
  const alreadyUnlocked = new Set(previous);
  return current.filter((badgeId) => !alreadyUnlocked.has(badgeId));
}
