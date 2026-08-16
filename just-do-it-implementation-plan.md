# Just Do It: Monorepo & Frontend Implementation Plan

## 1. Overview

**Just Do It** is a personal productivity POC for managing:

- Tasks and to-dos
- Daily schedules
- Workouts and habits
- Books to read
- Hobbies
- Goals
- Bucket lists
- Ideas and other non-scheduled lists

The project will also serve as a proof of concept for a heterogeneous frontend monorepo containing React + Vite, Next.js, and Astro applications with shared design-system packages.

### Current delivery decision

The POC will use versioned static JSON fixtures before it has a hosted backend.
This keeps feature and design work moving without requiring a managed database
project. Changes made in the browser are intentionally session-local during
this phase. Hosted persistence, authentication, and synchronization are
deferred until a Supabase project or equivalent managed backend is available.

## 2. Recommended Architecture

Use:

- **Monorepo:** Turborepo
- **Package manager:** pnpm
- **Frontend:** React + Vite + TypeScript
- **Routing:** React Router
- **Styling:** Tailwind CSS
- **Components:** shadcn/ui
- **Server state:** TanStack Query
- **Local UI state:** Zustand / React state
- **Current data source:** Validated local JSON fixtures
- **Future database:** Supabase/Postgres or a compatible hosted alternative
- **Future authentication:** Supabase Auth or the chosen backend's auth service
- **Validation:** Zod
- **Dates:** date-fns
- **Icons:** Lucide
- **Deployment:** Vercel

Next.js is intentionally not used for Just Do It initially. The application is
highly interactive and does not need SSR or SEO for the POC. A hosted backend
can be introduced later without requiring a Next.js server layer.

## 3. Monorepo Structure

```text
just-do-it-workspace/
│
├── apps/
│   └── just-do-it/
│       ├── src/
│       │   ├── components/
│       │   ├── features/
│       │   ├── layouts/
│       │   ├── lib/
│       │   ├── routes/
│       │   ├── stores/
│       │   ├── types/
│       │   ├── App.tsx
│       │   └── main.tsx
│       ├── public/
│       ├── components.json
│       ├── vite.config.ts
│       └── package.json
│
├── packages/
│   ├── ui/
│   ├── config/
│   │   ├── eslint/
│   │   └── typescript/
│   ├── utils/
│   └── types/
│
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── README.md
```

The monorepo should remain framework-agnostic at the root. Each application owns its own framework configuration.

A future workspace could look like:

```text
apps/
├── just-do-it/       React + Vite
├── portfolio/        Astro
├── blog/             Astro
├── some-next-app/    Next.js
└── experiment/       React + Vite
```

Each application can be deployed independently.

## 4. Phase 1: Monorepo Foundation

### Workspace

Create the repository using pnpm and Turborepo.

`pnpm-workspace.yaml`:

```yaml
packages:
  - apps/*
  - packages/*
```

Root scripts should include:

```json
{
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "typecheck": "turbo typecheck",
    "format": "prettier --write ."
  }
}
```

### Tasks

- [ ] Initialize Git repository
- [ ] Initialize pnpm workspace
- [ ] Add Turborepo
- [ ] Configure `apps/*`
- [ ] Configure `packages/*`
- [ ] Add shared TypeScript configuration
- [ ] Add shared ESLint configuration
- [ ] Add Prettier
- [ ] Configure Turbo tasks
- [ ] Verify `turbo dev`
- [ ] Verify `turbo build`
- [ ] Verify `turbo lint`
- [ ] Verify `turbo typecheck`

## 5. Phase 2: Create Just Do It

Create a React + TypeScript + Vite application under:

```text
apps/just-do-it
```

Install/configure:

- React
- Vite
- TypeScript
- React Router
- Tailwind CSS
- shadcn/ui
- TanStack Query
- Zustand
- Zod
- date-fns
- Lucide icons

### Initial application shell

Create:

