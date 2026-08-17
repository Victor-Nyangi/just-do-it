import {
  selectActiveTaskCount,
  selectCompletedTaskCount,
  selectVisibleTodayTasks,
} from './task-selectors';
import { useTaskStore } from './task-store';

export function useTasks() {
  return useTaskStore((state) => state.tasks);
}

export function useCreateTask() {
  return useTaskStore((state) => state.createTask);
}

export function useUpdateTask() {
  return useTaskStore((state) => state.updateTask);
}

export function useToggleTaskCompletion() {
  return useTaskStore((state) => state.toggleTaskCompletion);
}

export function useDeleteTask() {
  return useTaskStore((state) => state.deleteTask);
}

export function useOpenTaskCount() {
  return useTaskStore((state) => selectActiveTaskCount(state.tasks));
}

export function useCompletedTaskCount() {
  return useTaskStore((state) => selectCompletedTaskCount(state.tasks));
}

export function useTodayTasks() {
  return useTaskStore((state) => selectVisibleTodayTasks(state.tasks));
}
