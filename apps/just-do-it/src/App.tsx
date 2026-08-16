import { Navigate, Route, Routes } from 'react-router-dom';

import { AppLayout } from './layouts/app-layout';
import { CalendarPage } from './routes/calendar-page';
import { GoalsPage } from './routes/goals-page';
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
        <Route path="/habits" element={<PlaceholderPage title="Habits" />} />
        <Route path="/books" element={<PlaceholderPage title="Books" />} />
        <Route path="/lists" element={<PlaceholderPage title="Lists" />} />
        <Route path="/lists/:listId" element={<PlaceholderPage title="List" />} />
        <Route path="/settings" element={<PlaceholderPage title="Settings" />} />
      </Route>
      <Route path="*" element={<Navigate replace to="/today" />} />
    </Routes>
  );
}