```text
src/
├── components/
├── features/
├── layouts/
├── lib/
├── routes/
├── stores/
├── types/
├── App.tsx
└── main.tsx
```

Build the initial:

- [ ] Application shell
- [ ] Sidebar/navigation
- [ ] Header
- [ ] Responsive layout
- [ ] Dark mode
- [ ] Basic dashboard
- [ ] Route structure

## 6. Phase 3: Shared Design System

Create:

```text
packages/ui/
```

Initially share a focused collection of shadcn components:

```text
packages/ui/
├── src/
│   ├── components/
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── input.tsx
│   │   ├── badge.tsx
│   │   ├── popover.tsx
│   │   ├── tabs.tsx
│   │   ├── tooltip.tsx
│   │   └── command.tsx
│   ├── styles/
│   │   └── globals.css
│   └── index.ts
├── package.json
└── tsconfig.json
```

Do not move every component into the shared package immediately. Add components as applications actually need them.

### Shared design tokens

Prioritize sharing:

- Colors
- Typography
- Spacing
- Radius
- Shadows
- Dark mode
- Semantic colors

Design tokens are more important to share across React, Next.js, and Astro than forcing every framework to consume the exact same component implementation.

Potential future structure:

```text
packages/
├── ui-react/
├── ui-tokens/
├── utils/
└── types/
```

## 7. Phase 4: Static Data Foundation

Use local JSON fixtures as the temporary product data source. Keep them
versioned, small, and structurally close to the eventual data model:

```text
apps/just-do-it/
└── src/
    └── data/
        ├── tasks.json
        ├── habits.json
        ├── goals.json
        ├── books.json
        ├── lists.json
        └── dashboard.ts
```

`dashboard.ts` validates fixture modules with Zod before feature code uses
them. This catches malformed mock data early while keeping the UI independent
of a server.

Tasks:

- [ ] Add representative JSON fixtures for each product domain
- [ ] Validate fixture shapes with Zod
- [ ] Keep browser interactions in local React state
- [ ] Build feature UI against data-source interfaces rather than direct fetches
- [ ] Add loading, empty, and error-state patterns that can later be backed by a server

Do not store user data or secrets in these fixtures. Static data is POC-only
and must be replaced before multi-device persistence or authentication ships.

## 8. Phase 5: Initial Data Model

Avoid making the entire system a generic Todo model. The application has several distinct concepts.

### Tasks

```text
tasks
-----
id
title
description
status
priority
due_date
completed_at
category
created_at
updated_at
```

Potential categories:

```text
PERSONAL
WORKOUT
READING
HOBBY
ERRAND
OTHER
```

### Goals

```text
goals
-----
id
title
description
status
target_date
period
progress
created_at
updated_at
```

Periods:

```text
WEEK
MONTH
YEAR
```

### Habits

```text
habits
------
id
name
description
frequency
target
created_at
```

Habit completions:

```text
habit_completions
-----------------
id
habit_id
completed_at
```

This allows metrics such as weekly workout counts without overloading the task table.

### Books

```text
books
-----
id
title
author
status
started_at
finished_at
rating
notes
```

Statuses:

```text
WANT_TO_READ
READING
FINISHED
ABANDONED
```

### Lists

Lists handle things that do not naturally follow a schedule.

```text
lists
-----
id
name
description
icon
```

List items:

```text
list_items
----------
id
list_id
title
completed
position
notes
```

Examples:

- Bucket List
- Hobbies
- Ideas
- Places to visit
- Things to learn

## 9. Phase 6: Feature Architecture

Organize domain functionality by feature:

```text
apps/just-do-it/
└── src/
    └── features/
        ├── tasks/
        │   ├── components/
        │   ├── hooks/
        │   ├── queries/
        │   ├── mutations/
        │   └── types.ts
        │
        ├── goals/
        ├── habits/
        ├── books/
        └── lists/
```

This is preferable to placing every component in a single global components folder.

## 10. Phase 7: Today Dashboard

The Today screen should be the core experience.

Conceptually:

