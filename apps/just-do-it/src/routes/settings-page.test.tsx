// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SettingsPage } from './settings-page';

// The suite runs against a build with neither VITE_CLERK_PUBLISHABLE_KEY nor
// VITE_API_URL, because Vite inlines those at build time and a test cannot
// change them afterwards. That is the honest coverage here: the page has to
// read correctly on an unconfigured build, which is exactly the state someone
// hits when they forget to redeploy after adding a variable.
function renderSettings() {
  return render(
    <MemoryRouter>
      <SettingsPage />
    </MemoryRouter>,
  );
}

function row(label: string): HTMLElement {
  return screen.getByText(label).closest('li') as HTMLElement;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SettingsPage — authentication', () => {
  it('says the Clerk key is not set', () => {
    renderSettings();

    expect(within(row('Clerk key')).getByText('not set')).toBeInTheDocument();
  });

  // The single most common cause of "I set it and nothing happened".
  it('explains that the key is inlined at build time', () => {
    renderSettings();

    expect(within(row('Clerk key')).getByText(/inlines it at build time/)).toBeInTheDocument();
  });

  it('reports signed out rather than pending', () => {
    renderSettings();

    expect(within(row('Signed in')).getByText('no')).toBeInTheDocument();
  });

  it('does not claim Clerk is loading when there is no Clerk', () => {
    renderSettings();

    expect(within(row('Clerk loaded')).getByText('not applicable')).toBeInTheDocument();
  });
});

describe('SettingsPage — the API check', () => {
  it('says the Worker URL is not set', () => {
    renderSettings();

    expect(within(row('Worker URL')).getByText('not set')).toBeInTheDocument();
  });

  it('has nothing to check against, so the button is disabled', () => {
    renderSettings();

    expect(screen.getByRole('button', { name: /Check the API/ })).toBeDisabled();
  });

  it('starts with the health check unrun', () => {
    renderSettings();

    expect(within(row('Health check')).getByText('not run')).toBeInTheDocument();
  });
});

describe('SettingsPage — sync status', () => {
  // With no API URL there is nothing to sync to, and that is not a failure —
  // it is the local-only design working as intended.
  it('reports progress as local rather than as an error', () => {
    renderSettings();

    expect(within(row('Journey progress')).getByText('this browser only')).toBeInTheDocument();
  });

  it('says why nothing is syncing', () => {
    renderSettings();

    expect(
      within(row('Journey progress')).getByText(/expected unless there is both/),
    ).toBeInTheDocument();
  });
});

describe('SettingsPage — where progress lives', () => {
  it('points a signed-out visitor at the commit-to-publish loop', () => {
    renderSettings();

    expect(
      screen.getByText(/kept in this browser and published by committing/),
    ).toBeInTheDocument();
  });
});
