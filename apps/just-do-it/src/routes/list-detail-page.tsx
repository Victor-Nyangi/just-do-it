import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  Circle,
  FileText,
  Plus,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';

import { Badge, Button, Card, Input, cn } from '@just-do-it/ui';
import {
  useCreateListItem,
  useDeleteListItem,
  useList,
  useReorderListItems,
  useToggleListItem,
  useUpdateList,
} from '../features/lists';

const controlClassName =
  'min-h-10 w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]';

const linkButtonClassName =
  'inline-flex h-10 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2';

function normalizeOptionalNote(value: string): string | undefined {
  const normalizedValue = value.trim();
  return normalizedValue ? normalizedValue : undefined;
}

function ListItemsEmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--muted-foreground)]">
        <Circle aria-hidden="true" className="size-6" />
      </div>
      <h2 className="mt-4 text-lg font-bold">No items yet</h2>
      <p className="mt-2 text-sm text-[var(--muted-foreground)]">
        Add the first item above to turn this into a working, session-local checklist.
      </p>
    </div>
  );
}

function ListNotFoundState() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-8 sm:py-12">
      <Card className="text-center">
        <h1 className="text-2xl font-bold">List not found</h1>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          This list may have been removed from the current session store.
        </p>
        <Link className={cn(linkButtonClassName, 'mt-6')} to="/lists">
          Back to lists
        </Link>
      </Card>
    </div>
  );
}

