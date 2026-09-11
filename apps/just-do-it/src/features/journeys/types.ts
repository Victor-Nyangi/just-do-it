export const JOURNEY_ACTIVITY_CATEGORY_VALUES = [
  'physical',
  'technical_reading',
  'growth_reading',
  'reflection',
] as const;

export type JourneyActivityCategory = (typeof JOURNEY_ACTIVITY_CATEGORY_VALUES)[number];

export const JOURNEY_BOOK_TRACK_VALUES = ['technical', 'growth'] as const;

export type JourneyBookTrack = (typeof JOURNEY_BOOK_TRACK_VALUES)[number];

export const JOURNEY_DAY_STATUS_VALUES = [
  'complete',
  'partial',
  'in_progress',
  'missed',
  'upcoming',
] as const;

export type JourneyDayStatus = (typeof JOURNEY_DAY_STATUS_VALUES)[number];

export type JourneyPhysicalActivity = {
  id: string;
  label: string;
  detail: string;
};

export type JourneyBook = {
  id: string;
  title: string;
  author: string;
  track: JourneyBookTrack;
  pageCount: number;
};

// A journey is the *definition* — what a day of it looks like, and how many
// days there are. It deliberately carries no start date: that belongs to the
// enrollment below, so one journey can be started by different people on
// different dates, and by the same person more than once.
//
// Every part of it is data rather than code, which is what makes a journey
// something a user can write. It is also the unit that a backend would store
// as a single validated JSON document: nothing here is ever queried across.
export type Journey = {
  id: string;
  title: string;
  description: string;
  totalDays: number;
  readingPagesPerSession: number;
  // Zero means this journey asks for no written reflection.
  reflectionLineCount: number;
  // Both may be empty: a journey with no physical work simply schedules none.
  physicalActivities: JourneyPhysicalActivity[];
  physicalRotation: string[][];
  // A track with no books schedules no reading for that track.
  books: JourneyBook[];
};

export type JourneyEnrollment = {
  id: string;
  journeyId: string;
  startDate: string;
  createdAt: string;
};

// The pair the rest of the feature actually works in terms of: a definition
// plus the dates someone is living it on.
export type EnrolledJourney = {
  enrollment: JourneyEnrollment;
  journey: Journey;
};

export type JourneyActivity = {
  id: string;
  category: JourneyActivityCategory;
  label: string;
  detail: string;
  // Set on the two reading categories only, and always together.
  bookId?: string;
  pages?: number;
};

export type JourneyDayPlan = {
  dayIndex: number;
  date: string;
  activities: JourneyActivity[];
};

// Mirrors the planned `completions` backend table, minus its `user_id` column:
// the server scopes rows to the session's user, so the client neither holds nor
// sends a user id. `(enrollment_id, day_index, activity_id)` is the natural
// primary key, which is what makes a toggle safe to retry.
export type JourneyCompletion = {
  id: string;
  enrollmentId: string;
  dayIndex: number;
  activityId: string;
  completedAt: string;
};

export type JourneyActivityGroup = {
  category: JourneyActivityCategory;
  activities: JourneyActivity[];
};

export type JourneyDayProgress = {
  completedCount: number;
  activityCount: number;
  complete: boolean;
};

export type JourneyDaySummary = JourneyDayProgress & {
  dayIndex: number;
  date: string;
  status: JourneyDayStatus;
  isToday: boolean;
};

export type JourneyCategoryCount = {
  category: JourneyActivityCategory;
  completedCount: number;
  activityCount: number;
};

export type JourneyStats = {
  currentDayIndex: number | null;
  elapsedDayCount: number;
  remainingDayCount: number;
  totalDays: number;
  currentStreak: number;
  longestStreak: number;
  completedDayCount: number;
  completedActivityCount: number;
  totalActivityCount: number;
  categoryCounts: JourneyCategoryCount[];
};

export type JourneyBookProgress = {
  book: JourneyBook;
  sessionsCompleted: number;
  sessionsScheduled: number;
  pagesRead: number;
  progress: number;
  nextScheduledDayIndex: number | null;
};

export type JourneyInput = {
  title: string;
  description: string;
  totalDays: number;
  readingPagesPerSession?: number;
  reflectionLineCount?: number;
  physicalActivities?: JourneyPhysicalActivity[];
  physicalRotation?: string[][];
  books?: JourneyBook[];
};
