import { Navigate, Route, Routes } from 'react-router-dom';

import { AppLayout } from './layouts/app-layout';
import { BooksPage } from './routes/books-page';
import { CalendarPage } from './routes/calendar-page';
import { GoalsPage } from './routes/goals-page';
import { HabitDetailPage } from './routes/habit-detail-page';
import { HabitsPage } from './routes/habits-page';
import { ListDetailPage } from './routes/list-detail-page';
import { ListsPage } from './routes/lists-page';
import { PlaceholderPage } from './routes/placeholder-page';
import { TasksPage } from './routes/tasks-page';
import { TodayPage } from './routes/today-page';

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate replace to="/today" />} />
        <Route path="/today" element={<TodayPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/goals" element={<GoalsPage />} />
        <Route path="/habits" element={<HabitsPage />} />
        <Route path="/habits/:habitId" element={<HabitDetailPage />} />
        <Route path="/books" element={<BooksPage />} />
        <Route path="/lists" element={<ListsPage />} />
        <Route path="/lists/:listId" element={<ListDetailPage />} />
        <Route path="/settings" element={<PlaceholderPage title="Settings" />} />
      </Route>
      <Route path="*" element={<Navigate replace to="/today" />} />
    </Routes>
  );
}