export function ListDetailPage() {
  const { listId = '' } = useParams();
  const list = useList(listId);
  const updateList = useUpdateList();
  const createListItem = useCreateListItem();
  const toggleListItem = useToggleListItem();
  const reorderListItems = useReorderListItems();
  const deleteListItem = useDeleteListItem();

  const [draftName, setDraftName] = useState('');
  const [draftItemTitle, setDraftItemTitle] = useState('');
  const [draftNote, setDraftNote] = useState('');

  useEffect(() => {
    if (!list) return;

    setDraftName(list.name);
    setDraftNote(list.note ?? '');
  }, [list]);

  const completedItemCount = useMemo(
    () => list?.items.filter((item) => item.complete).length ?? 0,
    [list],
  );

  if (!list) {
    return <ListNotFoundState />;
  }

  const activeListId = list.id;
  const normalizedName = draftName.trim();
  const normalizedNote = normalizeOptionalNote(draftNote);
  const hasNameChanged = normalizedName !== list.name;
  const hasNoteChanged = normalizedNote !== list.note;

  function handleRenameList(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!normalizedName || !hasNameChanged) return;

    updateList(activeListId, { name: normalizedName });
  }

  function handleAddItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedTitle = draftItemTitle.trim();
    if (!normalizedTitle) return;

    createListItem(activeListId, { title: normalizedTitle });
    setDraftItemTitle('');
  }

  function handleSaveNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!hasNoteChanged) return;

    updateList(activeListId, { note: normalizedNote });
  }

  function moveItem(index: number, direction: -1 | 1) {
    reorderListItems(activeListId, index, index + direction);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
      <div className="mb-6">
        <Link className={cn(linkButtonClassName, 'gap-2')} to="/lists">
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to lists
        </Link>
      </div>

      <section className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge tone="accent">List detail</Badge>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{list.name}</h1>
          <p className="mt-2 max-w-2xl text-[var(--muted-foreground)]">
            Rename the list, keep a note nearby, and manage checklist items without leaving the
            route.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Badge tone="neutral">{list.items.length} items</Badge>
          <Badge tone={completedItemCount > 0 ? 'success' : 'neutral'}>
            {completedItemCount} complete
          </Badge>
        </div>
      </section>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-sm text-[var(--muted-foreground)]">Open</p>
          <p className="mt-3 text-2xl font-bold">{list.items.length - completedItemCount}</p>
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
        <Card>
          <div className="flex items-center gap-3">
            <FileText aria-hidden="true" className="size-5 text-[var(--accent)]" />
            <div>
              <p className="text-sm text-[var(--muted-foreground)]">Notes</p>
              <p className="mt-1 text-2xl font-bold">{list.note ? 1 : 0}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <div className="space-y-6">
          <Card>
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Items</h2>
                <p className="text-sm text-[var(--muted-foreground)]">
                  Add entries, toggle completion, move them up or down, or remove them when done.
                </p>
              </div>
              <Badge tone="neutral">{list.items.length}</Badge>
            </div>

            <form className="mb-5 flex flex-col gap-3 sm:flex-row" onSubmit={handleAddItem}>
              <div className="flex-1 space-y-2">
                <label className="text-sm font-medium" htmlFor="list-item-title">
                  New item
                </label>
                <Input
                  id="list-item-title"
                  onChange={(event) => setDraftItemTitle(event.target.value)}
                  placeholder="Add the next step"
                  required
                  value={draftItemTitle}
                />
              </div>
              <div className="sm:self-end">
                <Button className="w-full sm:w-auto" type="submit">
                  <Plus aria-hidden="true" className="mr-2 size-4" />
                  Add item
                </Button>
              </div>
            </form>

            {list.items.length === 0 ? (
              <ListItemsEmptyState />
            ) : (
              <ol className="space-y-3">
                {list.items.map((item, index) => (
                  <li key={item.id}>
                    <article className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-start gap-3">
                          <button
                            aria-label={
                              item.complete
                                ? `Mark ${item.title} as incomplete`
                                : `Mark ${item.title} as complete`
                            }
                            aria-pressed={item.complete}
                            className={cn(
                              'mt-0.5 rounded-full text-[var(--muted-foreground)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2',
                              item.complete && 'text-[var(--success)]',
                            )}
                            onClick={() => toggleListItem(list.id, item.id)}
                            type="button"
                          >
                            {item.complete ? (
                              <CheckCircle2 aria-hidden="true" className="size-5" />
                            ) : (
                              <Circle aria-hidden="true" className="size-5" />
                            )}
                          </button>
                          <div>
                            <p
                              className={cn(
                                'font-medium',
                                item.complete && 'text-[var(--muted-foreground)] line-through',
                              )}
                            >
                              {item.title}
                            </p>
                            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                              Position {index + 1} of {list.items.length}
                            </p>
                          </div>
                        </div>

                        <div
                          aria-label={`Actions for ${item.title}`}
                          className="flex flex-wrap gap-2"
                          role="group"
                        >
                          <Button
                            aria-label={`Move ${item.title} up`}
                            disabled={index === 0}
                            onClick={() => moveItem(index, -1)}
                            variant="secondary"
                          >
                            <ArrowUp aria-hidden="true" className="size-4" />
                          </Button>
                          <Button
                            aria-label={`Move ${item.title} down`}
                            disabled={index === list.items.length - 1}
                            onClick={() => moveItem(index, 1)}
                            variant="secondary"
                          >
                            <ArrowDown aria-hidden="true" className="size-4" />
                          </Button>
                          <Button
                            aria-label={`Delete ${item.title}`}
                            onClick={() => deleteListItem(list.id, item.id)}
                            variant="secondary"
                          >
                            <Trash2 aria-hidden="true" className="size-4" />
                          </Button>
                        </div>
                      </div>
                    </article>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <div className="mb-5">
              <Badge tone="neutral">List settings</Badge>
              <h2 className="mt-3 text-lg font-bold">Rename list</h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                Keep the label current as the scope of the list changes.
              </p>
            </div>

            <form className="space-y-4" onSubmit={handleRenameList}>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="list-title">
                  Name
                </label>
                <Input
                  id="list-title"
                  onChange={(event) => setDraftName(event.target.value)}
                  required
                  value={draftName}
                />
              </div>
              <Button disabled={!normalizedName || !hasNameChanged} type="submit">
                Save name
              </Button>
            </form>
          </Card>

          <Card variant="accent">
            <div className="mb-5">
              <Badge tone="accent">Context note</Badge>
              <h2 className="mt-3 text-lg font-bold">Notes</h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                Capture quick context, reminders, or scope decisions for this list.
              </p>
            </div>

            <form className="space-y-4" onSubmit={handleSaveNote}>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="list-note">
                  Note
                </label>
                <textarea
                  className={controlClassName}
                  id="list-note"
                  onChange={(event) => setDraftNote(event.target.value)}
                  placeholder="Add context that makes this list more useful."
                  rows={6}
                  value={draftNote}
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <Button disabled={!hasNoteChanged} type="submit">
                  Save note
                </Button>
                <Button
                  disabled={!list.note && !draftNote}
                  onClick={() => {
                    setDraftNote('');
                    updateList(list.id, { note: undefined });
                  }}
                  type="button"
                  variant="secondary"
                >
                  Clear note
                </Button>
              </div>
            </form>
          </Card>
        </aside>
      </div>
    </div>
  );
}
