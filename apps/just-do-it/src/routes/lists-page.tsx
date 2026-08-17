import { CheckCircle2, List, Plus, Sparkles } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Badge, Button, Card, Input } from '@just-do-it/ui';
import { useCreateList, useLists, type List as ListRecord } from '../features/lists';

const linkButtonClassName =
  'inline-flex h-10 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2';

function formatItemCount(count: number): string {
  return `${count} item${count === 1 ? '' : 's'}`;
}

function ListsEmptyState({ onCreateList }: { onCreateList: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--muted-foreground)]">
        <List aria-hidden="true" className="size-6" />
      </div>
      <h2 className="mt-4 text-lg font-bold">No lists yet</h2>
      <p className="mt-2 text-sm text-[var(--muted-foreground)]">
        Create a session-local list to capture steps, shopping runs, or a quick collection of ideas.
      </p>
      <Button className="mt-4" onClick={onCreateList}>
        <Plus aria-hidden="true" className="mr-2 size-4" />
        Create list
      </Button>
    </div>
  );
}

function ListCard({ list }: { list: ListRecord }) {
  const completedItemCount = list.items.filter((item) => item.complete).length;
  const notePreview = list.note
    ? list.note.length > 120
      ? `${list.note.slice(0, 117)}...`
      : list.note
    : 'No notes yet. Open the list to add context for this session.';

  return (
    <article>
      <Card className="flex h-full flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold">{list.name}</h3>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              {formatItemCount(list.items.length)}
            </p>
          </div>
          <Badge tone={completedItemCount > 0 ? 'success' : 'neutral'}>
            {completedItemCount}/{list.items.length || 0} done
          </Badge>
        </div>

        <p className="flex-1 text-sm text-[var(--muted-foreground)]">{notePreview}</p>

        <div className="flex flex-wrap items-center gap-3">
          <Link className={linkButtonClassName} to={`/lists/${list.id}`}>
            Open list
          </Link>
          <span className="text-xs text-[var(--muted-foreground)]">
            Rename, add items, reorder, and edit notes on the detail page.
          </span>
        </div>
      </Card>
    </article>
  );
}

export function ListsPage() {
  const lists = useLists();
  const createList = useCreateList();
  const navigate = useNavigate();
  const [listName, setListName] = useState('');

  const totalItemCount = useMemo(
    () => lists.reduce((count, list) => count + list.items.length, 0),
    [lists],
  );
  const completedItemCount = useMemo(
    () =>
      lists.reduce((count, list) => count + list.items.filter((item) => item.complete).length, 0),
    [lists],
  );

  function focusComposer() {
    document.getElementById('list-name')?.focus();
  }

  function handleCreateList(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedName = listName.trim();
    if (!normalizedName) return;

    const listId = createList({ name: normalizedName });

    setListName('');
    navigate(`/lists/${listId}`);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
      <section className="mb-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div>
          <Badge tone="accent">Static list domain</Badge>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Lists</h1>
          <p className="mt-2 max-w-2xl text-[var(--muted-foreground)]">
            Build focused session-local lists, then jump into detail views for quick item management
            and note keeping.
          </p>
        </div>
        <Button onClick={focusComposer}>
          <Sparkles aria-hidden="true" className="mr-2 size-4" />
          New list
        </Button>
      </section>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-sm text-[var(--muted-foreground)]">Lists</p>
          <p className="mt-3 text-2xl font-bold">{lists.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-[var(--muted-foreground)]">Items</p>
          <p className="mt-3 text-2xl font-bold">{totalItemCount}</p>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <CheckCircle2 aria-hidden="true" className="size-5 text-[var(--success)]" />
            <div>
              <p className="text-sm text-[var(--muted-foreground)]">Completed</p>
              <p className="mt-1 text-2xl font-bold">{completedItemCount}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <section aria-labelledby="all-lists-heading" className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold" id="all-lists-heading">
                Your lists
              </h2>
              <p className="text-sm text-[var(--muted-foreground)]">
                Open any list for renaming, notes, and item-level actions.
              </p>
            </div>
            {lists.length > 0 ? (
              <Badge tone="neutral">{formatItemCount(totalItemCount)}</Badge>
            ) : null}
          </div>

          {lists.length === 0 ? (
            <ListsEmptyState onCreateList={focusComposer} />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {lists.map((list) => (
                <ListCard key={list.id} list={list} />
              ))}
            </div>
          )}
        </section>

        <aside className="space-y-6">
          <Card>
            <div className="mb-5">
              <Badge tone="neutral">Session-local composer</Badge>
              <h2 className="mt-3 text-lg font-bold">Create a list</h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                Lists stay in the current session store so you can iterate quickly without leaving
                the app shell.
              </p>
            </div>

            <form className="space-y-4" onSubmit={handleCreateList}>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="list-name">
                  List name
                </label>
                <Input
                  id="list-name"
                  onChange={(event) => setListName(event.target.value)}
                  placeholder="Weekend reset"
                  required
                  value={listName}
                />
              </div>

              <Button className="w-full sm:w-auto" type="submit">
                <Plus aria-hidden="true" className="mr-2 size-4" />
                Create and open
              </Button>
            </form>
          </Card>

          <Card variant="accent">
            <h2 className="text-lg font-bold">How it works</h2>
            <ul className="mt-3 space-y-2 text-sm text-[var(--muted-foreground)]">
              <li>• Create a list here, then manage items from its detail page.</li>
              <li>• Toggle completion, move items up or down, and clear entries as needed.</li>
              <li>• Keep notes beside the checklist to preserve context for this session.</li>
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}