```text
Good afternoon 👋

Sunday, August 16

TODAY
────────────────────────
□ Read 20 pages
□ Go for a run
□ Finish portfolio landing page
□ Buy groceries

HABITS
────────────────────────
Workout       ● ● ● ○ ●
Reading       ● ● ● ● ○
Meditation    ● ● ○ ● ○

GOALS
────────────────────────
August
████████████░░ 72%

QUICK ADD
────────────────────────
What do you want to get done?
```

Primary goal:

> Open the app and immediately understand what matters today.

## 11. Phase 8: Calendar

Add a calendar for scheduled activities.

Initial functionality:

- [ ] Monthly calendar
- [ ] Select a day
- [ ] Show tasks for selected day
- [ ] Show goal milestones
- [ ] Show habit activity
- [ ] Daily view
- [ ] Weekly view

Example:

```text
August 18

Tasks
────────────
□ Workout
□ Read chapter 4
□ Work on side project

Goals
────────────
○ Complete 3 workouts
```

Use date-fns for date manipulation rather than custom date logic.

## 12. Phase 9: Goals

Goals should feel distinct from tasks.

Example:

```text
August Goals

┌────────────────────────────┐
│ 🏃 Fitness                 │
│                            │
│ Run 50km this month        │
│ ███████████████░░ 42km     │
└────────────────────────────┘

┌────────────────────────────┐
│ 📚 Reading                 │
│                            │
│ Read 4 books               │
│ ███████████░░░░░ 3/4       │
└────────────────────────────┘
```

Goals can eventually aggregate progress from related tasks and habits.

## 13. Phase 10: Books

Provide a dedicated reading section:

```text
Currently Reading
-----------------
Atomic Habits
The Pragmatic Programmer

Want to Read
------------
17 books

Finished
--------
8 books this year
```

Future enhancements can include:

- Reading progress
- Notes
- Ratings
- Reading goals
- Book covers
- Author information

## 14. Phase 11: Lists

Lists are intentionally unscheduled collections.

Example:

```text
Bucket List
-----------
□ Visit Japan
□ Learn photography
□ Build a tiny game
□ Go hiking
□ Learn piano
```

The list system should support:

- [ ] Create list
- [ ] Rename list
- [ ] Add item
- [ ] Reorder item
- [ ] Complete item
- [ ] Delete item
- [ ] Add notes

## 15. Phase 12: Quick Add

A central quick-add experience should eventually allow natural inputs such as:

```text
Workout tomorrow
Read 20 pages Friday
Finish portfolio Aug 20
```

Initially implement this without AI using a simple parser.

Potential future behavior:

```text
Input:
Read Atomic Habits tomorrow

Result:
Task
Read Atomic Habits

Due:
Tomorrow

Category:
Reading
```

AI can be considered later if it materially improves the experience.

## 16. State Management

Keep fixture data and local UI state separate today, with a clean boundary for
server state later.

```text
Validated JSON fixtures
    ↓
Local feature state
    ↓
React components
```

For local UI state:

```text
React state / Zustand
```

Use local React state/Zustand for:

- Static task, goal, habit, book, and list interactions
- Sidebar state
- Selected calendar date
- UI preferences
- Command palette state
- Temporary filters
- Other client-only state

Introduce TanStack Query only when a hosted API is available. Avoid Redux for
this POC.

## 17. Routing

Use React Router.

Potential routes:

```text
/
├── /today
├── /tasks
├── /calendar
├── /goals
├── /habits
├── /books
├── /lists
│   ├── /lists/:listId
│   └── ...
└── /settings
```

Authentication routes are deferred with hosted persistence:

```text
/login
/signup
```

## 18. Deployment

Initial deployment:

```text
GitHub
   │
   ↓
Turborepo
   │
   └── apps/just-do-it
            │
            ↓
          Vercel
            │
            ↓
      Static application
```

Each future monorepo application can have its own deployment:

