// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

describe('the jsdom test environment', () => {
  it('provides a document', () => {
    expect(typeof document).toBe('object');
  });

  it('renders a React element and finds it by role', () => {
    render(<button type="button">Ready</button>);

    expect(screen.getByRole('button', { name: 'Ready' })).toBeInTheDocument();
  });
});
