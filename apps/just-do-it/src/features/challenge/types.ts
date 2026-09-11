export const CHALLENGE_ACTIVITY_CATEGORY_VALUES = [
  'physical',
  'technical_reading',
  'growth_reading',
  'reflection',
] as const;

export type ChallengeActivityCategory = (typeof CHALLENGE_ACTIVITY_CATEGORY_VALUES)[number];

export const CHALLENGE_BOOK_TRACK_VALUES = ['technical', 'growth'] as const;

export type ChallengeBookTrack = (typeof CHALLENGE_BOOK_TRACK_VALUES)[number];

export const CHALLENGE_DAY_STATUS_VALUES = [
  'complete',
  'partial',
  'in_progress',
  'missed',
  'upcoming',
] as const;

export type ChallengeDayStatus = (typeof CHALLENGE_DAY_STATUS_VALUES)[number];

export type ChallengePhysicalActivity = {
  id: string;
  label: string;
  detail: string;
};

export type Challenge = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  readingPagesPerSession: number;
  reflectionLineCount: number;
  physicalActivities: ChallengePhysicalActivity[];
  // One entry per day of the rotation; each lists the physical activity ids
  // that day calls for. `buildDayPlan` indexes it by day index modulo its
  // length, so its length is the length of the rotation cycle.
  physicalRotation: string[][];
};

export type ChallengeBook = {
  id: string;
  title: string;
  author: string;
  track: ChallengeBookTrack;
  pageCount: number;
};

export type ChallengeActivity = {
  id: string;
  category: ChallengeActivityCategory;
  label: string;
  detail: string;
  // Set on the two reading categories only, and always together.
  bookId?: string;
  pages?: number;
};

export type ChallengeDayPlan = {
  dayIndex: number;
  date: string;
  activities: ChallengeActivity[];
};

// Mirrors the planned `challenge_completions` backend table, minus its
// `user_id` column: the server scopes rows to the session's user, so the
// client neither holds nor sends a user id. When this moves behind an API the
// column is added there, not here.
export type ChallengeCompletion = {
  id: string;
  dayIndex: number;
  activityId: string;
  completedAt: string;
};

export type ChallengeActivityGroup = {
  category: ChallengeActivityCategory;
  activities: ChallengeActivity[];
};

export type ChallengeDayProgress = {
  completedCount: number;
  activityCount: number;
  complete: boolean;
};

export type ChallengeDaySummary = ChallengeDayProgress & {
  dayIndex: number;
  date: string;
  status: ChallengeDayStatus;
  isToday: boolean;
};

export type ChallengeCategoryCount = {
  category: ChallengeActivityCategory;
  completedCount: number;
  activityCount: number;
};

export type ChallengeStats = {
  currentDayIndex: number | null;
  elapsedDayCount: number;
  remainingDayCount: number;
  totalDays: number;
  currentStreak: number;
  longestStreak: number;
  completedDayCount: number;
  completedActivityCount: number;
  totalActivityCount: number;
  categoryCounts: ChallengeCategoryCount[];
};

export type ChallengeBookProgress = {
  book: ChallengeBook;
  sessionsCompleted: number;
  sessionsScheduled: number;
  pagesRead: number;
  progress: number;
  nextScheduledDayIndex: number | null;
};
