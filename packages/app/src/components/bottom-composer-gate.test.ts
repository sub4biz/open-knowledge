import { describe, expect, test } from 'bun:test';
import {
  type BottomComposerGateInputs,
  shouldShowBottomComposer,
  shouldShowFolderComposer,
} from './bottom-composer-gate';

const PASSING: BottomComposerGateInputs = {
  terminalVisible: false,
  isEmbedded: false,
  activeDocName: 'notes',
};

describe('shouldShowBottomComposer', () => {
  test('renders when not embedded, terminal closed, and a doc is open', () => {
    expect(shouldShowBottomComposer(PASSING)).toBe(true);
  });

  describe('each gate input independently hides the composer', () => {
    test('hidden when the terminal is open', () => {
      expect(shouldShowBottomComposer({ ...PASSING, terminalVisible: true })).toBe(false);
    });

    test('hidden when the host is embedded', () => {
      expect(shouldShowBottomComposer({ ...PASSING, isEmbedded: true })).toBe(false);
    });

    test('hidden when no document is open', () => {
      expect(shouldShowBottomComposer({ ...PASSING, activeDocName: null })).toBe(false);
    });
  });

  test('stays hidden when several inputs fail at once', () => {
    expect(
      shouldShowBottomComposer({
        terminalVisible: true,
        isEmbedded: true,
        activeDocName: null,
      }),
    ).toBe(false);
  });
});

describe('shouldShowFolderComposer', () => {
  const PASSING_FOLDER = { terminalVisible: false, isEmbedded: false };

  test('renders when not embedded and terminal closed (no doc required)', () => {
    expect(shouldShowFolderComposer(PASSING_FOLDER)).toBe(true);
  });

  test('hidden when the terminal is open', () => {
    expect(shouldShowFolderComposer({ ...PASSING_FOLDER, terminalVisible: true })).toBe(false);
  });

  test('hidden when the host is embedded', () => {
    expect(shouldShowFolderComposer({ ...PASSING_FOLDER, isEmbedded: true })).toBe(false);
  });
});
