import { CircleAlert, CircleCheck, CircleDashed, Loader2 } from 'lucide-react';
import { useState } from 'react';

import { Badge, Button, Card } from '@just-do-it/ui';
import {
  clerkPublishableKey,
  describeClerkInstance,
  isClerkConfigured,
  useAuthSnapshot,
} from '../features/auth';

// Read here rather than in a module of its own: nothing else consumes it yet,
// and it moves into the sync layer when that exists.
const rawApiUrl = import.meta.env.VITE_API_URL;
const apiUrl = typeof rawApiUrl === 'string' ? rawApiUrl.trim().replace(/\/$/, '') : '';

type CheckTone = 'ok' | 'warn' | 'idle';

type HealthState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'ok' }
  | { status: 'failed'; detail: string };

function CheckRow({
  detail,
  label,
  tone,
  value,
}: {
  detail?: string;
  label: string;
  tone: CheckTone;
  value: string;
}) {
  const Icon = tone === 'ok' ? CircleCheck : tone === 'warn' ? CircleAlert : CircleDashed;
  const iconClass =
    tone === 'ok'
      ? 'text-[var(--primary)]'
      : tone === 'warn'
        ? 'text-[var(--danger)]'
        : 'text-[var(--muted-foreground)]';

  return (
    <li className="flex items-start gap-3 border-b border-[var(--border)] py-3 last:border-b-0">
      <Icon aria-hidden="true" className={`mt-0.5 size-4 shrink-0 ${iconClass}`} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <span className="text-sm font-medium">{label}</span>
          <span className="text-sm text-[var(--muted-foreground)]">{value}</span>
        </div>
        {detail ? <p className="mt-1 text-xs text-[var(--muted-foreground)]">{detail}</p> : null}
      </div>
    </li>
  );
}

// Only ever shows the prefix. The publishable key is not a secret, but printing
// a credential in full teaches a habit worth not having.
function describeKey(publishableKey: string): string {
  if (!publishableKey) return 'not set';

  return `${publishableKey.slice(0, 11)}…`;
}

export function SettingsPage() {
  const auth = useAuthSnapshot();
  const [health, setHealth] = useState<HealthState>({ status: 'idle' });

  const instance = describeClerkInstance(clerkPublishableKey);

  async function checkApiHealth() {
    if (!apiUrl) return;

    setHealth({ status: 'checking' });

    try {
      const response = await fetch(`${apiUrl}/api/health`);

      if (!response.ok) {
        setHealth({ status: 'failed', detail: `The Worker answered ${response.status}.` });
        return;
      }

      setHealth({ status: 'ok' });
    } catch (error) {
      // A cross-origin block and a Worker that is down look identical from
      // here — the browser reports both as a bare network failure — so the
      // message names both rather than guessing.
      setHealth({
        status: 'failed',
        detail: `${error instanceof Error ? error.message : 'Request failed'}. Either the Worker is unreachable, or this origin is missing from its ALLOWED_ORIGINS.`,
      });
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-8 sm:py-12">
      <section className="mb-8">
        <Badge tone="accent">Diagnostics</Badge>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Settings</h1>
        <p className="mt-2 text-[var(--muted-foreground)]">
          What this build was configured with, and whether the pieces are talking to each other.
        </p>
      </section>

      <Card className="mb-6">
        <h2 className="font-bold">Authentication</h2>
        <ul className="mt-2">
          <CheckRow
            detail={
              isClerkConfigured
                ? undefined
                : 'VITE_CLERK_PUBLISHABLE_KEY was not set when this build was made. Vite inlines it at build time, so adding it now needs a rebuild.'
            }
            label="Clerk key"
            tone={isClerkConfigured ? 'ok' : 'idle'}
            value={describeKey(clerkPublishableKey)}
          />
          {isClerkConfigured ? (
            <CheckRow
              detail={
                instance === 'development'
                  ? 'A development instance. Works on localhost and on a *.vercel.app URL, capped at 100 users.'
                  : instance === 'production'
                    ? 'A production instance. Requires a domain you control, verified by DNS records.'
                    : 'Unrecognised key prefix — a publishable key starts pk_test_ or pk_live_.'
              }
              label="Instance"
              tone={instance ? 'ok' : 'warn'}
              value={instance ?? 'unknown'}
            />
          ) : null}
          <CheckRow
            label="Clerk loaded"
            tone={!isClerkConfigured ? 'idle' : auth.loaded ? 'ok' : 'warn'}
            value={!isClerkConfigured ? 'not applicable' : auth.loaded ? 'yes' : 'still loading'}
          />
          <CheckRow
            detail={auth.signedIn && auth.userId ? `User id ${auth.userId}` : undefined}
            label="Signed in"
            tone={auth.signedIn ? 'ok' : 'idle'}
            value={auth.signedIn ? (auth.label ?? 'yes') : 'no'}
          />
        </ul>
      </Card>

      <Card className="mb-6 space-y-4">
        <div>
          <h2 className="font-bold">API</h2>
          <ul className="mt-2">
            <CheckRow
              detail={
                apiUrl
                  ? undefined
                  : 'VITE_API_URL was not set when this build was made. Progress stays in this browser until it is.'
              }
              label="Worker URL"
              tone={apiUrl ? 'ok' : 'idle'}
              value={apiUrl || 'not set'}
            />
            <CheckRow
              detail={health.status === 'failed' ? health.detail : undefined}
              label="Health check"
              tone={health.status === 'ok' ? 'ok' : health.status === 'failed' ? 'warn' : 'idle'}
              value={
                health.status === 'ok'
                  ? 'reachable'
                  : health.status === 'failed'
                    ? 'failed'
                    : health.status === 'checking'
                      ? 'checking…'
                      : 'not run'
              }
            />
          </ul>
        </div>

        <Button disabled={!apiUrl || health.status === 'checking'} onClick={checkApiHealth}>
          {health.status === 'checking' ? (
            <Loader2 aria-hidden="true" className="mr-2 size-4 animate-spin" />
          ) : null}
          Check the API
        </Button>
      </Card>

      <Card variant="subtle">
        <h2 className="font-bold">Where your progress lives</h2>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          {auth.signedIn
            ? 'Signed in. Once the sync layer lands, journey progress will come from the API rather than this browser.'
            : 'Signed out. Journey progress is kept in this browser and published by committing the exported file — see the streak page.'}
        </p>
      </Card>
    </div>
  );
}
