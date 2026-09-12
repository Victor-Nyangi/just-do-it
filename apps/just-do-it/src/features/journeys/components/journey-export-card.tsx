import { Check, Copy, RotateCcw } from 'lucide-react';
import { useState } from 'react';

import { Badge, Button, Card } from '@just-do-it/ui';
import { buildCompletionsFileContents, countUncommittedChanges } from '../journey-export';
import { useJourneyCompletions, useResetJourneysToCommitted } from '../hooks';

const COMPLETIONS_FILE_PATH = 'apps/just-do-it/src/data/journey-completions.json';

export function JourneyExportCard() {
  const completions = useJourneyCompletions();
  const resetToCommitted = useResetJourneysToCommitted();
  const [copied, setCopied] = useState(false);

  const uncommittedCount = countUncommittedChanges(completions);

  async function copyFileContents() {
    try {
      await navigator.clipboard.writeText(buildCompletionsFileContents(completions));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // A denied clipboard permission is not worth an error state; the reset
      // and the explanation below still work.
    }
  }

  return (
    <Card className="space-y-4" variant="subtle">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-bold">Publish today&rsquo;s progress</h2>
          <p className="mt-1 max-w-xl text-sm text-[var(--muted-foreground)]">
            Ticks are saved in this browser straight away. Committing them to{' '}
            <code className="rounded bg-[var(--surface)] px-1 py-0.5 text-xs">
              {COMPLETIONS_FILE_PATH}
            </code>{' '}
            is what makes them public and carries them to your other devices.
          </p>
        </div>
        {uncommittedCount === 0 ? (
          <Badge tone="success">Matches the repo</Badge>
        ) : (
          <Badge tone="warning">
            {uncommittedCount} uncommitted {uncommittedCount === 1 ? 'change' : 'changes'}
          </Badge>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          onClick={copyFileContents}
          variant={uncommittedCount === 0 ? 'secondary' : 'primary'}
        >
          {copied ? (
            <Check aria-hidden="true" className="mr-2 size-4" />
          ) : (
            <Copy aria-hidden="true" className="mr-2 size-4" />
          )}
          {copied ? 'Copied' : 'Copy file contents'}
        </Button>
        <Button
          aria-label="Discard local changes and reload the committed record"
          onClick={resetToCommitted}
          variant="ghost"
        >
          <RotateCcw aria-hidden="true" className="mr-2 size-4" />
          Reset to the repo
        </Button>
      </div>

      <p className="text-xs text-[var(--muted-foreground)]">
        Paste over the file, commit, and the deploy updates. The output is sorted and its ids are
        derived from the day and activity, so each commit diffs to exactly the lines that changed.
      </p>
    </Card>
  );
}