```text
GitHub
   │
   └── Monorepo
       │
       ├── just-do-it ──── Vercel Project A
       ├── portfolio ───── Vercel Project B
       ├── blog ────────── Vercel Project C
       └── next-app ────── Vercel Project D
```

The applications remain independent while sharing packages.

## 19. Complete Implementation Roadmap

### Phase 1: Monorepo

- [ ] Git repository
- [ ] pnpm workspace
- [ ] Turborepo
- [ ] Root scripts
- [ ] TypeScript config
- [ ] ESLint config
- [ ] Prettier
- [ ] Turbo pipeline
- [ ] Verify builds

### Phase 2: Frontend Foundation

- [ ] React + Vite
- [ ] TypeScript
- [ ] React Router
- [ ] Tailwind
- [ ] shadcn/ui
- [ ] Shared UI package
- [ ] App shell
- [ ] Navigation
- [ ] Dark mode
- [ ] Responsive layout

### Phase 3: Shared Design System

- [ ] Shared semantic color tokens
- [ ] Typography, spacing, radius, and shadow tokens
- [ ] Shared component primitives and variants
- [ ] Dark-mode theme

### Phase 4: Static Data Foundation

- [ ] JSON fixtures for tasks, habits, goals, books, and lists
- [ ] Zod fixture validation
- [ ] Local data-source modules
- [ ] Session-local interactions

### Phase 5: Tasks

- [ ] Create
- [ ] Edit
- [ ] Complete
- [ ] Delete
- [ ] Priority
- [ ] Categories
- [ ] Due dates
- [ ] Recurrence
- [ ] Today view

### Phase 6: Planning

- [ ] Calendar
- [ ] Daily view
- [ ] Weekly view
- [ ] Monthly goals
- [ ] Goal progress
- [ ] Habit tracking

### Phase 7: Personal Collections

- [ ] Books
- [ ] Hobbies
- [ ] Bucket lists
- [ ] Custom lists
- [ ] Ideas
- [ ] Notes

### Phase 8: Product Polish

- [ ] Quick add
- [ ] Command palette
- [ ] Keyboard shortcuts
- [ ] Loading states
- [ ] Empty states
- [ ] Error states
- [ ] Mobile layout
- [ ] PWA consideration
- [ ] Static-site deployment

### Phase 9: Hosted Persistence (Deferred)

Start this phase only after a managed backend is available.

- [ ] Choose and create a hosted Supabase project or compatible backend
- [ ] Apply the database schema and configure Row Level Security
- [ ] Configure authentication and environment variables
- [ ] Generate database types from the linked project
- [ ] Replace JSON data-source modules with typed query/mutation modules
- [ ] Add TanStack Query for server state and optimistic updates
- [ ] Migrate any POC data that needs to persist

## 20. Architectural Principles

1. **Keep the monorepo framework-agnostic.**
2. **Each application should be independently deployable.**
3. **Do not group Next.js applications artificially.**
4. **Share design tokens across frameworks.**
5. **Share React components where they genuinely make sense.**
6. **Keep domain logic feature-oriented.**
7. **Use JSON fixtures and local state until a hosted backend is available.**
8. **Use TanStack Query only for future server state.**
9. **Do not introduce Next.js solely for SSR.**
10. **Do not prematurely extract shared packages.**
11. **Keep future backend-specific logic local to Just Do It until another app needs it.**
12. **Optimize for a small, delightful POC before adding complexity.**

## 21. Target Outcome

The first milestone is not a fully fledged productivity platform.

It is a polished POC that proves:

- Turborepo can comfortably host heterogeneous frontend applications.
- React + Vite works well alongside Next.js and Astro.
- shadcn/Tailwind can provide a shared design language.
- Static JSON data can unlock a polished POC without backend dependencies.
- The architecture can grow without turning the hobby project into an enterprise-sized spaceship.

The core experience should remain simple:

> **Open Just Do It → see what matters → do it → check it off.**

Later, a hosted backend can replace the fixture data without changing the
fundamental feature architecture, enabling multi-device persistence,
authentication, and synchronization.
