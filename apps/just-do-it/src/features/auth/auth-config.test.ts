import { describe, expect, it } from 'vitest';

import { describeClerkInstance, looksLikeSecretKey } from './auth-config';

describe('describeClerkInstance', () => {
  // The distinction is not cosmetic: a production instance cannot run on a
  // *.vercel.app URL, because Clerk verifies through DNS records on a domain
  // you control. Naming it on the settings page is what makes that visible.
  it('recognises a development key', () => {
    expect(describeClerkInstance('pk_test_abc123')).toBe('development');
  });

  it('recognises a production key', () => {
    expect(describeClerkInstance('pk_live_abc123')).toBe('production');
  });

  it('admits when it does not recognise a key', () => {
    expect(describeClerkInstance('')).toBeNull();
    expect(describeClerkInstance('something-else')).toBeNull();
    // A secret key is not a publishable key of either kind.
    expect(describeClerkInstance('sk_test_abc123')).toBeNull();
  });
});

describe('looksLikeSecretKey', () => {
  // The one mistake that turns a full-access credential public is giving the
  // secret key a VITE_ prefix, since Vite then inlines it into the bundle.
  it('spots a secret key', () => {
    expect(looksLikeSecretKey('sk_test_abc123')).toBe(true);
    expect(looksLikeSecretKey('sk_live_abc123')).toBe(true);
  });

  it('passes a publishable key', () => {
    expect(looksLikeSecretKey('pk_test_abc123')).toBe(false);
    expect(looksLikeSecretKey('pk_live_abc123')).toBe(false);
  });

  it('passes an empty key, which is simply unconfigured', () => {
    expect(looksLikeSecretKey('')).toBe(false);
  });
});
