import { describe, expect, it } from 'vitest';
import { DEFAULT_INBOX_SETTINGS, readInboxSettings } from '../src/index.js';

describe('readInboxSettings (issue #40)', () => {
  it('returns the defaults when nothing is stored', () => {
    expect(readInboxSettings(null)).toEqual(DEFAULT_INBOX_SETTINGS);
    expect(readInboxSettings(undefined)).toEqual(DEFAULT_INBOX_SETTINGS);
    expect(readInboxSettings('not an object')).toEqual(DEFAULT_INBOX_SETTINGS);
  });

  it('fills keys missing from older rows with their defaults', () => {
    expect(readInboxSettings({ distributionMethod: 'ROUND_ROBIN', preferredAgent: true })).toEqual({
      ...DEFAULT_INBOX_SETTINGS,
      distributionMethod: 'ROUND_ROBIN',
      preferredAgent: true,
    });
  });

  it('drops keys that are not inbox settings', () => {
    expect(readInboxSettings({ legacyFlag: true })).toEqual(DEFAULT_INBOX_SETTINGS);
  });

  it('falls back to the defaults as a whole when a stored value is invalid', () => {
    expect(
      readInboxSettings({ distributionMethod: 'ROUND_ROBIN', maxConversationsPerAgent: 0 }),
    ).toEqual(DEFAULT_INBOX_SETTINGS);
  });
});
