import { ArrowUpRight, Check, Circle, Plus, Sparkles } from 'lucide-react'
import { format } from 'date-fns'
import { useState } from 'react'

import { Badge, Button, Card, Input, cn } from '@just-do-it/ui'
import { dashboardData } from '../data/dashboard'
import { TaskMetadata, toTaskInput, useCreateTask, useOpenTaskCount, useTodayTasks, useToggleTaskCompletion } from '../features/tasks'

export function TodayPage() {
  const tasks = useTodayTasks()
  const openTaskCount = useOpenTaskCount()
  const createTask = useCreateTask()
  const toggleTaskCompletion = useToggleTaskCompletion()
  const [newTask, setNewTask] = useState('')

  function addTask() {
    const title = newTask.trim()
    if (!title) return

    createTask(
      toTaskInput({
        title,
        description: '',
        status: 'todo',
        priority: 'medium',
        category: 'Personal',
        dueDate: '',
        recurrence: 'none',
        recurrenceInterval: 1,
      }),
    )
    setNewTask('')
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
      <section className="mb-10 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <div>
          <Badge tone="accent">{format(new Date(), 'EEEE, MMMM d')}</Badge>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Good afternoon, Victor
          </h1>
          <p className="mt-2 text-[var(--muted-foreground)]">
            {tasks.length === 0
              ? 'No active overdue, due-today, or undated tasks. Enjoy the extra margin.'
              : `${tasks.length} focus task${tasks.length === 1 ? '' : 's'} in today’s lane.`}
          </p>
        </div>
        <Badge>{openTaskCount} open overall</Badge>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <Card>
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">Today</h2>
                <p className="text-sm text-[var(--muted-foreground)]">
                  Active tasks due today, overdue, or still flexible.
                </p>
              </div>
              <Badge>{tasks.length} in view</Badge>
            </div>
            {tasks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--border)] p-5 text-sm text-[var(--muted-foreground)]">
                You’re caught up on today’s visible tasks. Add a quick win below or check the Tasks page for future items.
              </div>
            ) : (
              <div className="space-y-3">
                {tasks.map((task) => (
                  <div
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4"
                    key={task.id}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-3">
                        <button
                          className="flex items-start gap-3 text-left"
                          onClick={() => toggleTaskCompletion(task.id)}
                          type="button"
                        >
                          <span
                            className={cn(
                              'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border',
                              task.status === 'completed'
                                ? 'border-[var(--primary)] bg-[var(--primary)] text-white'
                                : 'border-[var(--muted-foreground)]',
                            )}
                          >
                            {task.status === 'completed' ? (
                              <Check aria-hidden="true" className="size-3" />
                            ) : null}
                          </span>
                          <span>
                            <span className="block text-sm font-medium">{task.title}</span>
                            {task.description ? (
                              <span className="mt-1 block text-sm text-[var(--muted-foreground)]">
                                {task.description}
                              </span>
                            ) : null}
                          </span>
                        </button>
                        <TaskMetadata showDueDate showRecurrence={false} task={task} />
                      </div>
                      <Button
                        className="sm:self-start"
                        onClick={() => toggleTaskCompletion(task.id)}
                        variant="secondary"
                      >
                        <Check aria-hidden="true" className="mr-2 size-4" />
                        Complete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <div className="mb-4 flex items-center gap-2">
              <Sparkles aria-hidden="true" className="size-4 text-[var(--primary)]" />
              <h2 className="font-bold">Quick add</h2>
            </div>
            <div className="flex gap-2">
              <Input
                aria-label="Quick add task"
                className="flex-1"
                onChange={(event) => setNewTask(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') addTask()
                }}
                placeholder="What do you want to get done?"
                value={newTask}
              />
              <Button onClick={addTask}>
                <Plus aria-hidden="true" className="mr-2 size-4" />
                Add
              </Button>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="mb-5 text-lg font-bold">Habits</h2>
            <div className="space-y-5">
              {dashboardData.habits.map((habit) => (
                <div key={habit.label}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium">{habit.label}</span>
                    <span className="text-xs text-[var(--muted-foreground)]">
                      {habit.days.filter(Boolean).length}/5 this week
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {habit.days.map((complete, index) => (
                      <span
                        aria-label={`Day ${index + 1}: ${complete ? 'complete' : 'incomplete'}`}
                        className={cn(
                          'size-7 rounded-full',
                          complete ? 'bg-[var(--primary)]' : 'bg-[var(--surface-muted)]',
                        )}
                        key={index}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card variant="accent">
            <div className="flex items-start justify-between">
              <div>
                <Badge tone="accent">{dashboardData.goal.period} goal</Badge>
                <h2 className="mt-3 font-bold">{dashboardData.goal.title}</h2>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                  {dashboardData.goal.description}
                </p>
              </div>
              <ArrowUpRight aria-hidden="true" className="size-5 text-[var(--primary)]" />
            </div>
            <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/70">
              <div
                className="h-full rounded-full bg-[var(--primary)]"
                style={{ width: `${dashboardData.goal.progress}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-xs text-[var(--muted-foreground)]">
              <span>{dashboardData.goal.progress}% complete</span>
              <span>{dashboardData.goal.remainingLabel}</span>
            </div>
          </Card>

          <div className="rounded-xl border border-dashed border-[var(--border)] p-5">
            <div className="flex items-center gap-3">
              <Circle aria-hidden="true" className="size-5 text-[var(--muted-foreground)]" />
              <p className="text-sm text-[var(--muted-foreground)]">
                Progress, not perfection. Pick the next small step.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
