import { ArrowUpRight, Check, Circle, Plus, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Badge, Button, Card, cn, Input } from '@just-do-it/ui'

type Task = {
  id: number
  title: string
  category: 'Personal' | 'Reading' | 'Workout' | 'Errand'
  complete: boolean
}

const initialTasks: Task[] = [
  { id: 1, title: 'Read 20 pages', category: 'Reading', complete: false },
  { id: 2, title: 'Go for a run', category: 'Workout', complete: false },
  { id: 3, title: 'Finish portfolio landing page', category: 'Personal', complete: false },
  { id: 4, title: 'Buy groceries', category: 'Errand', complete: true },
]

const habits = [
  { label: 'Workout', days: [true, true, true, false, true] },
  { label: 'Reading', days: [true, true, true, true, false] },
  { label: 'Meditation', days: [true, true, false, true, false] },
]

export function TodayPage() {
  const [tasks, setTasks] = useState(initialTasks)
  const [newTask, setNewTask] = useState('')
  const incompleteCount = useMemo(() => tasks.filter((task) => !task.complete).length, [tasks])

  function toggleTask(id: number) {
    setTasks((current) =>
      current.map((task) => (task.id === id ? { ...task, complete: !task.complete } : task)),
    )
  }

  function addTask() {
    const title = newTask.trim()
    if (!title) return

    setTasks((current) => [
      ...current,
      { id: Date.now(), title, category: 'Personal', complete: false },
    ])
    setNewTask('')
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
      <section className="mb-10 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <div>
          <Badge tone="accent">Sunday, August 16</Badge>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Good afternoon, Victor
          </h1>
          <p className="mt-2 text-[var(--muted-foreground)]">
            {incompleteCount === 0
              ? 'Everything is complete. Enjoy the rest of your day.'
              : `${incompleteCount} thing${incompleteCount === 1 ? '' : 's'} to focus on today.`}
          </p>
        </div>
        <Button>
          <Plus aria-hidden="true" className="mr-2 size-4" />
          Add task
        </Button>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <Card>
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">Today</h2>
                <p className="text-sm text-[var(--muted-foreground)]">
                  Make steady progress on what matters.
                </p>
              </div>
              <Badge>{incompleteCount} open</Badge>
            </div>
            <div className="space-y-1">
              {tasks.map((task) => (
                <button
                  className="flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors hover:bg-[var(--surface-muted)]"
                  key={task.id}
                  onClick={() => toggleTask(task.id)}
                >
                  <span
                    className={cn(
                      'flex size-5 shrink-0 items-center justify-center rounded-full border',
                      task.complete
                        ? 'border-[var(--primary)] bg-[var(--primary)] text-white'
                        : 'border-[var(--muted-foreground)]',
                    )}
                  >
                    {task.complete && <Check aria-hidden="true" className="size-3" />}
                  </span>
                  <span
                    className={cn(
                      'flex-1 text-sm font-medium',
                      task.complete && 'text-[var(--muted-foreground)] line-through',
                    )}
                  >
                    {task.title}
                  </span>
                  <Badge>{task.category}</Badge>
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <div className="mb-4 flex items-center gap-2">
              <Sparkles aria-hidden="true" className="size-4 text-[var(--primary)]" />
              <h2 className="font-bold">Quick add</h2>
            </div>
            <div className="flex gap-2">
              <Input
                className="flex-1"
                onChange={(event) => setNewTask(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') addTask()
                }}
                placeholder="What do you want to get done?"
                value={newTask}
              />
              <Button onClick={addTask}>Add</Button>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="mb-5 text-lg font-bold">Habits</h2>
            <div className="space-y-5">
              {habits.map((habit) => (
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

          <Card className="bg-gradient-to-br from-[var(--primary-subtle)] to-[var(--surface)]">
            <div className="flex items-start justify-between">
              <div>
                <Badge tone="accent">August goal</Badge>
                <h2 className="mt-3 font-bold">Build momentum</h2>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                  Complete your most important tasks this month.
                </p>
              </div>
              <ArrowUpRight aria-hidden="true" className="size-5 text-[var(--primary)]" />
            </div>
            <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/70">
              <div className="h-full w-[72%] rounded-full bg-[var(--primary)]" />
            </div>
            <div className="mt-2 flex justify-between text-xs text-[var(--muted-foreground)]">
              <span>72% complete</span>
              <span>18 days left</span>
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
