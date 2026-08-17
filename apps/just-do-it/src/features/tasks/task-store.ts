import { create } from 'zustand';

import { getInitialTasks, taskSchema } from './task-data';
import type { Task, TaskInput, TaskStatus } from './types';

type TaskStoreState = {
  tasks: Task[];
  createTask: (input: TaskInput) => void;
  updateTask: (taskId: string, input: TaskInput) => void;
  toggleTaskCompletion: (taskId: string) => void;
  deleteTask: (taskId: string) => void;
};

function buildTaskRecord(taskId: string, input: TaskInput, existingTask?: Task): Task {
  const now = new Date().toISOString();
  const nextStatus = input.status;
  const completedAt = nextStatus === 'completed' ? (existingTask?.completedAt ?? now) : undefined;

  return taskSchema.parse({
    id: existingTask?.id ?? taskId,
    title: input.title,
    description: input.description,
    status: nextStatus,
    priority: input.priority,
    category: input.category,
    dueDate: input.dueDate,
    completedAt,
    recurrence: input.recurrence,
    recurrenceInterval: input.recurrenceInterval,
    createdAt: existingTask?.createdAt ?? now,
    updatedAt: now,
  });
}

function getNextStatusAfterToggle(status: TaskStatus): TaskStatus {
  return status === 'completed' ? 'todo' : 'completed';
}

export const useTaskStore = create<TaskStoreState>()((set) => ({
  tasks: getInitialTasks(),
  createTask: (input) => {
    set((state) => ({
      tasks: [...state.tasks, buildTaskRecord(crypto.randomUUID(), input)],
    }));
  },
  updateTask: (taskId, input) => {
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === taskId ? buildTaskRecord(taskId, input, task) : task,
      ),
    }));
  },
  toggleTaskCompletion: (taskId) => {
    set((state) => ({
      tasks: state.tasks.map((task) => {
        if (task.id !== taskId) return task;

        return buildTaskRecord(
          task.id,
          {
            title: task.title,
            description: task.description,
            status: getNextStatusAfterToggle(task.status),
            priority: task.priority,
            category: task.category,
            dueDate: task.dueDate,
            recurrence: task.recurrence,
            recurrenceInterval: task.recurrenceInterval,
          },
          task,
        );
      }),
    }));
  },
  deleteTask: (taskId) => {
    set((state) => ({
      tasks: state.tasks.filter((task) => task.id !== taskId),
    }));
  },
}));
