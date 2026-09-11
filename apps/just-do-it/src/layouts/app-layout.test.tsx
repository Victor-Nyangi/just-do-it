// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { AppLayout } from './app-layout';

// The desktop sidebar is hidden with `hidden lg:block`, but Tailwind's
// stylesheet is not loaded under jsdom, so both copies of the navigation are
// present in the DOM at once. Every query below is therefore scoped to the
// mobile drawer rather than run against the whole page.
function renderLayout() {
  return render(
    <MemoryRouter initialEntries={['/today']}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/today" element={<p>Today page</p>} />
          <Route path="/tasks" element={<p>Tasks page</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

function mobileDrawer(): HTMLElement {
  const closeButton = screen.getByRole('button', { name: 'Close navigation' });

  if (!closeButton.parentElement) throw new Error('The drawer has no root element');

  return closeButton.parentElement;
}

function drawerIsOpen(): boolean {
  return screen.queryByRole('button', { name: 'Close navigation' }) !== null;
}

describe('AppLayout — the mobile drawer', () => {
  it('starts closed', () => {
    renderLayout();

    expect(drawerIsOpen()).toBe(false);
  });

  it('opens from the header button', async () => {
    const user = userEvent.setup();
    renderLayout();

    await user.click(screen.getByRole('button', { name: 'Open navigation' }));

    expect(drawerIsOpen()).toBe(true);
  });

  // The dismiss affordance outside the sidebar. Worth knowing what this does
  // and does not prove: jsdom does no layout and no hit-testing, so it will
  // happily deliver this click even when something overlaps the button and
  // makes it unreachable in a real browser — which is exactly the bug this
  // overlay had. The wiring is covered here; the stacking is not, and was
  // checked in a browser instead.
  it('closes when the area outside the sidebar is clicked', async () => {
    const user = userEvent.setup();
    renderLayout();

    await user.click(screen.getByRole('button', { name: 'Open navigation' }));
    await user.click(screen.getByRole('button', { name: 'Close navigation' }));

    expect(drawerIsOpen()).toBe(false);
  });

  it('closes behind a destination rather than covering the page it opened', async () => {
    const user = userEvent.setup();
    renderLayout();

    await user.click(screen.getByRole('button', { name: 'Open navigation' }));
    await user.click(within(mobileDrawer()).getByRole('link', { name: 'Tasks' }));

    expect(drawerIsOpen()).toBe(false);
    expect(screen.getByText('Tasks page')).toBeInTheDocument();
  });

  it('closes on the way to settings too', async () => {
    const user = userEvent.setup();
    renderLayout();

    await user.click(screen.getByRole('button', { name: 'Open navigation' }));
    await user.click(within(mobileDrawer()).getByRole('link', { name: 'Settings' }));

    expect(drawerIsOpen()).toBe(false);
  });

  it('offers the challenge alongside the other destinations', async () => {
    const user = userEvent.setup();
    renderLayout();

    await user.click(screen.getByRole('button', { name: 'Open navigation' }));

    expect(within(mobileDrawer()).getByRole('link', { name: 'Challenge' })).toHaveAttribute(
      'href',
      '/challenge',
    );
  });
});
