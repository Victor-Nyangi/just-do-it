import { Navigate, Route, Routes } from 'react-router-dom';

import { AppLayout } from './layouts/app-layout';
import { BooksPage } from './routes/books-page';
import { CalendarPage } from './routes/calendar-page';
import { GoalsPage } from './routes/goals-page';
import { HabitDetailPage } from './routes/habit-detail-page';
import { HabitsPage } from './routes/habits-page';
import { JourneyBooksPage } from './routes/journey-books-page';
import { JourneyDayPage } from './routes/journey-day-page';
import { JourneyStreakPage } from './routes/journey-streak-page';
import { JourneysPage } from './routes/journeys-page';
import { ListDetailPage } from './routes/list-detail-page';
import { ListsPage } from './routes/lists-page';
import { SettingsPage } from './routes/settings-page';
import { TasksPage } from './routes/tasks-page';
import { TodayPage } from './routes/today-page';

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate replace to="/today" />} />
        <Route path="/today" element={<TodayPage />} />
        <Route path="/journeys" element={<JourneysPage />} />
        <Route path="/journeys/:enrollmentId" element={<JourneyDayPage />} />
        <Route path="/journeys/:enrollmentId/books" element={<JourneyBooksPage />} />
        <Route path="/journeys/:enrollmentId/streak" element={<JourneyStreakPage />} />
        {/* The challenge shipped before journeys generalised it. Anything
            already linking to it lands on the list rather than a dead end. */}
        <Route path="/challenge" element={<Navigate replace to="/journeys" />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/goals" element={<GoalsPage />} />
        <Route path="/habits" element={<HabitsPage />} />
        <Route path="/habits/:habitId" element={<HabitDetailPage />} />
        <Route path="/books" element={<BooksPage />} />
        <Route path="/lists" element={<ListsPage />} />
        <Route path="/lists/:listId" element={<ListDetailPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate replace to="/today" />} />
    </Routes>
  );
}
