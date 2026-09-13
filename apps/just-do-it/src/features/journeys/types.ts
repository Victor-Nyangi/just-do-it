export const JOURNEY_ACTIVITY_CATEGORY_VALUES = [
  'physical',
  'technical_reading',
  'growth_reading',
  'reflection',
] as const;

export type JourneyActivityCategory = (typeof JOURNEY_ACTIVITY_CATEGORY_VALUES)[number];

export const JOURNEY_BOOK_TRACK_VALUES = ['technical', 'growth'] as const;

export type JourneyBookTrack = (typeof JOURNEY_BOOK_TRACK_VALUES)[number];

// A day draws one movement from each track, which is what stops a hundred days
// of movement from turning into a hundred hard workouts: `main` is the session
// that asks something, `easy` is the walk, the mobility, the loose jog that
// keeps the streak going on a tired day.
export const JOURNEY_PHYSICAL_TRACK_VALUES = ['main', 'easy'] as const;

export type JourneyPhysicalTrack = (typeof JOURNEY_PHYSICAL_TRACK_VALUES)[number];

// What a movement actually taxes. Dealing each movement once per pass keeps the
// *movements* varied but says nothing about the muscles: a shuffle is perfectly
// happy to follow push-ups with a floor press with more push-ups. The plan
// builder spaces these apart instead, so a hundred days of movement does not
// land three leg days in a row.
export const JOURNEY_PHYSICAL_FOCUS_VALUES = [
  'push',
  'pull',
  'legs',
  'core',
  'cardio',
  'walk',
  'mobility',
  'carry',
] as const;

export type JourneyPhysicalFocus = (typeof JOURNEY_PHYSICAL_FOCUS_VALUES)[number];

export const JOURNEY_DAY_STATUS_VALUES = [
  'complete',
  'partial',
  'in_progress',
  'missed',
  'upcoming',
] as const;

export type JourneyDayStatus = (typeof JOURNEY_DAY_STATUS_VALUES)[number];

// One rung of a movement's progression. The label is what the day asks for, so
// a rung can raise the reps (30 → 40 push-ups) or raise the difficulty at the
// same reps (30 squats → 30 goblet squats → 30 slow goblet squats), which is the
// honest way to keep progressing once more reps stop meaning more.
export type JourneyPhysicalLevel = {
  label: string;
  detail: string;
};

// The movement, not the prescription: `push-ups` stays `push-ups` all hundred
// days while what it asks for grows. That matters beyond tidiness — a completion
// id embeds this id, so a movement that levels up must not become a new movement
// or every tick already written against it would be orphaned.
export type JourneyPhysicalActivity = {
  id: string;
  name: string;
  track: JourneyPhysicalTrack;
  focus: JourneyPhysicalFocus;
  // Ordered easiest first, and walked through as the journey progresses.
  levels: JourneyPhysicalLevel[];
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
  // A track with no movements schedules none, exactly as an empty book track
  // does. An empty list means a journey with no physical work at all.
  physicalActivities: JourneyPhysicalActivity[];
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
  books?: JourneyBook[];
};
