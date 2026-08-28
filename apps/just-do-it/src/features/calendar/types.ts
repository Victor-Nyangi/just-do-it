import type { BadgeTone } from '@just-do-it/ui';

export const AGENDA_MODE_VALUES = ['day', 'week'] as const;
// Declaration order only, not sort order — the agenda's actual sort order
// lives in `agendaKindOrder` in calendar-selectors.ts (task, goal, habit).
export const AGENDA_ITEM_KIND_VALUES = ['task', 'habit', 'goal'] as const;

export type AgendaMode = (typeof AGENDA_MODE_VALUES)[number];
export type AgendaItemKind = (typeof AGENDA_ITEM_KIND_VALUES)[number];

export type DayIndicators = {
  tasks: number;
  habits: number;
  goals: number;
};

export type GoalTarget = {
  id: string;
  title: string;
  progress: number;
  targetDate: Date;
};

export type AgendaItem = {
  id: string;
  kind: AgendaItemKind;
  title: string;
  description: string;
  badge: string;
  date: Date;
  tone: BadgeTone;
};
