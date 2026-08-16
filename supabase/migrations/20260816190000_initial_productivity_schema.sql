create type public.task_status as enum ('todo', 'in_progress', 'completed', 'cancelled');
create type public.task_priority as enum ('low', 'medium', 'high', 'urgent');
create type public.task_category as enum ('personal', 'workout', 'reading', 'hobby', 'errand', 'other');
create type public.task_recurrence as enum ('none', 'daily', 'weekly', 'monthly');
create type public.goal_status as enum ('active', 'completed', 'paused', 'cancelled');
create type public.goal_period as enum ('week', 'month', 'year');
create type public.habit_frequency as enum ('daily', 'weekly');
create type public.book_status as enum ('want_to_read', 'reading', 'finished', 'abandoned');

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  title text not null check (char_length(title) between 1 and 500),
  description text,
  status public.task_status not null default 'todo',
  priority public.task_priority not null default 'medium',
  due_date date,
  completed_at timestamptz,
  category public.task_category not null default 'personal',
  recurrence public.task_recurrence not null default 'none',
  recurrence_interval integer not null default 1 check (recurrence_interval > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'completed' and completed_at is not null)
    or (status <> 'completed' and completed_at is null)
  )
);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  title text not null check (char_length(title) between 1 and 500),
  description text,
  status public.goal_status not null default 'active',
  target_date date,
  period public.goal_period not null,
  progress numeric(5, 2) not null default 0 check (progress between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name text not null check (char_length(name) between 1 and 200),
  description text,
  frequency public.habit_frequency not null default 'daily',
  target integer not null default 1 check (target > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.habit_completions (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits (id) on delete cascade,
  completed_at date not null default current_date,
  created_at timestamptz not null default now(),
  unique (habit_id, completed_at)
);

create table public.books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  title text not null check (char_length(title) between 1 and 500),
  author text,
  status public.book_status not null default 'want_to_read',
  started_at date,
  finished_at date,
  rating smallint check (rating between 1 and 5),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (finished_at is null or started_at is null or finished_at >= started_at)
);

create table public.lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name text not null check (char_length(name) between 1 and 200),
  description text,
  icon text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 500),
  completed boolean not null default false,
  position integer not null default 0 check (position >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_user_status_due_date_idx on public.tasks (user_id, status, due_date);
create index goals_user_period_idx on public.goals (user_id, period);
create index habits_user_id_idx on public.habits (user_id);
create index habit_completions_habit_completed_at_idx
  on public.habit_completions (habit_id, completed_at desc);
create index books_user_status_idx on public.books (user_id, status);
create index lists_user_id_idx on public.lists (user_id);
create unique index list_items_list_position_idx on public.list_items (list_id, position);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tasks_set_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

create trigger goals_set_updated_at
before update on public.goals
for each row execute function public.set_updated_at();

create trigger habits_set_updated_at
before update on public.habits
for each row execute function public.set_updated_at();

create trigger books_set_updated_at
before update on public.books
for each row execute function public.set_updated_at();

create trigger lists_set_updated_at
before update on public.lists
for each row execute function public.set_updated_at();

create trigger list_items_set_updated_at
before update on public.list_items
for each row execute function public.set_updated_at();

alter table public.tasks enable row level security;
alter table public.goals enable row level security;
alter table public.habits enable row level security;
alter table public.habit_completions enable row level security;
alter table public.books enable row level security;
alter table public.lists enable row level security;
alter table public.list_items enable row level security;

create policy "Users manage their own tasks"
on public.tasks for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users manage their own goals"
on public.goals for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users manage their own habits"
on public.habits for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users manage completions for their habits"
on public.habit_completions for all to authenticated
using (
  exists (
    select 1
    from public.habits
    where habits.id = habit_completions.habit_id
      and habits.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.habits
    where habits.id = habit_completions.habit_id
      and habits.user_id = (select auth.uid())
  )
);

create policy "Users manage their own books"
on public.books for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users manage their own lists"
on public.lists for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users manage items for their lists"
on public.list_items for all to authenticated
using (
  exists (
    select 1
    from public.lists
    where lists.id = list_items.list_id
      and lists.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.lists
    where lists.id = list_items.list_id
      and lists.user_id = (select auth.uid())
  )
);

grant select, insert, update, delete on all tables in schema public to authenticated;
