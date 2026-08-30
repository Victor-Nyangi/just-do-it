// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useTaskStore } from '../features/tasks';

describe('the jsdom test environment', () => {
  it('provides a document', () => {
    expect(typeof document).toBe('object');
  });

  it('renders a React element and finds it by role', () => {
    render(<button type="button">Ready</button>);

    expect(screen.getByRole('button', { name: 'Ready' })).toBeInTheDocument();
  });
});

// src/test/setup.ts gates all of its DOM work — the jest-dom matchers, the RTL
// cleanup and the store reset — behind `typeof document !== 'undefined'`, so
// that the eleven pure-logic suites do not pay to load React and the fixtures.
// The failure mode of that gate is silent: stores would simply stop being
// reset, and tests would start leaking into each other in ways that look like
// application bugs. These two run in order and catch it — the first empties the
// task store, and the second can only pass if the setup file re-seeded it.
describe('the shared setup file under jsdom', () => {
  it('lets a test empty a store', () => {
    useTaskStore.setState({ tasks: [] });

    expect(useTaskStore.getState().tasks).toHaveLength(0);
  });

  it('re-seeds that store before the next test in the file', () => {
    expect(useTaskStore.getState().tasks.length).toBeGreaterThan(0);
  });
});
